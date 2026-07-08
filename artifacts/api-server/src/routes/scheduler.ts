import { Router } from "express";
import { desc, eq, gte, sql } from "drizzle-orm";
import { db, schedulerRunsTable, jobsTable, sourcesTable, keywordsTable, settingsTable } from "@workspace/db";
import { ListSchedulerRunsQueryParams } from "@workspace/api-zod";
import { summarizeJob } from "../lib/gemini";
import { logger } from "../lib/logger";
import { publishDuePosts } from "./social-connections";

const router = Router();

let isScanning = false;
let lastRunAt: Date | null = null;

// GET /scheduler/status
router.get("/scheduler/status", async (_req, res): Promise<void> => {
  const settings = await db.select().from(settingsTable).limit(1);
  const frequency = settings[0]?.schedulerFrequency ?? "1hour";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const runsToday = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schedulerRunsTable)
    .where(gte(schedulerRunsTable.startedAt, today));

  const nextRunAt = lastRunAt ? getNextRunAt(lastRunAt, frequency) : null;

  res.json({
    isRunning: isScanning,
    frequency,
    lastRunAt: lastRunAt?.toISOString() ?? null,
    nextRunAt: nextRunAt?.toISOString() ?? null,
    totalRunsToday: runsToday[0]?.count ?? 0,
  });
});

function getNextRunAt(lastRun: Date, frequency: string): Date {
  const next = new Date(lastRun);
  switch (frequency) {
    case "15min":  next.setMinutes(next.getMinutes() + 15); break;
    case "1hour":  next.setHours(next.getHours() + 1); break;
    case "2xdaily": next.setHours(next.getHours() + 12); break;
    case "daily":  next.setDate(next.getDate() + 1); break;
    default:       next.setHours(next.getHours() + 1);
  }
  return next;
}

// POST /scheduler/trigger
router.post("/scheduler/trigger", async (_req, res): Promise<void> => {
  if (isScanning) {
    res.json({ jobsFound: 0, jobsAdded: 0, jobsDuplicated: 0, runId: -1, durationMs: 0 });
    return;
  }

  isScanning = true;
  const runStart = Date.now();

  const [runRecord] = await db
    .insert(schedulerRunsTable)
    .values({ status: "running" })
    .returning();

  const runId = runRecord!.id;

  try {
    const [keywords, sources] = await Promise.all([
      db.select().from(keywordsTable).where(eq(keywordsTable.enabled, true)),
      db.select().from(sourcesTable).where(eq(sourcesTable.enabled, true)),
    ]);

    if (keywords.length === 0 || sources.length === 0) {
      const durationMs = Date.now() - runStart;
      await db
        .update(schedulerRunsTable)
        .set({ status: "completed", jobsFound: 0, jobsAdded: 0, jobsDuplicated: 0, finishedAt: new Date(), durationMs })
        .where(eq(schedulerRunsTable.id, runId));
      isScanning = false;
      lastRunAt = new Date();
      res.json({ jobsFound: 0, jobsAdded: 0, jobsDuplicated: 0, runId, durationMs });
      return;
    }

    const discoveredJobs = await discoverJobs(keywords.map((k) => k.term), sources);

    let jobsAdded = 0;
    let jobsDuplicated = 0;

    for (const job of discoveredJobs) {
      const existing = await db
        .select({ id: jobsTable.id })
        .from(jobsTable)
        .where(eq(jobsTable.url, job.url))
        .limit(1);

      if (existing[0]) {
        jobsDuplicated++;
        continue;
      }

      const keywordTerms = keywords.map((k) => k.term);
      let aiResult = null;
      try {
        aiResult = await summarizeJob(job.title, job.company, job.description ?? "", keywordTerms);
      } catch (err) {
        logger.warn({ err }, "AI summarization failed for job");
      }

      await db.insert(jobsTable).values({
        title: job.title,
        company: job.company,
        source: job.source,
        url: job.url,
        description: job.description,
        salary: aiResult?.salary ?? job.salary,
        location: job.location,
        employmentType: job.employmentType,
        remote: aiResult?.remote ?? job.remote,
        postedAt: job.postedAt,
        tags: job.tags,
        aiSummary: aiResult?.summary,
        aiRequirements: aiResult?.requirements,
        aiWhyFits: aiResult?.whyFits,
        aiSeniority: aiResult?.seniority,
        aiTechnologies: aiResult?.technologies ?? [],
        relevanceScore: aiResult?.relevanceScore,
      });

      await db
        .update(sourcesTable)
        .set({
          lastScannedAt: new Date(),
          jobsFound: sql`${sourcesTable.jobsFound} + 1`,
        })
        .where(eq(sourcesTable.slug, job.source));

      jobsAdded++;
    }

    const durationMs = Date.now() - runStart;
    lastRunAt = new Date();

    await db
      .update(schedulerRunsTable)
      .set({ status: "completed", jobsFound: discoveredJobs.length, jobsAdded, jobsDuplicated, finishedAt: lastRunAt, durationMs })
      .where(eq(schedulerRunsTable.id, runId));

    isScanning = false;

    // Fire any scheduled social posts that are now due
    publishDuePosts().catch((err) => logger.warn({ err }, "publishDuePosts failed"));

    res.json({ jobsFound: discoveredJobs.length, jobsAdded, jobsDuplicated, runId, durationMs });
  } catch (err) {
    const durationMs = Date.now() - runStart;
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Scan failed");
    await db
      .update(schedulerRunsTable)
      .set({ status: "failed", finishedAt: new Date(), durationMs, errorMessage })
      .where(eq(schedulerRunsTable.id, runId));
    isScanning = false;
    res.status(500).json({ error: errorMessage });
  }
});

// GET /scheduler/runs
router.get("/scheduler/runs", async (req, res): Promise<void> => {
  const parsed = ListSchedulerRunsQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 20) : 20;

  const runs = await db
    .select()
    .from(schedulerRunsTable)
    .orderBy(desc(schedulerRunsTable.startedAt))
    .limit(limit);

  res.json(runs);
});

// ── Job discovery ─────────────────────────────────────────────────────────────

interface RawJob {
  title: string;
  company: string;
  source: string;
  url: string;
  description?: string;
  salary?: string;
  location?: string;
  employmentType?: string;
  remote?: boolean;
  postedAt?: string;
  tags: string[];
}

async function discoverJobs(
  keywords: string[],
  sources: Array<{ slug: string; type: string; url: string | null; name: string }>,
): Promise<RawJob[]> {
  const jobs: RawJob[] = [];
  for (const source of sources) {
    if (source.type === "rss" && source.url) {
      try {
        const rssJobs = await fetchRssJobs(source.url, source.slug, keywords);
        jobs.push(...rssJobs);
      } catch (err) {
        logger.warn({ err, source: source.slug }, "RSS fetch failed");
      }
    }
  }
  return jobs;
}

async function fetchRssJobs(
  url: string,
  sourceSlug: string,
  keywords: string[],
): Promise<RawJob[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "JobScout/1.0 (RSS reader)" },
    });
    clearTimeout(timeout);
    if (!response.ok) return [];

    const xml = await response.text();
    const jobs: RawJob[] = [];
    const items = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) ?? [];

    for (const item of items.slice(0, 30)) {
      const rawTitle = extractXmlTag(item, "title");
      const link = extractXmlTag(item, "link") ?? extractXmlTag(item, "guid");
      const rawDescription = extractXmlTag(item, "description");
      const pubDate = extractXmlTag(item, "pubDate");

      if (!rawTitle || !link) continue;

      // Filter by keywords
      const titleLow = rawTitle.toLowerCase();
      const descLow = (rawDescription ?? "").toLowerCase();
      const matchesKeyword = keywords.some(
        (kw) => titleLow.includes(kw.toLowerCase()) || descLow.includes(kw.toLowerCase()),
      );
      if (!matchesKeyword) continue;

      // Source-specific structured fields (We Work Remotely provides these)
      const region    = extractXmlTag(item, "region");
      const jobType   = extractXmlTag(item, "type");

      const cleanTitle = cleanHtml(rawTitle);
      const company    = extractCompanyFromTitle(cleanTitle) ?? "Unknown Company";
      // Strip "Company: " prefix to get clean title
      const jobTitle   = cleanTitle.replace(/^[^:]+:\s*/, "").trim() || cleanTitle;

      const descText   = rawDescription ? cleanHtml(rawDescription) : "";
      const salary     = extractSalary(descText) ?? extractSalary(cleanTitle) ?? undefined;

      // Location / remote
      const locationRaw = region ?? extractLocation(descText);
      const isRemote =
        (locationRaw?.toLowerCase().includes("anywhere") ?? false) ||
        (locationRaw?.toLowerCase().includes("worldwide") ?? false) ||
        (locationRaw?.toLowerCase().includes("remote") ?? false) ||
        titleLow.includes("remote") ||
        descLow.includes("fully remote");

      // Keep location if it's a real place, not just "Anywhere in the World"
      const isGlobalRegion = locationRaw
        ? /anywhere|worldwide|global/i.test(locationRaw)
        : false;
      const location = locationRaw && !isGlobalRegion ? locationRaw : undefined;

      jobs.push({
        title: jobTitle,
        company,
        source: sourceSlug,
        url: link,
        description: descText.slice(0, 5000) || undefined,
        salary,
        location,
        employmentType: jobType ?? undefined,
        remote: isRemote,
        postedAt: pubDate ?? undefined,
        tags: keywords.filter((kw) => titleLow.includes(kw.toLowerCase()) || descLow.includes(kw.toLowerCase())),
      });
    }

    return jobs;
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

// ── Parsing helpers ───────────────────────────────────────────────────────────

function extractXmlTag(xml: string, tag: string): string | null {
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i");
  const plainRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(cdataRe) ?? xml.match(plainRe);
  return match?.[1]?.trim() ?? null;
}

function cleanHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractCompanyFromTitle(title: string): string | null {
  // "Company: Job Title" (We Work Remotely)
  const colonMatch = title.match(/^([^:]{2,60}):\s*.+/);
  if (colonMatch) return colonMatch[1].trim();
  // "Job Title at Company" (Remote OK)
  const atMatch = title.match(/\bat\s+([A-Z][^–\-,\n]{2,50})(?:\s*[-–,]|$)/);
  if (atMatch) return atMatch[1].trim();
  return null;
}

function extractSalary(text: string): string | null {
  const patterns: RegExp[] = [
    /\$[\d,]+[kK]?\s*[-–to]+\s*\$[\d,]+[kK]?/,
    /USD\s*[\d,]+[kK]?\s*[-–to]+\s*[\d,]+[kK]?/i,
    /\$[\d,]{4,}(?:\s*[-–]\s*\$[\d,]+)?/,
    /[\d]+[kK]\s*[-–]\s*[\d]+[kK]\s*(?:USD|per\s+year|\/yr)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[0].trim();
  }
  return null;
}

function extractLocation(text: string): string | null {
  // "Headquarters: City, State"
  const hqMatch = text.match(/Headquarters?:\s*([^\n]{2,60})/i);
  if (hqMatch) return hqMatch[1].split(/[,\n]/)[0]?.trim() ?? null;
  // "Location: ..."
  const locMatch = text.match(/Location:\s*([^\n]{2,60})/i);
  if (locMatch) return locMatch[1].split(/[,\n]/)[0]?.trim() ?? null;
  return null;
}

export default router;

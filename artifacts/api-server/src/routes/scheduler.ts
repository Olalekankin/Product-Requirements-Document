import { Router } from "express";
import { desc, eq, and, gte, sql } from "drizzle-orm";
import { db, schedulerRunsTable, jobsTable, sourcesTable, keywordsTable, settingsTable } from "@workspace/db";
import { ListSchedulerRunsQueryParams } from "@workspace/api-zod";
import { summarizeJob } from "../lib/gemini";
import { logger } from "../lib/logger";

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

  const nextRunAt = lastRunAt
    ? getNextRunAt(lastRunAt, frequency)
    : null;

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
    case "15min":
      next.setMinutes(next.getMinutes() + 15);
      break;
    case "1hour":
      next.setHours(next.getHours() + 1);
      break;
    case "2xdaily":
      next.setHours(next.getHours() + 12);
      break;
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    default:
      next.setHours(next.getHours() + 1);
  }
  return next;
}

// POST /scheduler/trigger
router.post("/scheduler/trigger", async (req, res): Promise<void> => {
  if (isScanning) {
    res.json({
      jobsFound: 0,
      jobsAdded: 0,
      jobsDuplicated: 0,
      runId: -1,
      durationMs: 0,
    });
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
    // Fetch enabled keywords and sources
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

    // Simulate job discovery from public RSS sources
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

      // Update source stats
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
      .set({
        status: "completed",
        jobsFound: discoveredJobs.length,
        jobsAdded,
        jobsDuplicated,
        finishedAt: lastRunAt,
        durationMs,
      })
      .where(eq(schedulerRunsTable.id, runId));

    isScanning = false;
    res.json({ jobsFound: discoveredJobs.length, jobsAdded, jobsDuplicated, runId, durationMs });
  } catch (err) {
    const durationMs = Date.now() - runStart;
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Scan failed");

    await db
      .update(schedulerRunsTable)
      .set({
        status: "failed",
        finishedAt: new Date(),
        durationMs,
        errorMessage,
      })
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

// ── Job discovery helpers ─────────────────────────────────────────────────────

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
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return [];

    const xml = await response.text();
    const jobs: RawJob[] = [];

    // Simple XML item extraction
    const items = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) ?? [];

    for (const item of items.slice(0, 10)) {
      const title = extractXmlTag(item, "title");
      const link = extractXmlTag(item, "link");
      const description = extractXmlTag(item, "description");
      const pubDate = extractXmlTag(item, "pubDate");

      if (!title || !link) continue;

      // Filter by keywords
      const matchesKeyword = keywords.some(
        (kw) =>
          title.toLowerCase().includes(kw.toLowerCase()) ||
          (description?.toLowerCase().includes(kw.toLowerCase()) ?? false),
      );

      if (!matchesKeyword) continue;

      jobs.push({
        title: cleanHtml(title),
        company: extractCompanyFromTitle(title) ?? "Unknown Company",
        source: sourceSlug,
        url: link,
        description: description ? cleanHtml(description).slice(0, 5000) : undefined,
        remote: title.toLowerCase().includes("remote") || description?.toLowerCase().includes("remote"),
        postedAt: pubDate ?? undefined,
        tags: extractTags(title + " " + (description ?? ""), keywords),
      });
    }

    return jobs;
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

function extractXmlTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i")) ??
    xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1]?.trim() ?? null;
}

function cleanHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractCompanyFromTitle(title: string): string | null {
  const atMatch = title.match(/ at (.+?)(?:\s*[-–]|$)/i);
  if (atMatch) return atMatch[1].trim();
  const dashMatch = title.match(/ [-–] (.+)$/);
  if (dashMatch) return dashMatch[1].trim();
  return null;
}

function extractTags(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw.toLowerCase()));
}

export default router;

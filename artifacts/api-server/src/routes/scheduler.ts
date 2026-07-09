import { Router } from "express";
import { desc, eq, gte, sql } from "drizzle-orm";
import {
  db, jobCandidatesTable, schedulerRunsTable, sourcesTable, keywordsTable,
  settingsTable, jobsTable, scheduledPostsTable, socialConnectionsTable,
} from "@workspace/db";
import { ListSchedulerRunsQueryParams } from "@workspace/api-zod";
import { discoverJobs } from "../lib/source-adapters";
import { logger } from "../lib/logger";
import { publishDuePosts } from "./social-connections";
import { generateSocialPostContent } from "../lib/gemini";

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
    case "15min":    next.setMinutes(next.getMinutes() + 15); break;
    case "1hour":   next.setHours(next.getHours() + 1); break;
    case "2xdaily": next.setHours(next.getHours() + 12); break;
    case "daily":   next.setDate(next.getDate() + 1); break;
    case "6x_daily": next.setHours(next.getHours() + 4); break;
    default:        next.setHours(next.getHours() + 1);
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

    const discoveredJobs = await discoverJobs(sources, keywords.map((k) => k.term));

    const candidates = discoveredJobs.map((job) => ({
      sourceId: job.sourceId,
      source: job.source,
      sourceType: job.sourceType,
      url: job.url,
      title: job.title,
      company: job.company,
      description: job.description,
      salary: job.salary,
      location: job.location,
      employmentType: job.employmentType,
      remote: job.remote,
      postedAt: job.postedAt,
      tags: job.tags,
      rawData: job,
      status: "pending",
    }));

    if (candidates.length > 0) {
      await db.insert(jobCandidatesTable).values(candidates);
    }

    const durationMs = Date.now() - runStart;
    lastRunAt = new Date();

    await db
      .update(schedulerRunsTable)
      .set({
        status: "completed",
        jobsFound: discoveredJobs.length,
        jobsAdded: 0,
        jobsDuplicated: 0,
        finishedAt: lastRunAt,
        durationMs,
      })
      .where(eq(schedulerRunsTable.id, runId));

    isScanning = false;

    // ── Auto-Post: queue social posts for high-relevance new jobs ──────────────
    autoPostHighRelevanceJobs().catch((err) =>
      logger.warn({ err }, "autoPostHighRelevanceJobs failed")
    );

    publishDuePosts().catch((err) => logger.warn({ err }, "publishDuePosts failed"));

    res.json({ jobsFound: discoveredJobs.length, candidatesQueued: candidates.length, runId, durationMs });
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

// ── Auto-post helper: queue social posts for qualifying new jobs ───────────────

async function autoPostHighRelevanceJobs(): Promise<void> {
  const settings = await db.select().from(settingsTable).limit(1);
  const s = settings[0];
  if (!s?.autoPostEnabled) return;

  const minScore = s.autoPostMinScore ?? 85;

  // Find connections to post to
  const connections = await db.select().from(socialConnectionsTable);
  if (connections.length === 0) {
    logger.info("autoPost: no social connections configured, skipping");
    return;
  }

  // Find recently discovered jobs (last 2 hours) with high relevance
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const highRelevanceJobs = await db
    .select()
    .from(jobsTable)
    .where(gte(jobsTable.createdAt, twoHoursAgo));

  const qualifying = highRelevanceJobs.filter(
    (j) => j.relevanceScore !== null && j.relevanceScore >= minScore,
  );

  if (qualifying.length === 0) {
    logger.info({ minScore }, "autoPost: no qualifying high-relevance jobs found");
    return;
  }

  logger.info(
    { count: qualifying.length, minScore },
    "autoPost: queuing social posts for high-relevance jobs",
  );

  for (const job of qualifying) {
    for (const conn of connections) {
      try {
        const content = await generateSocialPostContent(
          job.title,
          job.company,
          job.url,
          conn.platform,
          "sharing",
        );

        // Schedule for immediate execution (now)
        await db.insert(scheduledPostsTable).values({
          jobId: job.id,
          connectionId: conn.id,
          platform: conn.platform,
          content,
          scheduledAt: new Date(),
          status: "pending",
        });

        logger.info(
          { jobId: job.id, platform: conn.platform },
          "autoPost: queued social post",
        );
      } catch (err) {
        logger.error(
          { err, jobId: job.id, platform: conn.platform },
          "autoPost: failed to generate/queue post",
        );
      }
    }
  }
}

export default router;


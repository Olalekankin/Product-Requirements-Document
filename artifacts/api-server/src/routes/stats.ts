import { Router } from "express";
import { desc, eq, sql, gte, count } from "drizzle-orm";
import { db, jobsTable, schedulerRunsTable } from "@workspace/db";
import { GetRecentActivityQueryParams } from "@workspace/api-zod";

const router = Router();

// GET /stats
router.get("/stats", async (_req, res): Promise<void> => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [totals, bySource, lastRun] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        newJobs: sql<number>`sum(case when ${jobsTable.status} = 'new' then 1 else 0 end)::int`,
        interested: sql<number>`sum(case when ${jobsTable.status} = 'interested' then 1 else 0 end)::int`,
        applied: sql<number>`sum(case when ${jobsTable.status} = 'applied' then 1 else 0 end)::int`,
        avgRelevance: sql<string>`avg(${jobsTable.relevanceScore})`,
        thisWeek: sql<number>`sum(case when ${jobsTable.createdAt} >= ${sevenDaysAgo.toISOString()} then 1 else 0 end)::int`,
      })
      .from(jobsTable),
    db
      .select({
        source: jobsTable.source,
        count: sql<number>`count(*)::int`,
      })
      .from(jobsTable)
      .groupBy(jobsTable.source)
      .orderBy(desc(sql`count(*)`))
      .limit(5),
    db
      .select({ startedAt: schedulerRunsTable.startedAt })
      .from(schedulerRunsTable)
      .where(eq(schedulerRunsTable.status, "completed"))
      .orderBy(desc(schedulerRunsTable.startedAt))
      .limit(1),
  ]);

  const row = totals[0];

  res.json({
    totalJobs: row?.total ?? 0,
    newJobs: row?.newJobs ?? 0,
    interestedJobs: row?.interested ?? 0,
    appliedJobs: row?.applied ?? 0,
    topSources: bySource,
    averageRelevance: row?.avgRelevance ? Number(parseFloat(String(row.avgRelevance)).toFixed(1)) : null,
    jobsThisWeek: row?.thisWeek ?? 0,
    lastScanAt: lastRun[0]?.startedAt?.toISOString() ?? null,
  });
});

// GET /stats/recent-activity
router.get("/stats/recent-activity", async (req, res): Promise<void> => {
  const parsed = GetRecentActivityQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 10) : 10;

  const jobs = await db
    .select({
      id: jobsTable.id,
      title: jobsTable.title,
      company: jobsTable.company,
      status: jobsTable.status,
      createdAt: jobsTable.createdAt,
    })
    .from(jobsTable)
    .orderBy(desc(jobsTable.createdAt))
    .limit(limit);

  const activity = jobs.map((j) => ({
    id: j.id,
    type: "discovered" as const,
    jobTitle: j.title,
    company: j.company,
    jobId: j.id,
    meta: j.status,
    timestamp: j.createdAt.toISOString(),
  }));

  res.json(activity);
});

// GET /stats/by-source
router.get("/stats/by-source", async (_req, res): Promise<void> => {
  const result = await db
    .select({
      source: jobsTable.source,
      count: sql<number>`count(*)::int`,
    })
    .from(jobsTable)
    .groupBy(jobsTable.source)
    .orderBy(desc(sql`count(*)`));

  res.json(result);
});

// GET /stats/by-status
router.get("/stats/by-status", async (_req, res): Promise<void> => {
  const result = await db
    .select({
      status: jobsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(jobsTable)
    .groupBy(jobsTable.status)
    .orderBy(desc(sql`count(*)`));

  res.json(result);
});

export default router;

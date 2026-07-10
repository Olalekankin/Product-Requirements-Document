import { Router } from "express";
import os from "node:os";
import { db, jobCandidatesTable } from "@workspace/db";
import { isAgentRunning } from "../workers/agent-runner";
import { sql, desc } from "drizzle-orm";

const router = Router();

// GET /agent/status
router.get("/agent/status", async (_req, res) => {
  const lastProcessed = await db
    .select()
    .from(jobCandidatesTable)
    .where(sql`${jobCandidatesTable.processedAt} IS NOT NULL`)
    .orderBy(desc(jobCandidatesTable.processedAt))
    .limit(1);

  const recentCountResult = await db
    .select({ count: sql`count(*)::int` })
    .from(jobCandidatesTable)
    .where(sql`${jobCandidatesTable.processedAt} IS NOT NULL`);

  res.json({
    isAgentRunning,
    startAgentInProcess: process.env.START_AGENT_IN_PROCESS !== "false",
    host: os.hostname(),
    pid: process.pid,
    lastProcessed: lastProcessed[0] ?? null,
    processedCountTotal: recentCountResult[0]?.count ?? 0,
  });
});

export default router;

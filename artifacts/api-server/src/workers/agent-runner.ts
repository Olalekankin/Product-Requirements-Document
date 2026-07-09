import { loadEnv } from "../lib/load-env";
import { logger } from "../lib/logger";
import { eq } from "drizzle-orm";
import { db, jobCandidatesTable, jobsTable } from "@workspace/db";
import { summarizeJob } from "../lib/gemini";

loadEnv();

const POLL_INTERVAL_MS = 10_000;
const MAX_BATCH = 5;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processNextBatch(): Promise<boolean> {
  const candidates = await db
    .select()
    .from(jobCandidatesTable)
    .where(eq(jobCandidatesTable.status, "pending"))
    .limit(MAX_BATCH);

  if (candidates.length === 0) {
    return false;
  }

  for (const candidate of candidates) {
    try {
      const existing = await db
        .select({ id: jobsTable.id })
        .from(jobsTable)
        .where(eq(jobsTable.url, candidate.url))
        .limit(1);

      if (existing[0]) {
        await db
          .update(jobCandidatesTable)
          .set({ status: "duplicate", processedAt: new Date() })
          .where(eq(jobCandidatesTable.id, candidate.id));
        logger.info({ candidateId: candidate.id, url: candidate.url }, "Candidate already exists as job");
        continue;
      }

      const keywords = candidate.tags ?? [];
      const aiResult = await summarizeJob(
        candidate.title,
        candidate.company,
        candidate.description ?? "",
        keywords,
      );

      await db.insert(jobsTable).values({
        title: candidate.title,
        company: candidate.company,
        source: candidate.source,
        url: candidate.url,
        description: candidate.description,
        salary: aiResult.salary ?? candidate.salary,
        location: candidate.location,
        employmentType: candidate.employmentType,
        remote: aiResult.remote ?? candidate.remote,
        postedAt: candidate.postedAt,
        tags: candidate.tags,
        aiSummary: aiResult.summary,
        aiRequirements: aiResult.requirements,
        aiWhyFits: aiResult.whyFits,
        aiSeniority: aiResult.seniority,
        aiTechnologies: aiResult.technologies ?? [],
        relevanceScore: aiResult.relevanceScore,
      });

      await db
        .update(jobCandidatesTable)
        .set({ status: "processed", processedAt: new Date() })
        .where(eq(jobCandidatesTable.id, candidate.id));

      logger.info({ candidateId: candidate.id, url: candidate.url }, "Processed candidate into job");
    } catch (err) {
      logger.error({ err, candidateId: candidate.id, url: candidate.url }, "Failed processing candidate");
      await db
        .update(jobCandidatesTable)
        .set({ status: "failed", errorMessage: err instanceof Error ? err.message : String(err), processedAt: new Date() })
        .where(eq(jobCandidatesTable.id, candidate.id));
    }
  }

  return true;
}

async function run() {
  logger.info("Agent runner starting");

  while (true) {
    try {
      const hadWork = await processNextBatch();
      if (!hadWork) {
        await sleep(POLL_INTERVAL_MS);
      }
    } catch (err) {
      logger.error({ err }, "Agent runner encountered an unexpected error");
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

run().catch((err) => {
  logger.error({ err }, "Agent runner crashed");
  process.exit(1);
});

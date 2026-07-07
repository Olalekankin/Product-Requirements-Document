import { Router } from "express";
import { eq, desc, asc, ilike, and, gte, sql, or } from "drizzle-orm";
import { db, jobsTable } from "@workspace/db";
import {
  ListJobsQueryParams,
  GetJobParams,
  UpdateJobParams,
  UpdateJobBody,
  DeleteJobParams,
  SummarizeJobParams,
} from "@workspace/api-zod";
import { summarizeJob } from "../lib/gemini";
import { keywordsTable } from "@workspace/db";

const router = Router();

// GET /jobs
router.get("/jobs", async (req, res): Promise<void> => {
  const parsed = ListJobsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const {
    status,
    source,
    search,
    minRelevance,
    sortBy = "createdAt",
    sortDir = "desc",
    page = 1,
    limit = 20,
    favorite,
    employmentType,
  } = parsed.data;

  const conditions = [];
  if (status) conditions.push(eq(jobsTable.status, status));
  if (source) conditions.push(eq(jobsTable.source, source));
  if (search) {
    conditions.push(
      or(
        ilike(jobsTable.title, `%${search}%`),
        ilike(jobsTable.company, `%${search}%`),
      ),
    );
  }
  if (minRelevance != null)
    conditions.push(gte(jobsTable.relevanceScore, minRelevance));
  if (favorite != null) conditions.push(eq(jobsTable.favorite, favorite));
  if (employmentType)
    conditions.push(eq(jobsTable.employmentType, employmentType));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const colMap: Record<string, any> = {
    createdAt: jobsTable.createdAt,
    postedAt: jobsTable.postedAt,
    relevanceScore: jobsTable.relevanceScore,
    title: jobsTable.title,
    company: jobsTable.company,
  };

  const orderCol = colMap[sortBy] ?? jobsTable.createdAt;
  const orderFn = sortDir === "asc" ? asc : desc;

  const offset = (page - 1) * limit;

  const [jobs, countResult] = await Promise.all([
    db
      .select()
      .from(jobsTable)
      .where(where)
      .orderBy(orderFn(orderCol))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobsTable)
      .where(where),
  ]);

  const total = countResult[0]?.count ?? 0;

  res.json({ jobs, total, page, limit });
});

// GET /jobs/:id
router.get("/jobs/:id", async (req, res): Promise<void> => {
  const parsed = GetJobParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const job = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, parsed.data.id))
    .limit(1);

  if (!job[0]) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.json(job[0]);
});

// PATCH /jobs/:id
router.patch("/jobs/:id", async (req, res): Promise<void> => {
  const params = UpdateJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateJobBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updated = await db
    .update(jobsTable)
    .set(body.data)
    .where(eq(jobsTable.id, params.data.id))
    .returning();

  if (!updated[0]) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.json(updated[0]);
});

// DELETE /jobs/:id
router.delete("/jobs/:id", async (req, res): Promise<void> => {
  const parsed = DeleteJobParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await db.delete(jobsTable).where(eq(jobsTable.id, parsed.data.id));
  res.status(204).send();
});

// POST /jobs/:id/summarize
router.post("/jobs/:id/summarize", async (req, res): Promise<void> => {
  const parsed = SummarizeJobParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const job = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, parsed.data.id))
    .limit(1);

  if (!job[0]) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const keywords = await db
    .select()
    .from(keywordsTable)
    .where(eq(keywordsTable.enabled, true));

  const keywordTerms = keywords.map((k) => k.term);

  const summary = await summarizeJob(
    job[0].title,
    job[0].company,
    job[0].description ?? "",
    keywordTerms,
  );

  const updated = await db
    .update(jobsTable)
    .set({
      aiSummary: summary.summary,
      aiRequirements: summary.requirements,
      aiWhyFits: summary.whyFits,
      aiSeniority: summary.seniority,
      aiTechnologies: summary.technologies,
      relevanceScore: summary.relevanceScore,
      salary: summary.salary ?? job[0].salary,
      remote: summary.remote ?? job[0].remote,
    })
    .where(eq(jobsTable.id, parsed.data.id))
    .returning();

  res.json(updated[0]);
});

export default router;

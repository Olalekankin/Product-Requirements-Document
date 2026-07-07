import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, jobsTable, socialPostsTable } from "@workspace/db";
import {
  GetSocialPostParams,
  GenerateSocialPostParams,
  GenerateSocialPostBody,
} from "@workspace/api-zod";
import { generateSocialPostContent } from "../lib/gemini";

const router = Router();

// GET /jobs/:jobId/social-post
router.get("/jobs/:jobId/social-post", async (req, res): Promise<void> => {
  const parsed = GetSocialPostParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const post = await db
    .select()
    .from(socialPostsTable)
    .where(eq(socialPostsTable.jobId, parsed.data.jobId))
    .orderBy(socialPostsTable.createdAt)
    .limit(1);

  if (!post[0]) {
    res.status(404).json({ error: "No social post generated yet" });
    return;
  }

  res.json(post[0]);
});

// POST /jobs/:jobId/social-post
router.post("/jobs/:jobId/social-post", async (req, res): Promise<void> => {
  const params = GenerateSocialPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = GenerateSocialPostBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const job = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, params.data.jobId))
    .limit(1);

  if (!job[0]) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const content = await generateSocialPostContent(
    job[0].title,
    job[0].company,
    job[0].url,
    body.data.platform,
    body.data.tone ?? "interesting",
  );

  // Upsert: delete old post for this job+platform then insert new
  await db
    .delete(socialPostsTable)
    .where(
      and(
        eq(socialPostsTable.jobId, params.data.jobId),
        eq(socialPostsTable.platform, body.data.platform),
      ),
    );

  const created = await db
    .insert(socialPostsTable)
    .values({
      jobId: params.data.jobId,
      platform: body.data.platform,
      content,
      tone: body.data.tone ?? "interesting",
    })
    .returning();

  res.json(created[0]);
});

export default router;

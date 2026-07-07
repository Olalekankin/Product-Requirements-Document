import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, keywordsTable } from "@workspace/db";
import {
  CreateKeywordBody,
  UpdateKeywordParams,
  UpdateKeywordBody,
  DeleteKeywordParams,
} from "@workspace/api-zod";

const router = Router();

// GET /keywords
router.get("/keywords", async (_req, res): Promise<void> => {
  const keywords = await db.select().from(keywordsTable).orderBy(keywordsTable.term);
  res.json(keywords);
});

// POST /keywords
router.post("/keywords", async (req, res): Promise<void> => {
  const parsed = CreateKeywordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const created = await db
    .insert(keywordsTable)
    .values({ term: parsed.data.term, enabled: parsed.data.enabled ?? true })
    .returning();

  res.status(201).json(created[0]);
});

// PATCH /keywords/:id
router.patch("/keywords/:id", async (req, res): Promise<void> => {
  const params = UpdateKeywordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateKeywordBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updated = await db
    .update(keywordsTable)
    .set(body.data)
    .where(eq(keywordsTable.id, params.data.id))
    .returning();

  if (!updated[0]) {
    res.status(404).json({ error: "Keyword not found" });
    return;
  }

  res.json(updated[0]);
});

// DELETE /keywords/:id
router.delete("/keywords/:id", async (req, res): Promise<void> => {
  const parsed = DeleteKeywordParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await db.delete(keywordsTable).where(eq(keywordsTable.id, parsed.data.id));
  res.status(204).send();
});

export default router;

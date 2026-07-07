import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, sourcesTable } from "@workspace/db";
import {
  CreateSourceBody,
  UpdateSourceParams,
  UpdateSourceBody,
  DeleteSourceParams,
} from "@workspace/api-zod";

const router = Router();

// GET /sources
router.get("/sources", async (_req, res): Promise<void> => {
  const sources = await db.select().from(sourcesTable).orderBy(sourcesTable.name);
  res.json(sources);
});

// POST /sources
router.post("/sources", async (req, res): Promise<void> => {
  const parsed = CreateSourceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const created = await db
    .insert(sourcesTable)
    .values({
      name: parsed.data.name,
      slug: parsed.data.slug,
      type: parsed.data.type,
      url: parsed.data.url ?? null,
      enabled: parsed.data.enabled ?? true,
    })
    .returning();

  res.status(201).json(created[0]);
});

// PATCH /sources/:id
router.patch("/sources/:id", async (req, res): Promise<void> => {
  const params = UpdateSourceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateSourceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updated = await db
    .update(sourcesTable)
    .set(body.data)
    .where(eq(sourcesTable.id, params.data.id))
    .returning();

  if (!updated[0]) {
    res.status(404).json({ error: "Source not found" });
    return;
  }

  res.json(updated[0]);
});

// DELETE /sources/:id
router.delete("/sources/:id", async (req, res): Promise<void> => {
  const parsed = DeleteSourceParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await db.delete(sourcesTable).where(eq(sourcesTable.id, parsed.data.id));
  res.status(204).send();
});

export default router;

import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, notesTable } from "@workspace/db";
import {
  ListNotesParams,
  CreateNoteParams,
  CreateNoteBody,
  UpdateNoteParams,
  UpdateNoteBody,
  DeleteNoteParams,
} from "@workspace/api-zod";

const router = Router();

// GET /jobs/:jobId/notes
router.get("/jobs/:jobId/notes", async (req, res): Promise<void> => {
  const parsed = ListNotesParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const notes = await db
    .select()
    .from(notesTable)
    .where(eq(notesTable.jobId, parsed.data.jobId))
    .orderBy(notesTable.createdAt);

  res.json(notes);
});

// POST /jobs/:jobId/notes
router.post("/jobs/:jobId/notes", async (req, res): Promise<void> => {
  const params = CreateNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = CreateNoteBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const created = await db
    .insert(notesTable)
    .values({ jobId: params.data.jobId, content: body.data.content })
    .returning();

  res.status(201).json(created[0]);
});

// PATCH /jobs/:jobId/notes/:id
router.patch("/jobs/:jobId/notes/:id", async (req, res): Promise<void> => {
  const params = UpdateNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateNoteBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updated = await db
    .update(notesTable)
    .set({ content: body.data.content })
    .where(and(eq(notesTable.id, params.data.id), eq(notesTable.jobId, params.data.jobId)))
    .returning();

  if (!updated[0]) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  res.json(updated[0]);
});

// DELETE /jobs/:jobId/notes/:id
router.delete("/jobs/:jobId/notes/:id", async (req, res): Promise<void> => {
  const parsed = DeleteNoteParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await db
    .delete(notesTable)
    .where(and(eq(notesTable.id, parsed.data.id), eq(notesTable.jobId, parsed.data.jobId)));

  res.status(204).send();
});

export default router;

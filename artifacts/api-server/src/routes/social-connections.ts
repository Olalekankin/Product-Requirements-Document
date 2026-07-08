/**
 * Social connection management + publish/schedule endpoints.
 */

import { Router } from "express";
import { and, eq, lte } from "drizzle-orm";
import { db, socialConnectionsTable, scheduledPostsTable } from "@workspace/db";

const router = Router();

// ── Connections ───────────────────────────────────────────────────────────────

/** GET /api/social-connections */
router.get("/social-connections", async (_req, res) => {
  const rows = await db
    .select({
      id: socialConnectionsTable.id,
      platform: socialConnectionsTable.platform,
      handle: socialConnectionsTable.handle,
      platformUserId: socialConnectionsTable.platformUserId,
      tokenExpiry: socialConnectionsTable.tokenExpiry,
      connectedAt: socialConnectionsTable.connectedAt,
    })
    .from(socialConnectionsTable);
  res.json(rows);
});

/** DELETE /api/social-connections/:id */
router.delete("/social-connections/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(socialConnectionsTable).where(eq(socialConnectionsTable.id, id));
  res.json({ success: true });
});

// ── Publish now ───────────────────────────────────────────────────────────────

/** POST /api/social-connections/:id/publish */
router.post("/social-connections/:id/publish", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { content } = req.body as { content: string };

  if (!content?.trim()) { res.status(400).json({ error: "content is required" }); return; }

  const [conn] = await db
    .select()
    .from(socialConnectionsTable)
    .where(eq(socialConnectionsTable.id, id));

  if (!conn) { res.status(404).json({ error: "Connection not found" }); return; }

  try {
    let token = conn.accessToken;

    // Auto-refresh Twitter token if expired
    if (conn.platform === "twitter" && conn.tokenExpiry && new Date() >= conn.tokenExpiry) {
      token = await refreshTwitterToken(conn);
    }

    let platformPostId: string;
    if (conn.platform === "twitter") {
      platformPostId = await tweetPost(token, content);
    } else if (conn.platform === "linkedin") {
      platformPostId = await linkedinPost(token, conn.platformUserId!, content);
    } else {
      res.status(400).json({ error: `Unsupported platform: ${conn.platform}` });
      return;
    }

    res.json({ success: true, platformPostId, platform: conn.platform });
  } catch (err: any) {
    console.error("Publish error:", err);
    res.status(500).json({ error: err.message ?? "Failed to publish" });
  }
});

// ── Schedule ──────────────────────────────────────────────────────────────────

/** POST /api/social-connections/:id/schedule */
router.post("/social-connections/:id/schedule", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { content, scheduledAt, jobId } = req.body as {
    content: string;
    scheduledAt: string;
    jobId?: number;
  };

  if (!content?.trim() || !scheduledAt) {
    res.status(400).json({ error: "content and scheduledAt are required" });
    return;
  }

  const scheduledDate = new Date(scheduledAt);
  if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
    res.status(400).json({ error: "scheduledAt must be a valid future datetime" });
    return;
  }

  const [conn] = await db
    .select({ id: socialConnectionsTable.id, platform: socialConnectionsTable.platform })
    .from(socialConnectionsTable)
    .where(eq(socialConnectionsTable.id, id));

  if (!conn) { res.status(404).json({ error: "Connection not found" }); return; }

  const [post] = await db
    .insert(scheduledPostsTable)
    .values({
      jobId: jobId ?? null,
      connectionId: id,
      platform: conn.platform,
      content: content.trim(),
      scheduledAt: scheduledDate,
      status: "pending",
    })
    .returning();

  res.json(post);
});

// ── Scheduled posts list + cancel ─────────────────────────────────────────────

/** GET /api/scheduled-posts */
router.get("/scheduled-posts", async (_req, res) => {
  const posts = await db
    .select()
    .from(scheduledPostsTable)
    .orderBy(scheduledPostsTable.scheduledAt);
  res.json(posts);
});

/** DELETE /api/scheduled-posts/:id — cancel a pending post */
router.delete("/scheduled-posts/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db
    .update(scheduledPostsTable)
    .set({ status: "cancelled" })
    .where(and(eq(scheduledPostsTable.id, id), eq(scheduledPostsTable.status, "pending")));

  res.json({ success: true });
});

// ── Scheduler hook: fire pending posts that are due ───────────────────────────

export async function publishDuePosts() {
  const now = new Date();
  const due = await db
    .select()
    .from(scheduledPostsTable)
    .where(and(eq(scheduledPostsTable.status, "pending"), lte(scheduledPostsTable.scheduledAt, now)));

  for (const post of due) {
    if (!post.connectionId) continue;
    const [conn] = await db
      .select()
      .from(socialConnectionsTable)
      .where(eq(socialConnectionsTable.id, post.connectionId));

    if (!conn) {
      await db.update(scheduledPostsTable)
        .set({ status: "failed", errorMessage: "Connection no longer exists" })
        .where(eq(scheduledPostsTable.id, post.id));
      continue;
    }

    try {
      let token = conn.accessToken;
      if (conn.platform === "twitter" && conn.tokenExpiry && new Date() >= conn.tokenExpiry) {
        token = await refreshTwitterToken(conn);
      }

      let platformPostId: string;
      if (conn.platform === "twitter") {
        platformPostId = await tweetPost(token, post.content);
      } else if (conn.platform === "linkedin") {
        platformPostId = await linkedinPost(token, conn.platformUserId!, post.content);
      } else {
        throw new Error(`Unsupported platform: ${conn.platform}`);
      }

      await db.update(scheduledPostsTable)
        .set({ status: "posted", platformPostId, postedAt: new Date() })
        .where(eq(scheduledPostsTable.id, post.id));
    } catch (err: any) {
      await db.update(scheduledPostsTable)
        .set({ status: "failed", errorMessage: err.message })
        .where(eq(scheduledPostsTable.id, post.id));
    }
  }
}

// ── Platform helpers ──────────────────────────────────────────────────────────

async function refreshTwitterToken(conn: { id: number; refreshToken: string | null }): Promise<string> {
  if (!conn.refreshToken) throw new Error("No refresh token — please reconnect Twitter/X");

  const res = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: conn.refreshToken,
      client_id: process.env.TWITTER_CLIENT_ID!,
    }),
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);

  const tokens = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);
  await db.update(socialConnectionsTable)
    .set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? conn.refreshToken,
      tokenExpiry,
      updatedAt: new Date(),
    })
    .where(eq(socialConnectionsTable.id, conn.id));

  return tokens.access_token;
}

async function tweetPost(token: string, content: string): Promise<string> {
  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: content }),
  });

  if (!res.ok) throw new Error(`Twitter post failed (${res.status}): ${await res.text()}`);
  const data = await res.json() as { data: { id: string } };
  return data.data.id;
}

async function linkedinPost(token: string, platformUserId: string, content: string): Promise<string> {
  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: `urn:li:person:${platformUserId}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: content },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    }),
  });

  if (!res.ok) throw new Error(`LinkedIn post failed (${res.status}): ${await res.text()}`);
  return res.headers.get("x-restli-id") ?? "unknown";
}

export default router;

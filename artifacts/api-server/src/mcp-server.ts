import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Router } from "express";
import { db, jobsTable, socialConnectionsTable, scheduledPostsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { generateSocialPostContent } from "./lib/gemini";
import { logger } from "./lib/logger";

// ── MCP Server Initialization ───────────────────────────────────────────────
const server = new Server(
  {
    name: "job-scout-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ── Tool Definitions ────────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_jobs",
        description: "List job listings stored in the system, ordered by creation date.",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "integer",
              description: "Number of jobs to retrieve (default: 10, max: 50)",
              default: 10,
            },
          },
        },
      },
      {
        name: "get_job_details",
        description: "Get detailed information about a single job by ID, including notes and social posts.",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              description: "The job ID",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "generate_social_post",
        description: "Generate a social media post draft using Gemini AI for a specific job.",
        inputSchema: {
          type: "object",
          properties: {
            jobId: {
              type: "integer",
              description: "The job ID to generate content for",
            },
            platform: {
              type: "string",
              description: "The platform ('twitter' or 'linkedin')",
              enum: ["twitter", "linkedin"],
            },
            tone: {
              type: "string",
              description: "Tone instruction ('sharing', 'applying', 'interesting')",
              enum: ["sharing", "applying", "interesting"],
              default: "sharing",
            },
          },
          required: ["jobId", "platform"],
        },
      },
      {
        name: "publish_social_post",
        description: "Publish content immediately to a connected social platform.",
        inputSchema: {
          type: "object",
          properties: {
            platform: {
              type: "string",
              description: "The platform ('twitter' or 'linkedin')",
              enum: ["twitter", "linkedin"],
            },
            content: {
              type: "string",
              description: "The content post text to publish",
            },
          },
          required: ["platform", "content"],
        },
      },
      {
        name: "schedule_social_post",
        description: "Schedule a post draft for publication at a future time.",
        inputSchema: {
          type: "object",
          properties: {
            jobId: {
              type: "integer",
              description: "The job ID associated with this post",
            },
            platform: {
              type: "string",
              description: "The platform ('twitter' or 'linkedin')",
              enum: ["twitter", "linkedin"],
            },
            content: {
              type: "string",
              description: "The content post text",
            },
            scheduledAt: {
              type: "string",
              description: "The ISO-8601 datetime string representing the future time (e.g. 2026-07-09T10:00:00Z)",
            },
          },
          required: ["jobId", "platform", "content", "scheduledAt"],
        },
      },
    ],
  };
});

// Helper functions for real publishing
async function refreshTwitterToken(conn: any): Promise<string> {
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

  const tokens = (await res.json()) as any;
  const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);
  await db
    .update(socialConnectionsTable)
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
  const data = (await res.json()) as any;
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

// ── Tool Handlers ───────────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_jobs": {
        const limit = Math.min((args?.limit as number) ?? 10, 50);
        const jobs = await db
          .select()
          .from(jobsTable)
          .orderBy(desc(jobsTable.createdAt))
          .limit(limit);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(jobs, null, 2),
            },
          ],
        };
      }

      case "get_job_details": {
        const id = args?.id as number;
        const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, id));
        if (!job) {
          return {
            content: [{ type: "text", text: `Job with ID ${id} not found.` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(job, null, 2),
            },
          ],
        };
      }

      case "generate_social_post": {
        const jobId = args?.jobId as number;
        const platform = args?.platform as string;
        const tone = (args?.tone as string) ?? "sharing";

        const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
        if (!job) {
          return {
            content: [{ type: "text", text: `Job with ID ${jobId} not found.` }],
            isError: true,
          };
        }

        const draft = await generateSocialPostContent(
          job.title,
          job.company,
          job.url,
          platform,
          tone
        );

        return {
          content: [
            {
              type: "text",
              text: draft,
            },
          ],
        };
      }

      case "publish_social_post": {
        const platform = args?.platform as string;
        const content = args?.content as string;

        const [conn] = await db
          .select()
          .from(socialConnectionsTable)
          .where(eq(socialConnectionsTable.platform, platform));

        if (!conn) {
          return {
            content: [{ type: "text", text: `No connection found for ${platform.toUpperCase()}. Please configure it first.` }],
            isError: true,
          };
        }

        let token = conn.accessToken;
        if (conn.platform === "twitter" && conn.tokenExpiry && new Date() >= conn.tokenExpiry) {
          token = await refreshTwitterToken(conn);
        }

        let postId: string;
        if (platform === "twitter") {
          postId = await tweetPost(token, content);
        } else if (platform === "linkedin") {
          postId = await linkedinPost(token, conn.platformUserId!, content);
        } else {
          throw new Error(`Unsupported platform: ${platform}`);
        }

        return {
          content: [
            {
              type: "text",
              text: `Successfully posted to ${platform.toUpperCase()}! Post ID: ${postId}`,
            },
          ],
        };
      }

      case "schedule_social_post": {
        const jobId = args?.jobId as number;
        const platform = args?.platform as string;
        const content = args?.content as string;
        const scheduledAt = new Date(args?.scheduledAt as string);

        if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
          return {
            content: [{ type: "text", text: "scheduledAt must be a valid future datetime." }],
            isError: true,
          };
        }

        const [conn] = await db
          .select()
          .from(socialConnectionsTable)
          .where(eq(socialConnectionsTable.platform, platform));

        if (!conn) {
          return {
            content: [{ type: "text", text: `No connection found for ${platform.toUpperCase()}. Please configure it first.` }],
            isError: true,
          };
        }

        const [post] = await db
          .insert(scheduledPostsTable)
          .values({
            jobId,
            connectionId: conn.id,
            platform,
            content,
            scheduledAt,
            status: "pending",
          })
          .returning();

        return {
          content: [
            {
              type: "text",
              text: `Scheduled post successfully! ID: ${post.id}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Tool not found: ${name}`);
    }
  } catch (err: any) {
    logger.error({ err, name }, "MCP tool execution failed");
    return {
      content: [{ type: "text", text: `Error: ${err.message ?? String(err)}` }],
      isError: true,
    };
  }
});

// ── Express Router for SSE Transport ─────────────────────────────────────────
const router = Router();
const activeTransports = new Map<string, SSEServerTransport>();

router.get("/mcp", async (req, res) => {
  const sessionId = Math.random().toString(36).substring(2);
  const transport = new SSEServerTransport(`/api/mcp/message?sessionId=${sessionId}`, res);

  activeTransports.set(sessionId, transport);
  logger.info({ sessionId }, "MCP client connected via SSE");

  res.on("close", () => {
    activeTransports.delete(sessionId);
    logger.info({ sessionId }, "MCP client disconnected");
  });

  await server.connect(transport);
});

router.post("/mcp/message", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = activeTransports.get(sessionId);

  if (!transport) {
    res.status(400).send("Session not found or expired");
    return;
  }

  await transport.handlePostMessage(req, res);
});

export default router;

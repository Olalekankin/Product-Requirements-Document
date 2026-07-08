import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs";
import { socialConnectionsTable } from "./social_connections";

export const scheduledPostsTable = pgTable("scheduled_posts", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobsTable.id, { onDelete: "cascade" }),
  connectionId: integer("connection_id").references(() => socialConnectionsTable.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  content: text("content").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  // pending | posted | failed | cancelled
  status: text("status").notNull().default("pending"),
  platformPostId: text("platform_post_id"),
  errorMessage: text("error_message"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ScheduledPost = typeof scheduledPostsTable.$inferSelect;
export type InsertScheduledPost = typeof scheduledPostsTable.$inferInsert;

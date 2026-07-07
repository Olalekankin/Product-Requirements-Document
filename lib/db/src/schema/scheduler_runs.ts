import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const schedulerRunsTable = pgTable("scheduler_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull().default("running"), // running | completed | failed
  jobsFound: integer("jobs_found").notNull().default(0),
  jobsAdded: integer("jobs_added").notNull().default(0),
  jobsDuplicated: integer("jobs_duplicated").notNull().default(0),
  errorMessage: text("error_message"),
  durationMs: integer("duration_ms"),
});

export const insertSchedulerRunSchema = createInsertSchema(schedulerRunsTable).omit({
  id: true,
  startedAt: true,
});
export type InsertSchedulerRun = z.infer<typeof insertSchedulerRunSchema>;
export type SchedulerRun = typeof schedulerRunsTable.$inferSelect;

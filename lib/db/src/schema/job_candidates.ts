import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobCandidatesTable = pgTable("job_candidates", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull(),
  source: text("source").notNull(),
  sourceType: text("source_type").notNull().default("rss"),
  url: text("url").notNull(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  description: text("description"),
  salary: text("salary"),
  location: text("location"),
  employmentType: text("employment_type"),
  remote: boolean("remote"),
  postedAt: text("posted_at"),
  tags: text("tags").array().notNull().default([]),
  rawData: jsonb("raw_data"),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

export const insertJobCandidateSchema = createInsertSchema(jobCandidatesTable).omit({
  id: true,
  discoveredAt: true,
  processedAt: true,
});
export type InsertJobCandidate = z.infer<typeof insertJobCandidateSchema>;
export type JobCandidate = typeof jobCandidatesTable.$inferSelect;

import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobStatusEnum = [
  "new",
  "interested",
  "applied",
  "rejected",
  "ignored",
  "saved",
  "archived",
] as const;

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  source: text("source").notNull(),
  url: text("url").notNull().unique(),
  description: text("description"),
  status: text("status").notNull().default("new"),
  salary: text("salary"),
  location: text("location"),
  employmentType: text("employment_type"),
  remote: boolean("remote"),
  postedAt: text("posted_at"),
  tags: text("tags").array().notNull().default([]),
  favorite: boolean("favorite").notNull().default(false),
  // AI fields
  aiSummary: text("ai_summary"),
  aiRequirements: text("ai_requirements"),
  aiWhyFits: text("ai_why_fits"),
  aiSeniority: text("ai_seniority"),
  aiTechnologies: text("ai_technologies").array().notNull().default([]),
  relevanceScore: integer("relevance_score"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;

import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  schedulerFrequency: text("scheduler_frequency").notNull().default("1hour"),
  remoteOnly: boolean("remote_only").notNull().default(true),
  minRelevanceNotify: integer("min_relevance_notify").notNull().default(60),
  minSalary: integer("min_salary"),
  excludedKeywords: text("excluded_keywords").array().notNull().default([]),
  requiredTechnologies: text("required_technologies").array().notNull().default([]),
  blacklistedCompanies: text("blacklisted_companies").array().notNull().default([]),
  whitelistedCompanies: text("whitelisted_companies").array().notNull().default([]),
  employmentTypes: text("employment_types").array().notNull().default([]),
  experienceLevels: text("experience_levels").array().notNull().default([]),
  postedWithinDays: integer("posted_within_days"),
  emailNotifications: boolean("email_notifications").notNull().default(false),
  inAppNotifications: boolean("in_app_notifications").notNull().default(true),
  autoPostEnabled: boolean("auto_post_enabled").notNull().default(false),
  autoPostMinScore: integer("auto_post_min_score").notNull().default(85),
  autoDiscoverEnabled: boolean("auto_discover_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;

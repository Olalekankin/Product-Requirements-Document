import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const socialConnectionsTable = pgTable("social_connections", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull(), // "twitter" | "linkedin"
  handle: text("handle").notNull(),     // @username or display name
  platformUserId: text("platform_user_id"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry", { withTimezone: true }),
  scope: text("scope"),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SocialConnection = typeof socialConnectionsTable.$inferSelect;
export type InsertSocialConnection = typeof socialConnectionsTable.$inferInsert;

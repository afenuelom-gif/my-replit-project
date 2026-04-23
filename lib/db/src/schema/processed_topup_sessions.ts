import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const processedTopupSessionsTable = pgTable("processed_topup_sessions", {
  sessionId: text("session_id").primaryKey(),
  userId: text("user_id").notNull(),
  creditsAdded: integer("credits_added").notNull(),
  processedAt: timestamp("processed_at").notNull().defaultNow(),
});

import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  sessionCredits: integer("session_credits").notNull().default(0),
  trialUsed: integer("trial_used").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;

import { pgTable, text, timestamp, serial } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const loginEventsTable = pgTable("login_events", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  ipAddress: text("ip_address"),
  country: text("country"),
  city: text("city"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LoginEvent = typeof loginEventsTable.$inferSelect;
export type InsertLoginEvent = typeof loginEventsTable.$inferInsert;

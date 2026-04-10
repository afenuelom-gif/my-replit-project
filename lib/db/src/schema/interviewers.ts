import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const interviewersTable = pgTable("interviewers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  personality: text("personality").notNull(),
  voiceId: text("voice_id").notNull(),
  avatarUrl: text("avatar_url"),
  heygenAvatarId: text("heygen_avatar_id"),
  sessionId: integer("session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInterviewerSchema = createInsertSchema(interviewersTable).omit({ id: true, createdAt: true });
export type InsertInterviewer = z.infer<typeof insertInterviewerSchema>;
export type Interviewer = typeof interviewersTable.$inferSelect;

import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sessionsTable = pgTable("interview_sessions", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  jobRole: text("job_role").notNull(),
  jobDescription: text("job_description"),
  resumeText: text("resume_text"),
  durationMinutes: integer("duration_minutes").notNull().default(35),
  status: text("status").notNull().default("active"),
  interviewerIds: text("interviewer_ids").notNull(),
  currentInterviewerIndex: integer("current_interviewer_index").notNull().default(0),
  questionCount: integer("question_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;

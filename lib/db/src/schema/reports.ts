import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reportsTable = pgTable("interview_reports", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().unique(),
  overallScore: integer("overall_score").notNull(),
  communicationScore: integer("communication_score").notNull(),
  technicalScore: integer("technical_score").notNull(),
  confidenceScore: integer("confidence_score").notNull(),
  postureScore: integer("posture_score").notNull(),
  summary: text("summary").notNull(),
  suggestions: text("suggestions").notNull(),
  answerFeedback: text("answer_feedback").notNull(),
  postureNotes: text("posture_notes").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReportSchema = createInsertSchema(reportsTable).omit({ id: true, generatedAt: true });
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reportsTable.$inferSelect;

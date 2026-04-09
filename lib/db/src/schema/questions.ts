import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const questionsTable = pgTable("interview_questions", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  questionText: text("question_text").notNull(),
  answerText: text("answer_text"),
  interviewerId: integer("interviewer_id").notNull(),
  isFollowUp: boolean("is_follow_up").notNull().default(false),
  questionIndex: integer("question_index").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertQuestionSchema = createInsertSchema(questionsTable).omit({ id: true, createdAt: true });
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questionsTable.$inferSelect;

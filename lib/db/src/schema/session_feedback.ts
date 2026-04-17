import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sessionFeedbackTable = pgTable("session_feedback", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  userId: text("user_id"),
  jobRole: text("job_role").notNull(),
  questionRelevance: text("question_relevance").notNull(),
  feedbackHelpful: boolean("feedback_helpful").notNull(),
  additionalComments: text("additional_comments"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSessionFeedbackSchema = createInsertSchema(sessionFeedbackTable).omit({ id: true, createdAt: true });
export type InsertSessionFeedback = z.infer<typeof insertSessionFeedbackSchema>;
export type SessionFeedback = typeof sessionFeedbackTable.$inferSelect;

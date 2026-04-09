import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const postureAnalysisTable = pgTable("posture_analysis", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  score: integer("score").notNull(),
  feedback: text("feedback").notNull(),
  issues: text("issues").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPostureAnalysisSchema = createInsertSchema(postureAnalysisTable).omit({ id: true, createdAt: true });
export type InsertPostureAnalysis = z.infer<typeof insertPostureAnalysisSchema>;
export type PostureAnalysis = typeof postureAnalysisTable.$inferSelect;

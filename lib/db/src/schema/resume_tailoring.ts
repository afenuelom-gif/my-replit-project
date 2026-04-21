import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const resumeTailoringTable = pgTable("resume_tailoring", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  jobTitle: text("job_title"),
  scope: text("scope").notNull(),
  aggressiveness: text("aggressiveness").notNull(),
  originalResumeText: text("original_resume_text").notNull(),
  tailoredResumeText: text("tailored_resume_text").notNull(),
  changeSummary: text("change_summary").notNull(),
  atsKeywords: text("ats_keywords").notNull(),
  improvementSuggestions: text("improvement_suggestions").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ResumeTailoring = typeof resumeTailoringTable.$inferSelect;
export type InsertResumeTailoring = typeof resumeTailoringTable.$inferInsert;

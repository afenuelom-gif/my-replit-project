import { Router, type IRouter } from "express";
import { db, sessionsTable, reportsTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth.js";

const router: IRouter = Router();

router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  res.json({ userId: req.userId });
});

router.get("/users/me/sessions", requireAuth, async (req, res): Promise<void> => {
  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.userId, req.userId!))
    .orderBy(desc(sessionsTable.createdAt));

  const completedSessions = sessions.filter(s => s.status === "completed");
  const sessionIds = completedSessions.map(s => s.id);

  let reports: (typeof reportsTable.$inferSelect)[] = [];
  if (sessionIds.length > 0) {
    reports = await db
      .select()
      .from(reportsTable)
      .where(inArray(reportsTable.sessionId, sessionIds));
  }

  const reportBySessionId = new Map(reports.map(r => [r.sessionId, r]));

  const result = completedSessions.map(session => ({
    id: session.id,
    userId: session.userId,
    jobRole: session.jobRole,
    jobDescription: session.jobDescription,
    durationMinutes: session.durationMinutes,
    status: session.status,
    createdAt: session.createdAt,
    report: reportBySessionId.has(session.id)
      ? (({ overallScore, communicationScore, technicalScore, confidenceScore, postureScore }) => ({
          overallScore, communicationScore, technicalScore, confidenceScore, postureScore,
        }))(reportBySessionId.get(session.id)!)
      : null,
  }));

  res.json(result);
});

export default router;

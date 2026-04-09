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

  const sessionIds = sessions.map(s => s.id);

  let reports: (typeof reportsTable.$inferSelect)[] = [];
  if (sessionIds.length > 0) {
    reports = await db
      .select()
      .from(reportsTable)
      .where(inArray(reportsTable.sessionId, sessionIds));
  }

  const reportBySessionId = new Map(reports.map(r => [r.sessionId, r]));

  const result = sessions.map(session => ({
    ...session,
    report: reportBySessionId.get(session.id) ?? null,
  }));

  res.json(result);
});

export default router;

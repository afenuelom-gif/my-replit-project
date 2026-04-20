import { Router, type IRouter } from "express";
import { db, sessionsTable, reportsTable, usersTable, loginEventsTable } from "@workspace/db";
import { eq, desc, inArray, sql, max, count } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth.js";
import { isAdminUser, getAdminIds } from "../../lib/adminAuth.js";

const router: IRouter = Router();

router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  res.json({ userId: req.userId, isAdmin: isAdminUser(req.userId) });
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

function requireAdmin(req: Parameters<typeof requireAuth>[0], res: Parameters<typeof requireAuth>[1], next: Parameters<typeof requireAuth>[2]): void {
  const adminIds = getAdminIds();
  if (adminIds.length === 0) {
    res.status(403).json({ error: "Forbidden", code: "NO_ADMINS_CONFIGURED" });
    return;
  }
  if (!isAdminUser(req.userId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

router.get("/users/admin/users", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      sessionCredits: usersTable.sessionCredits,
      createdAt: usersTable.createdAt,
      totalLogins: count(loginEventsTable.id),
      lastLogin: max(loginEventsTable.createdAt),
      lastCountry: sql<string | null>`(
        SELECT country FROM login_events
        WHERE user_id = ${usersTable.id}
        ORDER BY created_at DESC
        LIMIT 1
      )`,
      lastCity: sql<string | null>`(
        SELECT city FROM login_events
        WHERE user_id = ${usersTable.id}
        ORDER BY created_at DESC
        LIMIT 1
      )`,
    })
    .from(usersTable)
    .leftJoin(loginEventsTable, eq(loginEventsTable.userId, usersTable.id))
    .groupBy(usersTable.id)
    .orderBy(desc(usersTable.createdAt));

  res.json(users);
});

router.get("/users/admin/users/:userId/login-events", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { userId } = req.params;

  const events = await db
    .select()
    .from(loginEventsTable)
    .where(eq(loginEventsTable.userId, userId))
    .orderBy(desc(loginEventsTable.createdAt));

  res.json(events);
});

export default router;

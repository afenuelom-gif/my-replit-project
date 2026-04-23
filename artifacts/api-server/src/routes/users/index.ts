import { Router, type IRouter } from "express";
import { db, sessionsTable, reportsTable, usersTable, loginEventsTable, resumeTailoringTable } from "@workspace/db";
import { eq, and, desc, inArray, sql, max, count } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth.js";
import { isAdminUserOrEmail, hasAnyAdminConfigured } from "../../lib/adminAuth.js";

const router: IRouter = Router();

router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store, no-cache");
  const isAdmin = await isAdminUserOrEmail(req.userId);
  const [user] = await db.select({
    plan: usersTable.plan,
    sessionCredits: usersTable.sessionCredits,
    resumeTailoringCredits: usersTable.resumeTailoringCredits,
    trialUsed: usersTable.trialUsed,
    stripeCustomerId: usersTable.stripeCustomerId,
    stripeSubscriptionId: usersTable.stripeSubscriptionId,
  }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);

  res.json({
    userId: req.userId,
    isAdmin,
    plan: user?.plan ?? "free",
    sessionCredits: user?.sessionCredits ?? 0,
    resumeTailoringCredits: user?.resumeTailoringCredits ?? 0,
    trialUsed: user?.trialUsed ?? false,
    stripeCustomerId: user?.stripeCustomerId ?? null,
    stripeSubscriptionId: user?.stripeSubscriptionId ?? null,
  });
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

async function requireAdmin(req: Parameters<typeof requireAuth>[0], res: Parameters<typeof requireAuth>[1], next: Parameters<typeof requireAuth>[2]): Promise<void> {
  if (!hasAnyAdminConfigured()) {
    res.status(403).json({ error: "Forbidden", code: "NO_ADMINS_CONFIGURED" });
    return;
  }
  const isAdmin = await isAdminUserOrEmail(req.userId);
  if (!isAdmin) {
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
      plan: usersTable.plan,
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
      completedSessions: sql<number>`(
        SELECT COUNT(*)::int FROM interview_sessions
        WHERE user_id = ${usersTable.id}
        AND status = 'completed'
      )`,
      sessionsThisMonth: sql<number>`(
        SELECT COUNT(*)::int FROM interview_sessions
        WHERE user_id = ${usersTable.id}
        AND status != 'cancelled'
        AND created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
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

router.get("/users/admin/users/:userId/sessions", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { userId } = req.params;

  const sessions = await db
    .select({
      id: sessionsTable.id,
      jobRole: sessionsTable.jobRole,
      durationMinutes: sessionsTable.durationMinutes,
      status: sessionsTable.status,
      createdAt: sessionsTable.createdAt,
    })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.userId, userId), eq(sessionsTable.status, "completed")))
    .orderBy(desc(sessionsTable.createdAt));

  res.json(sessions);
});

router.get("/users/admin/tailors", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const statsResult = await db.execute<{
    total_all_time: string;
    total_this_month: string;
    total_today: string;
  }>(sql`
    SELECT
      COUNT(*)::int AS total_all_time,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC'))::int AS total_this_month,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC'))::int AS total_today
    FROM resume_tailoring
  `);
  const statsRow = statsResult.rows[0];

  const creditsResult = await db.execute<{
    total_credits: string;
    users_with_credits: string;
  }>(sql`
    SELECT
      COALESCE(SUM(resume_tailoring_credits), 0)::int AS total_credits,
      COUNT(*) FILTER (WHERE resume_tailoring_credits > 0)::int AS users_with_credits
    FROM users
  `);
  const creditsRow = creditsResult.rows[0];

  const recentUsageResult = await db.execute<{
    id: number;
    user_id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    job_title: string | null;
    scope: string;
    aggressiveness: string;
    created_at: string;
  }>(sql`
    SELECT
      rt.id,
      rt.user_id,
      u.email,
      u.first_name,
      u.last_name,
      rt.job_title,
      rt.scope,
      rt.aggressiveness,
      rt.created_at
    FROM resume_tailoring rt
    LEFT JOIN users u ON u.id = rt.user_id
    ORDER BY rt.created_at DESC
    LIMIT 100
  `);

  const creditBalancesResult = await db.execute<{
    user_id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    plan: string;
    resume_tailoring_credits: number;
    total_used: string;
  }>(sql`
    SELECT
      u.id AS user_id,
      u.email,
      u.first_name,
      u.last_name,
      u.plan,
      u.resume_tailoring_credits,
      COUNT(rt.id)::int AS total_used
    FROM users u
    LEFT JOIN resume_tailoring rt ON rt.user_id = u.id
    WHERE u.plan != 'free' OR u.resume_tailoring_credits > 0 OR EXISTS (
      SELECT 1 FROM resume_tailoring WHERE user_id = u.id
    )
    GROUP BY u.id
    ORDER BY total_used DESC, u.resume_tailoring_credits DESC
  `);

  res.json({
    stats: {
      totalAllTime: Number(statsRow?.total_all_time ?? 0),
      totalThisMonth: Number(statsRow?.total_this_month ?? 0),
      totalToday: Number(statsRow?.total_today ?? 0),
      totalCreditsOutstanding: Number(creditsRow?.total_credits ?? 0),
      usersWithCredits: Number(creditsRow?.users_with_credits ?? 0),
    },
    recentUsage: recentUsageResult.rows,
    creditBalances: creditBalancesResult.rows,
  });
});

export default router;

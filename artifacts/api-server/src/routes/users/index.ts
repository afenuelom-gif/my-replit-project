import { Router, type IRouter } from "express";
import { db, sessionsTable, reportsTable, usersTable, loginEventsTable, resumeTailoringTable } from "@workspace/db";
import { eq, and, desc, inArray, sql, max, count } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth.js";
import { isAdminUserOrEmail, hasAnyAdminConfigured } from "../../lib/adminAuth.js";
import { getStripeClient } from "../../lib/stripeClient.js";

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

const STARTER_PRICE_ID = "price_1TP7dFRtEcuSwbZwGirNXwpc";
const PRO_PRICE_ID = "price_1TP7dZRtEcuSwbZw0Sb4ywUP";
const TOPUP_PRICE_IDS = new Set([
  "price_1TP7dnRtEcuSwbZwinKg4z5b",
  "price_1TP7doRtEcuSwbZwAslgIUPe",
  "price_1TP7dnRtEcuSwbZwHAftqQp5",
]);

router.get("/users/admin/revenue", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const stripe = getStripeClient();

  // Subscriptions create invoices; one-time top-up packs go through
  // checkout sessions with mode:"payment" and never produce invoices.
  // Fetch both sources separately so neither is missed.
  const [activeSubs, canceledSubs, invoices, topUpSessions] = await Promise.all([
    stripe.subscriptions.list({ status: "active", limit: 100, expand: ["data.items.data.price"] }),
    stripe.subscriptions.list({ status: "canceled", limit: 100 }),
    stripe.invoices.list({ status: "paid", limit: 100 }),
    stripe.checkout.sessions.list({
      limit: 100,
      expand: ["data.line_items"],
    }),
  ]);

  // ── MRR + plan breakdown ────────────────────────────────────────────────
  let mrr = 0;
  let starterCount = 0;
  let proCount = 0;
  for (const sub of activeSubs.data) {
    const price = sub.items.data[0]?.price;
    if (!price) continue;
    mrr += price.unit_amount ?? 0;
    if (price.id === STARTER_PRICE_ID) starterCount++;
    else if (price.id === PRO_PRICE_ID) proCount++;
  }

  // ── Churn ───────────────────────────────────────────────────────────────
  const now = Date.now() / 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
  const churnedThisMonth = canceledSubs.data.filter(
    (s) => s.canceled_at != null && s.canceled_at >= thirtyDaysAgo
  ).length;

  // ── Revenue aggregation ─────────────────────────────────────────────────
  let totalRevenue = 0;
  let totalSubscriptionRevenue = 0;
  let totalTopUpRevenue = 0;
  const monthlyMap = new Map<string, number>();

  type ChargeRow = { date: string; amount: number; description: string; type: string; status: string; ts: number };
  const allCharges: ChargeRow[] = [];

  // Subscription invoices
  for (const inv of invoices.data) {
    if (!inv.amount_paid || inv.amount_paid <= 0) continue;
    totalRevenue += inv.amount_paid;
    totalSubscriptionRevenue += inv.amount_paid;
    const d = new Date(inv.created * 1000);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + inv.amount_paid);
    allCharges.push({
      ts: inv.created,
      date: d.toISOString(),
      amount: inv.amount_paid,
      description: inv.lines?.data[0]?.description ?? "Subscription",
      type: "Subscription",
      status: inv.status ?? "paid",
    });
  }

  // One-time top-up checkout sessions
  for (const session of topUpSessions.data) {
    if (session.mode !== "payment" || session.payment_status !== "paid") continue;
    const amount = session.amount_total ?? 0;
    if (amount <= 0) continue;
    totalRevenue += amount;
    totalTopUpRevenue += amount;
    const d = new Date(session.created * 1000);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + amount);
    const lineDesc = session.line_items?.data[0]?.description ?? "Top-up pack";
    allCharges.push({
      ts: session.created,
      date: d.toISOString(),
      amount,
      description: lineDesc,
      type: "Top-up",
      status: "paid",
    });
  }

  // ── Monthly chart (last 12 months) ──────────────────────────────────────
  const monthlyRevenue: { month: string; revenue: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - i);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
    monthlyRevenue.push({ month: label, revenue: monthlyMap.get(key) ?? 0 });
  }

  // ── Recent payments (newest first, capped at 20) ────────────────────────
  allCharges.sort((a, b) => b.ts - a.ts);
  const recentCharges = allCharges.slice(0, 20).map(({ ts: _ts, ...rest }) => rest);

  res.json({
    mrr,
    totalRevenue,
    totalSubscriptionRevenue,
    totalTopUpRevenue,
    activeSubscribers: activeSubs.data.length,
    starterCount,
    proCount,
    churnedThisMonth,
    monthlyRevenue,
    recentCharges,
  });
});

export default router;

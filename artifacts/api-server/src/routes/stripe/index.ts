import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth.js";
import { stripeService } from "../../lib/stripeService.js";
import { stripeStorage } from "../../lib/stripeStorage.js";
import { getStripeClient, isStripeConfigured } from "../../lib/stripeClient.js";
import { emailService } from "../../lib/emailService.js";

const router: IRouter = Router();

function getBaseUrl(req: Request): string {
  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "localhost";
  const proto = req.get("x-forwarded-proto") ?? req.protocol ?? "https";
  return `${proto}://${host}`;
}

function requireStripe(res: Response): boolean {
  if (!isStripeConfigured()) {
    res.status(503).json({ error: "Stripe is not configured on this server." });
    return false;
  }
  return true;
}

// POST /stripe/checkout/subscription — create subscription checkout session
router.post("/stripe/checkout/subscription", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!requireStripe(res)) return;
  try {
    const userId = req.userId!;
    const { priceId } = req.body as { priceId: string };

    if (!priceId) {
      res.status(400).json({ error: "priceId is required" });
      return;
    }

    const [user] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const customerId = await stripeService.findOrCreateCustomer(userId, user?.email ?? "");

    const base = getBaseUrl(req);
    const session = await stripeService.createSubscriptionCheckout({
      customerId,
      priceId,
      userId,
      successUrl: `${base}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}/pricing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /stripe/checkout/topup — create one-time top-up checkout session
router.post("/stripe/checkout/topup", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!requireStripe(res)) return;
  try {
    const userId = req.userId!;
    const { priceId } = req.body as { priceId: string };

    if (!priceId) {
      res.status(400).json({ error: "priceId is required" });
      return;
    }

    const [user] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const customerId = await stripeService.findOrCreateCustomer(userId, user?.email ?? "");

    const base = getBaseUrl(req);
    const session = await stripeService.createTopUpCheckout({
      customerId,
      priceId,
      userId,
      successUrl: `${base}/billing/success?session_id={CHECKOUT_SESSION_ID}&type=topup`,
      cancelUrl: `${base}/resume-tailor`,
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /stripe/portal — create billing portal session
router.post("/stripe/portal", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!requireStripe(res)) return;
  try {
    const userId = req.userId!;
    const user = await stripeStorage.getUser(userId);

    if (!user?.stripeCustomerId) {
      res.status(400).json({ error: "No subscription found" });
      return;
    }

    const base = getBaseUrl(req);
    const session = await stripeService.createBillingPortalSession(user.stripeCustomerId, `${base}/account`);

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /stripe/subscription — get current user's subscription status
router.get("/stripe/subscription", requireAuth, async (req: Request, res: Response): Promise<void> => {
  res.setHeader("Cache-Control", "no-store, no-cache");
  try {
    const userId = req.userId!;
    const [user] = await db
      .select({
        plan: usersTable.plan,
        stripeCustomerId: usersTable.stripeCustomerId,
        stripeSubscriptionId: usersTable.stripeSubscriptionId,
        sessionCredits: usersTable.sessionCredits,
        resumeTailoringCredits: usersTable.resumeTailoringCredits,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      res.json({ plan: "free", sessionCredits: 0, resumeTailoringCredits: 0, subscription: null });
      return;
    }

    let subscription = null;
    if (user.stripeSubscriptionId && isStripeConfigured()) {
      const stripe = getStripeClient();
      subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId).catch(() => null);
    }

    res.json({
      plan: user.plan,
      sessionCredits: user.sessionCredits,
      resumeTailoringCredits: user.resumeTailoringCredits,
      subscription,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /stripe/sync-user-plan — called after checkout redirect to sync plan
router.post("/stripe/sync-user-plan", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!requireStripe(res)) return;
  try {
    const userId = req.userId!;
    const { sessionId } = req.body as { sessionId?: string };

    const user = await stripeStorage.getUser(userId);
    if (!user) {
      res.json({ plan: "free" });
      return;
    }

    const stripe = getStripeClient();

    // If we have a checkout session ID, retrieve it for accuracy
    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["line_items", "subscription"],
      });

      if (session.mode === "payment" && session.payment_status === "paid") {
        // Top-up purchase — credits are added exclusively by the webhook (checkout.session.completed).
        // Here we only return the current DB state so the billing-success page can display it.
        // Adding credits here would double-count every purchase.
        if (user.stripeCustomerId == null && session.customer) {
          await db.update(usersTable)
            .set({ stripeCustomerId: session.customer as string })
            .where(eq(usersTable.id, userId));
        }
        res.json({ plan: user.plan, resumeTailoringCredits: user.resumeTailoringCredits, type: "topup" });
        return;
      }

      if (session.mode === "subscription" && session.subscription) {
        const sub = typeof session.subscription === "string"
          ? await stripe.subscriptions.retrieve(session.subscription)
          : session.subscription;
        const subId = (sub as { id: string }).id;

        const { plan, sessionCredits, resumeCredits } = await stripeService.getPlanFromSubscription(sub as Parameters<typeof stripeService.getPlanFromSubscription>[0]);

        // Only reset credits when this is a genuinely new subscription or a plan change.
        // If the user already has this exact subscription ID stored, they have already
        // received their initial credits — don't overwrite whatever they've used.
        const isNewSub = user.stripeSubscriptionId !== subId;
        const isPlanChange = user.plan !== plan;

        const [updated] = await db
          .update(usersTable)
          .set({
            plan,
            stripeSubscriptionId: subId,
            stripeCustomerId: user.stripeCustomerId ?? (session.customer as string ?? null),
            ...(isNewSub || isPlanChange ? { sessionCredits, resumeTailoringCredits: resumeCredits } : {}),
          })
          .where(eq(usersTable.id, userId))
          .returning();

        res.json({ plan: updated.plan, sessionCredits: updated.sessionCredits, resumeTailoringCredits: updated.resumeTailoringCredits, type: "subscription" });
        return;
      }
    }

    // Fallback: look up active subscription by customer ID
    if (!user.stripeCustomerId) {
      res.json({ plan: "free" });
      return;
    }

    const activeSub = await stripeService.getActiveSubscriptionForCustomer(user.stripeCustomerId);
    if (!activeSub) {
      await db.update(usersTable).set({ plan: "free", stripeSubscriptionId: null }).where(eq(usersTable.id, userId));
      res.json({ plan: "free" });
      return;
    }

    const { plan, sessionCredits, resumeCredits } = await stripeService.getPlanFromSubscription(activeSub);
    const isNewSub = user.stripeSubscriptionId !== activeSub.id;
    const isPlanChange = user.plan !== plan;
    const [updated] = await db
      .update(usersTable)
      .set({
        plan,
        stripeSubscriptionId: activeSub.id,
        ...(isNewSub || isPlanChange ? { sessionCredits, resumeTailoringCredits: resumeCredits } : {}),
      })
      .where(eq(usersTable.id, userId))
      .returning();

    res.json({ plan: updated.plan, sessionCredits: updated.sessionCredits, resumeTailoringCredits: updated.resumeTailoringCredits });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /stripe/cancel — cancel subscription at period end
router.post("/stripe/cancel", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!requireStripe(res)) return;
  try {
    const userId = req.userId!;
    const user = await stripeStorage.getUser(userId);

    if (!user?.stripeSubscriptionId) {
      res.status(400).json({ error: "No active subscription found" });
      return;
    }

    const stripe = getStripeClient();
    const updated = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    res.json({
      cancelled: true,
      cancelAtPeriodEnd: updated.cancel_at_period_end,
      currentPeriodEnd: updated.current_period_end,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /stripe/reactivate — undo cancel_at_period_end
router.post("/stripe/reactivate", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!requireStripe(res)) return;
  try {
    const userId = req.userId!;
    const user = await stripeStorage.getUser(userId);

    if (!user?.stripeSubscriptionId) {
      res.status(400).json({ error: "No active subscription found" });
      return;
    }

    const stripe = getStripeClient();
    const updated = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    const dbUser = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1).then(r => r[0]);
    if (dbUser?.email) {
      const renewDate = updated.current_period_end
        ? new Date(updated.current_period_end * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : undefined;
      emailService.sendSubscriptionReactivated(dbUser.email, dbUser.firstName, dbUser.plan ?? "starter", renewDate);
    }

    res.json({
      reactivated: true,
      cancelAtPeriodEnd: updated.cancel_at_period_end,
      currentPeriodEnd: updated.current_period_end,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

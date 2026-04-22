import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth.js";
import { stripeService } from "../../lib/stripeService.js";
import { stripeStorage } from "../../lib/stripeStorage.js";

const router: IRouter = Router();

function getBaseUrl(req: Request): string {
  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "localhost";
  const proto = req.get("x-forwarded-proto") ?? req.protocol ?? "https";
  return `${proto}://${host}`;
}

// GET /stripe/products — list all products with prices
router.get("/stripe/products", async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await stripeStorage.listProductsWithPrices();

    const productsMap = new Map<string, {
      id: string; name: string; description: string; metadata: Record<string, string>;
      prices: Array<{ id: string; unit_amount: number; currency: string; recurring: unknown; metadata: Record<string, string> }>;
    }>();

    for (const row of rows) {
      const r = row as Record<string, unknown>;
      const productId = r.product_id as string;
      if (!productsMap.has(productId)) {
        productsMap.set(productId, {
          id: productId,
          name: r.product_name as string,
          description: r.product_description as string ?? "",
          metadata: (r.product_metadata as Record<string, string>) ?? {},
          prices: [],
        });
      }
      if (r.price_id) {
        productsMap.get(productId)!.prices.push({
          id: r.price_id as string,
          unit_amount: r.unit_amount as number,
          currency: r.currency as string,
          recurring: r.recurring,
          metadata: (r.price_metadata as Record<string, string>) ?? {},
        });
      }
    }

    res.json({ products: Array.from(productsMap.values()) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /stripe/checkout/subscription — create subscription checkout session
router.post("/stripe/checkout/subscription", requireAuth, async (req: Request, res: Response): Promise<void> => {
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
      successUrl: `${base}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}/resume-tailor`,
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /stripe/portal — create billing portal session
router.post("/stripe/portal", requireAuth, async (req: Request, res: Response): Promise<void> => {
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
    if (user.stripeSubscriptionId) {
      subscription = await stripeStorage.getSubscription(user.stripeSubscriptionId);
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

// POST /stripe/webhook/handle-subscription — internal: sync subscription changes to user record
// Called after Stripe webhooks update the stripe schema, we react to subscription events
router.post("/stripe/sync-user-plan", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const user = await stripeStorage.getUser(userId);

    if (!user?.stripeCustomerId) {
      res.json({ plan: "free" });
      return;
    }

    const activeSub = await stripeService.getActiveSubscriptionForCustomer(user.stripeCustomerId);

    if (!activeSub) {
      await db.update(usersTable).set({ plan: "free", stripeSubscriptionId: null }).where(eq(usersTable.id, userId));
      res.json({ plan: "free" });
      return;
    }

    const priceId = activeSub.items.data[0]?.price?.id;
    const productId = activeSub.items.data[0]?.price?.product as string | undefined;

    const result = await db.execute(
      sql`SELECT metadata FROM stripe.products WHERE id = ${productId ?? ""}`,
    );
    const metadata = (result.rows[0] as Record<string, unknown> | undefined)?.metadata as Record<string, string> | undefined;
    const plan = (metadata?.plan ?? "starter") as string;

    const sessionCredits = plan === "pro" ? 999 : parseInt(metadata?.session_credits ?? "4", 10);
    const resumeCredits = plan === "pro" ? 3 : parseInt(metadata?.resume_tailoring_credits ?? "1", 10);

    await db
      .update(usersTable)
      .set({
        plan,
        stripeSubscriptionId: activeSub.id,
        sessionCredits,
        resumeTailoringCredits: resumeCredits,
      })
      .where(eq(usersTable.id, userId));

    res.json({ plan, priceId, subscriptionId: activeSub.id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

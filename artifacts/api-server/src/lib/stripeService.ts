import { getStripeClient } from "./stripeClient.js";
import { stripeStorage } from "./stripeStorage.js";

const PLAN_CREDITS: Record<string, { sessionCredits: number; resumeCredits: number }> = {
  starter: { sessionCredits: 4, resumeCredits: 1 },
  pro: { sessionCredits: 999, resumeCredits: 3 },
};

const TOPUP_CREDITS: Record<string, number> = {
  price_1TP7dnRtEcuSwbZwinKg4z5b: 1,
  price_1TP7doRtEcuSwbZwAslgIUPe: 3,
  price_1TP7dnRtEcuSwbZwHAftqQp5: 10,
};

export class StripeService {
  async findOrCreateCustomer(userId: string, email: string): Promise<string> {
    const user = await stripeStorage.getUser(userId);
    if (user?.stripeCustomerId) return user.stripeCustomerId;

    const stripe = getStripeClient();
    const customer = await stripe.customers.create({ email, metadata: { userId } });
    await stripeStorage.updateUserStripeInfo(userId, { stripeCustomerId: customer.id });
    return customer.id;
  }

  async createSubscriptionCheckout(opts: {
    customerId: string;
    priceId: string;
    userId: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    const stripe = getStripeClient();
    return stripe.checkout.sessions.create({
      customer: opts.customerId,
      payment_method_types: ["card"],
      line_items: [{ price: opts.priceId, quantity: 1 }],
      mode: "subscription",
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
      metadata: { userId: opts.userId },
    });
  }

  async createTopUpCheckout(opts: {
    customerId: string;
    priceId: string;
    userId: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    const stripe = getStripeClient();
    return stripe.checkout.sessions.create({
      customer: opts.customerId,
      payment_method_types: ["card"],
      line_items: [{ price: opts.priceId, quantity: 1 }],
      mode: "payment",
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
      metadata: { userId: opts.userId },
    });
  }

  async createBillingPortalSession(customerId: string, returnUrl: string) {
    const stripe = getStripeClient();
    return stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  async getActiveSubscriptionForCustomer(customerId: string) {
    const stripe = getStripeClient();
    // Include past_due so users with a failed payment aren't incorrectly downgraded
    // during a plan sync — Stripe is still retrying their payment.
    const [activeSubs, pastDueSubs] = await Promise.all([
      stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 }),
      stripe.subscriptions.list({ customer: customerId, status: "past_due", limit: 1 }),
    ]);
    return activeSubs.data[0] ?? pastDueSubs.data[0] ?? null;
  }

  async getPlanFromSubscription(sub: { items: { data: Array<{ price: { id: string; product: string | { id: string } } }> } }) {
    const stripe = getStripeClient();
    const priceId = sub.items.data[0]?.price?.id;
    const productId = typeof sub.items.data[0]?.price?.product === "string"
      ? sub.items.data[0].price.product
      : sub.items.data[0]?.price?.product?.id;

    if (!productId) return { plan: "starter", sessionCredits: 4, resumeCredits: 1 };

    const product = await stripe.products.retrieve(productId);
    const plan = (product.metadata?.plan ?? "starter") as string;
    const credits = PLAN_CREDITS[plan] ?? PLAN_CREDITS.starter;
    return { plan, priceId, ...credits };
  }

  getTopUpCreditsForPrice(priceId: string): number {
    return TOPUP_CREDITS[priceId] ?? 1;
  }
}

export const stripeService = new StripeService();

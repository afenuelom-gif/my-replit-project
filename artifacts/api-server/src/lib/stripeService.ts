import { getUncachableStripeClient } from "./stripeClient.js";
import { stripeStorage } from "./stripeStorage.js";

export class StripeService {
  async findOrCreateCustomer(userId: string, email: string): Promise<string> {
    const user = await stripeStorage.getUser(userId);
    if (user?.stripeCustomerId) return user.stripeCustomerId;

    const stripe = await getUncachableStripeClient();
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
    const stripe = await getUncachableStripeClient();
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
    const stripe = await getUncachableStripeClient();
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
    const stripe = await getUncachableStripeClient();
    return stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  async getActiveSubscriptionForCustomer(customerId: string) {
    const stripe = await getUncachableStripeClient();
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    return subs.data[0] ?? null;
  }
}

export const stripeService = new StripeService();

import { db, usersTable } from "@workspace/db";
import { eq, sql as drizzleSql } from "drizzle-orm";
import { getStripeClient, getWebhookSecret } from "./stripeClient.js";
import { stripeService } from "./stripeService.js";
import { logger } from "./logger.js";
import type Stripe from "stripe";

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "Payload must be a Buffer. Received type: " + typeof payload +
        ". Ensure webhook route is registered BEFORE app.use(express.json()).",
      );
    }

    let event: Stripe.Event;
    try {
      const stripe = getStripeClient();
      const webhookSecret = getWebhookSecret();
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      throw new Error(`Webhook signature verification failed: ${(err as Error).message}`);
    }

    logger.info({ type: event.type }, "Processing Stripe webhook event");

    switch (event.type) {
      case "checkout.session.completed": {
        await WebhookHandlers.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await WebhookHandlers.handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
        break;
      }
      case "customer.subscription.deleted": {
        await WebhookHandlers.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const stripe = getStripeClient();
          const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
          await WebhookHandlers.handleSubscriptionUpsert(sub);
        }
        break;
      }
      default:
        logger.info({ type: event.type }, "Unhandled webhook event");
    }
  }

  private static async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    if (!userId) return;

    if (session.mode === "payment") {
      const priceId = session.line_items?.data[0]?.price?.id ?? "";
      const tailorCredits = stripeService.getTopUpCreditsForPrice(priceId);
      await db.execute(
        drizzleSql`UPDATE users SET resume_tailoring_credits = resume_tailoring_credits + ${tailorCredits} WHERE id = ${userId}`,
      );
      logger.info({ userId, tailorCredits }, "Top-up credits added via webhook");
    }
  }

  private static async handleSubscriptionUpsert(sub: Stripe.Subscription): Promise<void> {
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    const stripe = getStripeClient();
    const customers = await stripe.customers.search({ query: `id:'${customerId}'`, limit: 1 });
    const userId = customers.data[0]?.metadata?.userId;
    if (!userId) return;

    const { plan, sessionCredits, resumeCredits } = await stripeService.getPlanFromSubscription(sub);
    await db.update(usersTable).set({
      plan,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId,
      sessionCredits,
      resumeTailoringCredits: resumeCredits,
    }).where(eq(usersTable.id, userId));

    logger.info({ userId, plan }, "Subscription upserted via webhook");
  }

  private static async handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    const stripe = getStripeClient();
    const customers = await stripe.customers.search({ query: `id:'${customerId}'`, limit: 1 });
    const userId = customers.data[0]?.metadata?.userId;
    if (!userId) return;

    await db.update(usersTable).set({
      plan: "free",
      stripeSubscriptionId: null,
    }).where(eq(usersTable.id, userId));

    logger.info({ userId }, "Subscription cancelled via webhook");
  }
}

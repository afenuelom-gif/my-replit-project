import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./lib/stripeClient.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — skipping Stripe initialization");
    return;
  }

  try {
    logger.info("Initializing Stripe schema...");
    await runMigrations({ databaseUrl, schema: "stripe" });
    logger.info("Stripe schema ready");

    const stripeSync = await getStripeSync();

    const domains = process.env.REPLIT_DOMAINS?.split(",") ?? [];
    const webhookBaseUrl = domains[0] ? `https://${domains[0]}` : null;

    if (webhookBaseUrl) {
      logger.info({ url: webhookBaseUrl }, "Setting up managed webhook...");
      await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
      logger.info("Webhook configured");
    } else {
      logger.warn("REPLIT_DOMAINS not set — skipping webhook setup");
    }

    stripeSync.syncBackfill()
      .then(() => logger.info("Stripe data synced"))
      .catch((err: unknown) => logger.error({ err }, "Stripe sync backfill error"));
  } catch (err) {
    logger.error({ err }, "Failed to initialize Stripe — continuing without Stripe");
  }
}

initStripe()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Fatal startup error");
    process.exit(1);
  });

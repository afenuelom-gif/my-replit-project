import app from "./app";
import { logger } from "./lib/logger";
import { isStripeConfigured } from "./lib/stripeClient.js";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  if (isStripeConfigured()) {
    logger.info("Stripe initialized with secret key");
  } else {
    logger.warn("STRIPE_SECRET_KEY not set — Stripe payments disabled");
  }

  logger.info({ port }, "Server listening");
});

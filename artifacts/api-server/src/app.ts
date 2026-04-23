import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { seedInterviewersIfNeeded, patchFemaleInterviewerVoices } from "./lib/seedInterviewers";
import { WebhookHandlers } from "./lib/webhookHandlers";
import { isStripeConfigured } from "./lib/stripeClient";
import { emailService } from "./lib/emailService";

const IS_REPLIT_DEV = (Boolean(process.env.REPL_ID) || process.env.NODE_ENV === "development") && process.env.NODE_ENV !== "production";
const USE_AUTH0 = !IS_REPLIT_DEV && Boolean(process.env.AUTH0_DOMAIN && process.env.AUTH0_CLIENT_ID);

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

if (!USE_AUTH0) {
  app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
}

// ─── Stripe webhook MUST come before express.json() ───────────────────────────
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];

    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature" });
      return;
    }

    if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
      logger.warn("Stripe webhook received but Stripe is not configured");
      res.status(200).json({ received: true, note: "Stripe not configured" });
      return;
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        logger.error("Stripe webhook: req.body is not a Buffer — express.json() ran first");
        res.status(500).json({ error: "Webhook processing error" });
        return;
      }

      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err: unknown) {
      logger.error({ err }, "Stripe webhook error");

      // Best-effort extract event type and ID from the raw buffer for the alert email.
      let eventType = "unknown";
      let eventId = "unknown";
      try {
        const parsed = JSON.parse((req.body as Buffer).toString("utf-8")) as { type?: string; id?: string };
        eventType = parsed.type ?? "unknown";
        eventId = parsed.id ?? "unknown";
      } catch { /* ignore parse errors */ }

      emailService.sendWebhookFailureAlert(eventType, eventId, err);

      res.status(400).json({ error: "Webhook processing error" });
    }
  },
);
// ─────────────────────────────────────────────────────────────────────────────

app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

if (!USE_AUTH0) {
  app.use(clerkMiddleware());
}

app.use("/api", router);

seedInterviewersIfNeeded().catch(err => logger.error({ err }, "Seeding interviewers failed"));
patchFemaleInterviewerVoices().catch(err => logger.error({ err }, "Patching female interviewer voices failed"));

export default app;

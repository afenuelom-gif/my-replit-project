import { Resend } from "resend";
import { logger } from "./logger.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM = process.env.EMAIL_FROM ?? "PrepInterv AI <noreply@prepinterv.com>";
const APP_URL = process.env.APP_URL ?? "https://prepinterv.com";

function wrap(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);max-width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#2563eb 0%,#4f46e5 100%);padding:28px 36px;">
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">PrepInterv AI</p>
            <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.72);">AI-Powered Interview Practice</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 36px 28px;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 36px 24px;border-top:1px solid #f1f5f9;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
              © ${new Date().getFullYear()} PrepInterv AI · <a href="${APP_URL}" style="color:#94a3b8;text-decoration:none;">prepinterv.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:20px;">${label} →</a>`;
}

function hi(firstName?: string | null): string {
  return firstName ? `Hi ${escapeHtml(firstName)},` : "Hi there,";
}

async function deliver(to: string, subject: string, html: string): Promise<void> {
  const client = getClient();
  if (!client) {
    logger.warn({ to, subject }, "Email skipped — RESEND_API_KEY not set");
    return;
  }
  const { error } = await client.emails.send({ from: FROM, to, subject, html });
  if (error) {
    logger.warn({ error, to, subject }, "Email delivery failed");
  } else {
    logger.info({ to, subject }, "Email sent");
  }
}

export const emailService = {
  sendWelcome(to: string, firstName?: string | null): void {
    deliver(to, "Welcome to PrepInterv AI 🎉", wrap(`
      <p style="margin:0 0 8px;font-size:17px;font-weight:700;color:#0f172a;">${hi(firstName)}</p>
      <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.65;">
        Welcome to <strong>PrepInterv AI</strong> — you're all set to start practising with a real AI interviewer.
      </p>
      <p style="margin:0 0 10px;font-size:15px;color:#334155;line-height:1.65;">Your free trial includes:</p>
      <ul style="margin:0 0 16px;padding-left:20px;color:#334155;font-size:15px;line-height:1.9;">
        <li>One 45-minute AI panel interview session for any job role</li>
        <li>A scored performance report with per-question feedback</li>
        <li>One free resume tailoring against a real job description</li>
      </ul>
      ${btn("Start Your First Interview", `${APP_URL}/dashboard`)}
    `)).catch(() => {});
  },

  sendSubscriptionConfirmed(to: string, firstName: string | null | undefined, plan: string): void {
    const label = plan === "pro" ? "Pro" : "Starter";
    deliver(to, `Your PrepInterv AI ${label} plan is now active`, wrap(`
      <p style="margin:0 0 8px;font-size:17px;font-weight:700;color:#0f172a;">${hi(firstName)}</p>
      <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.65;">
        Your <strong>PrepInterv AI ${label}</strong> subscription is active and your credits are ready to use.
      </p>
      <table cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:20px;">
        <tr><td style="padding:14px 20px;">
          <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.6px;">Active plan</p>
          <p style="margin:0;font-size:22px;font-weight:800;color:#166534;">${label}</p>
        </td></tr>
      </table>
      <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.65;">
        Head to your dashboard and kick off your next interview session.
      </p>
      ${btn("Go to Dashboard", `${APP_URL}/dashboard`)}
    `)).catch(() => {});
  },

  sendSubscriptionCancelled(to: string, firstName: string | null | undefined, plan: string, accessUntil?: string): void {
    const label = plan === "pro" ? "Pro" : "Starter";
    const accessNote = accessUntil
      ? `<p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.65;">You keep full access to your ${label} features until <strong>${accessUntil}</strong>.</p>`
      : "";
    deliver(to, "Your PrepInterv AI subscription has been cancelled", wrap(`
      <p style="margin:0 0 8px;font-size:17px;font-weight:700;color:#0f172a;">${hi(firstName)}</p>
      <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.65;">
        Your <strong>PrepInterv AI ${label}</strong> subscription has been cancelled.
      </p>
      ${accessNote}
      <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.65;">
        Changed your mind? You can resubscribe any time and your full interview history will still be there.
      </p>
      ${btn("Resubscribe", `${APP_URL}/pricing`)}
    `)).catch(() => {});
  },

  sendSubscriptionReactivated(to: string, firstName: string | null | undefined, plan: string, accessUntil?: string): void {
    const label = plan === "pro" ? "Pro" : "Starter";
    const renewNote = accessUntil
      ? `<p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.65;">Your plan will continue to renew normally on <strong>${accessUntil}</strong>.</p>`
      : "";
    deliver(to, "Your PrepInterv AI subscription has been reactivated", wrap(`
      <p style="margin:0 0 8px;font-size:17px;font-weight:700;color:#0f172a;">${hi(firstName)}</p>
      <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.65;">
        Great news — your <strong>PrepInterv AI ${label}</strong> subscription is back on. Your cancellation has been reversed and nothing has changed about your plan.
      </p>
      ${renewNote}
      <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.65;">
        Head back to the dashboard to keep practising.
      </p>
      ${btn("Go to Dashboard", `${APP_URL}/dashboard`)}
    `)).catch(() => {});
  },

  sendPaymentFailed(to: string, firstName: string | null | undefined): void {
    deliver(to, "Action required: payment failed for PrepInterv AI", wrap(`
      <p style="margin:0 0 8px;font-size:17px;font-weight:700;color:#0f172a;">${hi(firstName)}</p>
      <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.65;">
        We weren't able to process your latest PrepInterv AI payment and your subscription is currently on hold.
      </p>
      <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.65;">
        Stripe will retry automatically, but you can resolve this straight away by updating your payment method.
      </p>
      ${btn("Update Payment Method", `${APP_URL}/account`)}
    `)).catch(() => {});
  },

  sendTopUpConfirmed(to: string, firstName: string | null | undefined, credits: number): void {
    const plural = credits !== 1;
    deliver(to, `${credits} tailor credit${plural ? "s" : ""} added to your account`, wrap(`
      <p style="margin:0 0 8px;font-size:17px;font-weight:700;color:#0f172a;">${hi(firstName)}</p>
      <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.65;">
        Your top-up is confirmed — <strong>${credits} resume tailor credit${plural ? "s" : ""}</strong> ${plural ? "have" : "has"} been added to your account.
      </p>
      <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.65;">
        Head to the Resume Tailor to put them to work on your next application.
      </p>
      ${btn("Open Resume Tailor", `${APP_URL}/resume-tailor`)}
    `)).catch(() => {});
  },

  sendLowSessionCredits(to: string, firstName: string | null | undefined, remaining: number): void {
    deliver(to, `Heads up: ${remaining} interview session${remaining !== 1 ? "s" : ""} remaining`, wrap(`
      <p style="margin:0 0 8px;font-size:17px;font-weight:700;color:#0f172a;">${hi(firstName)}</p>
      <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.65;">
        You have <strong>${remaining} interview session credit${remaining !== 1 ? "s" : ""} left</strong> on your current plan.
      </p>
      <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.65;">
        Upgrade to Pro for unlimited sessions so you're always ready for the next opportunity.
      </p>
      ${btn("View Plans", `${APP_URL}/pricing`)}
    `)).catch(() => {});
  },

  sendLowTailorCredits(to: string, firstName: string | null | undefined, remaining: number): void {
    deliver(to, `Heads up: ${remaining} resume tailor credit${remaining !== 1 ? "s" : ""} remaining`, wrap(`
      <p style="margin:0 0 8px;font-size:17px;font-weight:700;color:#0f172a;">${hi(firstName)}</p>
      <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.65;">
        You have <strong>${remaining} resume tailor credit${remaining !== 1 ? "s" : ""} remaining</strong>.
      </p>
      <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.65;">
        Top up any time to keep tailoring your resume to new job descriptions.
      </p>
      ${btn("Get More Credits", `${APP_URL}/pricing`)}
    `)).catch(() => {});
  },

  sendWebhookFailureAlert(eventType: string, eventId: string, err: unknown): void {
    const adminEmail = process.env.ADMIN_EMAIL ?? "hello@prepinterv.com";
    const message = escapeHtml(err instanceof Error ? err.message : String(err));
    const timestamp = new Date().toUTCString();
    deliver(adminEmail, `[ALERT] Stripe webhook failed — ${eventType}`, wrap(`
      <p style="margin:0 0 16px;font-size:17px;font-weight:700;color:#dc2626;">⚠️ Stripe Webhook Failure</p>
      <p style="margin:0 0 20px;font-size:14px;color:#334155;line-height:1.65;">
        A Stripe webhook event failed to process. Stripe will retry automatically, but credits or plan changes may not have been applied yet. Investigate immediately if this alert repeats.
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;">
        <tr style="background:#fef2f2;">
          <td style="padding:10px 14px;border:1px solid #fecaca;font-weight:700;color:#991b1b;width:140px;">Event type</td>
          <td style="padding:10px 14px;border:1px solid #fecaca;color:#1e293b;font-family:monospace;">${eventType}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;border:1px solid #fecaca;font-weight:700;color:#991b1b;">Event ID</td>
          <td style="padding:10px 14px;border:1px solid #fecaca;color:#1e293b;font-family:monospace;">${eventId}</td>
        </tr>
        <tr style="background:#fef2f2;">
          <td style="padding:10px 14px;border:1px solid #fecaca;font-weight:700;color:#991b1b;">Error</td>
          <td style="padding:10px 14px;border:1px solid #fecaca;color:#1e293b;font-family:monospace;">${message}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;border:1px solid #fecaca;font-weight:700;color:#991b1b;">Time (UTC)</td>
          <td style="padding:10px 14px;border:1px solid #fecaca;color:#1e293b;">${timestamp}</td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;color:#64748b;line-height:1.65;">
        Check the API server logs for a full stack trace. If the database was unavailable, verify that credits were applied once it recovered — Stripe retries failed webhooks for up to 72 hours.
      </p>
    `)).catch(() => {});
  },
};

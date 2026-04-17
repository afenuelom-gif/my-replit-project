import { Resend } from "resend";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface ContactEmailPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export async function sendContactEmail(payload: ContactEmailPayload): Promise<void> {
  const { RESEND_API_KEY } = process.env;

  if (!RESEND_API_KEY) {
    console.log("[sendContactEmail] RESEND_API_KEY not configured — logging contact message instead:\n", JSON.stringify(payload, null, 2));
    return;
  }

  const resend = new Resend(RESEND_API_KEY);
  const nameSafe    = escapeHtml(payload.name);
  const emailSafe   = escapeHtml(payload.email);
  const subjectSafe = escapeHtml(payload.subject);
  const messageSafe = escapeHtml(payload.message);

  const internalHtml = `
    <h2 style="font-family:sans-serif;color:#1e293b;">New Contact Message</h2>
    <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%;max-width:600px;">
      <tr><td style="padding:8px 0;color:#64748b;width:140px;">Name</td><td style="padding:8px 0;color:#1e293b;font-weight:600;">${nameSafe}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;">Email</td><td style="padding:8px 0;color:#1e293b;font-weight:600;">${emailSafe}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;vertical-align:top;">Subject</td><td style="padding:8px 0;color:#1e293b;">${subjectSafe}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;vertical-align:top;">Message</td><td style="padding:8px 0;color:#1e293b;white-space:pre-wrap;">${messageSafe}</td></tr>
    </table>
  `;

  const confirmationHtml = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
      <h2 style="color:#6366f1;">Thanks for reaching out, ${nameSafe}!</h2>
      <p style="font-size:15px;line-height:1.6;color:#475569;">
        We've received your message and will get back to you within <strong>24 hours</strong>.
      </p>
      <div style="background:#f8fafc;border-left:4px solid #6366f1;padding:16px 20px;border-radius:4px;margin:24px 0;">
        <p style="margin:0 0 6px;font-size:13px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Your message</p>
        <p style="margin:0;font-size:14px;color:#1e293b;white-space:pre-wrap;">${messageSafe}</p>
      </div>
      <p style="font-size:14px;color:#64748b;">
        If your question is urgent, you can also reply directly to this email.
      </p>
      <p style="font-size:14px;color:#64748b;margin-top:32px;">
        — The PrepInterv Team
      </p>
    </div>
  `;

  const [internal, confirmation] = await Promise.all([
    resend.emails.send({
      from: "PrepInterv <hello@prepinterv.com>",
      to: "hello@prepinterv.com",
      replyTo: payload.email,
      subject: `[PrepInterv Contact] ${payload.subject}`,
      html: internalHtml,
    }),
    resend.emails.send({
      from: "PrepInterv <hello@prepinterv.com>",
      to: payload.email,
      subject: "We received your message — PrepInterv",
      html: confirmationHtml,
    }),
  ]);

  if (internal.error) {
    console.error("[sendContactEmail] Resend error (internal):", internal.error);
    throw new Error(internal.error.message);
  }
  if (confirmation.error) {
    console.error("[sendContactEmail] Resend error (confirmation):", confirmation.error);
  }
}

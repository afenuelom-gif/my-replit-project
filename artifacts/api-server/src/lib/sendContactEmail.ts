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

  const html = `
    <h2 style="font-family:sans-serif;color:#1e293b;">New Contact Message</h2>
    <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%;max-width:600px;">
      <tr><td style="padding:8px 0;color:#64748b;width:140px;">Name</td><td style="padding:8px 0;color:#1e293b;font-weight:600;">${escapeHtml(payload.name)}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;">Email</td><td style="padding:8px 0;color:#1e293b;font-weight:600;">${escapeHtml(payload.email)}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;vertical-align:top;">Subject</td><td style="padding:8px 0;color:#1e293b;">${escapeHtml(payload.subject)}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;vertical-align:top;">Message</td><td style="padding:8px 0;color:#1e293b;white-space:pre-wrap;">${escapeHtml(payload.message)}</td></tr>
    </table>
  `;

  const { error } = await resend.emails.send({
    from: "PrepInterv <hello@prepinterv.com>",
    to: "hello@prepinterv.com",
    replyTo: payload.email,
    subject: `[PrepInterv Contact] ${payload.subject}`,
    html,
  });

  if (error) {
    console.error("[sendContactEmail] Resend error:", error);
    throw new Error(error.message);
  }
}

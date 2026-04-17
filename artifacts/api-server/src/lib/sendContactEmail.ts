import nodemailer from "nodemailer";

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
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log("[sendContactEmail] SMTP not configured — logging contact message instead:\n", JSON.stringify(payload, null, 2));
    return;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT ? parseInt(SMTP_PORT) : 587,
    secure: SMTP_PORT === "465",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const html = `
    <h2 style="font-family:sans-serif;color:#1e293b;">New Contact Message</h2>
    <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%;max-width:600px;">
      <tr><td style="padding:8px 0;color:#64748b;width:140px;">Name</td><td style="padding:8px 0;color:#1e293b;font-weight:600;">${escapeHtml(payload.name)}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;">Email</td><td style="padding:8px 0;color:#1e293b;font-weight:600;">${escapeHtml(payload.email)}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;vertical-align:top;">Subject</td><td style="padding:8px 0;color:#1e293b;">${escapeHtml(payload.subject)}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;vertical-align:top;">Message</td><td style="padding:8px 0;color:#1e293b;white-space:pre-wrap;">${escapeHtml(payload.message)}</td></tr>
    </table>
  `;

  await transporter.sendMail({
    from: SMTP_FROM ?? SMTP_USER,
    to: "feedback@prepinterv.com",
    replyTo: payload.email,
    subject: `[PrepInterv Contact] ${payload.subject}`,
    html,
  });
}

import nodemailer from "nodemailer";

export interface FeedbackEmailPayload {
  sessionId: number;
  jobRole: string;
  questionRelevance: string;
  feedbackHelpful: boolean;
  additionalComments: string | null;
}

const RELEVANCE_LABELS: Record<string, string> = {
  highly_relevant:   "Highly relevant",
  somewhat_relevant: "Somewhat relevant",
  not_relevant:      "Not relevant",
};

export async function sendFeedbackEmail(payload: FeedbackEmailPayload): Promise<void> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log(
      "[sendFeedbackEmail] SMTP not configured — logging feedback instead:\n",
      JSON.stringify(payload, null, 2)
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT ? parseInt(SMTP_PORT) : 587,
    secure: SMTP_PORT === "465",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const relevanceLabel = RELEVANCE_LABELS[payload.questionRelevance] ?? payload.questionRelevance;
  const helpfulLabel   = payload.feedbackHelpful ? "Yes" : "No";

  const html = `
    <h2 style="font-family:sans-serif;color:#1e293b;">New Session Feedback</h2>
    <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%;max-width:480px;">
      <tr><td style="padding:8px 0;color:#64748b;width:160px;">Session ID</td><td style="padding:8px 0;color:#1e293b;font-weight:600;">#${payload.sessionId}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;">Role</td><td style="padding:8px 0;color:#1e293b;font-weight:600;">${payload.jobRole}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;">Question relevance</td><td style="padding:8px 0;color:#1e293b;">${relevanceLabel}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;">Feedback helpful</td><td style="padding:8px 0;color:#1e293b;">${helpfulLabel}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;vertical-align:top;">Comments</td><td style="padding:8px 0;color:#1e293b;">${payload.additionalComments ?? "<em style='color:#94a3b8;'>None</em>"}</td></tr>
    </table>
  `;

  await transporter.sendMail({
    from: SMTP_FROM ?? SMTP_USER,
    to: "feedback@prepinterv.com",
    subject: `[PrepInterv] Session feedback — ${payload.jobRole} (#${payload.sessionId})`,
    html,
  });
}

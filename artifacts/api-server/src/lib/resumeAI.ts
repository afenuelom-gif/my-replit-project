import OpenAI from "openai";

// Prefer a direct OpenAI key when provided (no shared rate limits).
// Falls back to the Replit AI proxy if OPENAI_API_KEY is not set.
const usingOwnKey = !!process.env.OPENAI_API_KEY;

if (!usingOwnKey) {
  if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    throw new Error("AI_INTEGRATIONS_OPENAI_BASE_URL must be set (or provide OPENAI_API_KEY).");
  }
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    throw new Error("AI_INTEGRATIONS_OPENAI_API_KEY must be set (or provide OPENAI_API_KEY).");
  }
}

const openai = new OpenAI(
  usingOwnKey
    ? { apiKey: process.env.OPENAI_API_KEY, maxRetries: 2, timeout: 90_000 }
    : { apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY, baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL, maxRetries: 1, timeout: 90_000 },
);

export interface TailoringResult {
  tailoredResumeText: string;
  changeSummary: string[];
  atsKeywords: string[];
  improvementSuggestions: string[];
  jobTitle: string;
}

export async function tailorResume(opts: {
  resumeText: string;
  jobDescriptionText: string;
  scope: "full" | "role_specific";
  aggressiveness: "conservative" | "balanced" | "strong";
}): Promise<TailoringResult> {
  const { resumeText, jobDescriptionText, scope, aggressiveness } = opts;

  const scopeInstruction =
    scope === "full"
      ? "Tailor the full resume: rewrite the summary, all relevant experience roles, and the skills section to align with the job description."
      : "Tailor only the most recent role and the summary/skills sections. Leave older roles mostly unchanged except for adding transferable skill highlights where appropriate.";

  const aggressivenessInstruction =
    aggressiveness === "conservative"
      ? "Make light, minimal edits. Preserve the original phrasing as much as possible. Only make changes where they are clearly beneficial for ATS alignment. Touch as little as possible."
      : aggressiveness === "balanced"
      ? "Apply standard ATS optimization. Rephrase sentences to incorporate relevant keywords naturally. Rewrite bullet points that are vague or generic. Maintain a professional, human tone throughout."
      : `Apply maximum rewriting. Treat every bullet point, sentence, and section as rewriteable unless it already perfectly mirrors the job description's language.
- Rewrite the professional summary entirely to position the candidate specifically for this role.
- Rewrite every bullet point to use the exact action verbs, terminology, and keywords from the job description wherever the candidate's experience supports it.
- Tighten vague, generic phrasing into specific, impactful statements.
- If a skill or competency appears in the job description and the candidate has demonstrated it anywhere in their history, make it prominent.
- Do NOT preserve original phrasing simply to preserve it — assume all phrasing can and should be improved.
- The output resume should read as if the candidate wrote it specifically for this job, not as a generic resume that has been lightly edited.
- Never fabricate experience, invent titles, or add companies not in the original.`;

  const systemPrompt = `You are an expert resume writer and ATS optimization specialist. You help job seekers tailor their resumes to specific job descriptions.

Your rules:
- NEVER fabricate, invent, or add experience, qualifications, or responsibilities that aren't in the original resume
- Only enhance unrelated roles by surfacing transferable skills (e.g., project management, communication, analytical thinking)
- Incorporate ATS keywords naturally — never stuff them unnaturally
- Maintain a human, professional tone — avoid robotic or overly formal phrasing
- Preserve the original resume structure unless improving it helps readability
- Dates, company names, job titles, and factual information must remain unchanged
- If personal contact information (name, address, phone number, email) is absent from the submitted resume, insert clearly marked placeholders at the very top of the tailored resume so the user knows exactly where to add them. Never omit the header area entirely.

${scopeInstruction}
${aggressivenessInstruction}

FORMAT RULES for tailoredResumeText — follow these exactly:
- The candidate's full name (first line): wrap in **double asterisks** e.g. **Jane Smith**. If the name was not provided, use **[Your Name]** as a placeholder — never skip this line.
- Contact info line (address, phone, email): if not present in the original, include a placeholder line immediately after the name: **[Your Address] | [Phone Number] | [Email Address]** — so the user knows exactly where to insert their details. If contact info is present, keep it unchanged.
- Leave one blank line between the contact info line and the headline/tagline line.
- The headline/tagline line (job titles with pipes): wrap in **double asterisks** e.g. **Security Analyst | Data Specialist | Process Advocate**
- Every section heading (PROFESSIONAL EXPERIENCE, EDUCATION, CERTIFICATIONS, SKILLS, TRAINING, SUMMARY, etc.): wrap in **double asterisks** e.g. **PROFESSIONAL EXPERIENCE**
- Under each job: the company name on its own line wrapped in **double asterisks**, then the job title + dates on the next line also wrapped in **double asterisks**
- All bullet points: use the • character (not a hyphen or dash). For multi-line bullets, the wrapped continuation lines should be indented with two spaces so text aligns under the first word, not under the bullet.
- All other text (summaries, body text): plain, no asterisks.

Respond ONLY with a valid JSON object in exactly this structure:
{
  "jobTitle": "extracted job title from the job description",
  "tailoredResumeText": "the full tailored resume using the format rules above",
  "changeSummary": ["list of specific changes made, each as a short descriptive sentence"],
  "atsKeywords": ["keyword1", "keyword2", "...list of ATS keywords incorporated"],
  "improvementSuggestions": ["optional suggestion 1", "optional suggestion 2", "...additional tips not covered by the tailoring"]
}`;

  const userPrompt = `JOB DESCRIPTION:
${jobDescriptionText}

---

ORIGINAL RESUME:
${resumeText}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: aggressiveness === "strong" ? 0.7 : aggressiveness === "balanced" ? 0.5 : 0.3,
    max_tokens: 4000,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";

  let parsed: Partial<TailoringResult & { jobTitle: string }>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AI returned invalid JSON. Please try again.");
  }

  return {
    jobTitle: (parsed.jobTitle as string) || "Unknown Role",
    tailoredResumeText: (parsed.tailoredResumeText as string) || resumeText,
    changeSummary: Array.isArray(parsed.changeSummary) ? (parsed.changeSummary as string[]) : [],
    atsKeywords: Array.isArray(parsed.atsKeywords) ? (parsed.atsKeywords as string[]) : [],
    improvementSuggestions: Array.isArray(parsed.improvementSuggestions) ? (parsed.improvementSuggestions as string[]) : [],
  };
}

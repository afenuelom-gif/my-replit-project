import OpenAI from "openai";

if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
  throw new Error("AI_INTEGRATIONS_OPENAI_BASE_URL must be set.");
}
if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  throw new Error("AI_INTEGRATIONS_OPENAI_API_KEY must be set.");
}

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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
      ? "Make light, minimal edits. Preserve the original phrasing as much as possible. Only make changes where they are clearly beneficial for ATS alignment."
      : aggressiveness === "balanced"
      ? "Apply standard ATS optimization. Rephrase sentences to incorporate relevant keywords naturally. Maintain a professional, human tone throughout."
      : "Apply extensive rewriting where needed. Strongly align the resume language, achievements, and skills to the job description. This user has weaker alignment and needs maximum optimization — but never fabricate experience.";

  const systemPrompt = `You are an expert resume writer and ATS optimization specialist. You help job seekers tailor their resumes to specific job descriptions.

Your rules:
- NEVER fabricate, invent, or add experience, qualifications, or responsibilities that aren't in the original resume
- Only enhance unrelated roles by surfacing transferable skills (e.g., project management, communication, analytical thinking)
- Incorporate ATS keywords naturally — never stuff them unnaturally
- Maintain a human, professional tone — avoid robotic or overly formal phrasing
- Preserve the original resume structure unless improving it helps readability
- Dates, company names, job titles, and factual information must remain unchanged

${scopeInstruction}
${aggressivenessInstruction}

Respond ONLY with a valid JSON object in exactly this structure:
{
  "jobTitle": "extracted job title from the job description",
  "tailoredResumeText": "the full tailored resume as plain text, preserving section headers and structure",
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
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.4,
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

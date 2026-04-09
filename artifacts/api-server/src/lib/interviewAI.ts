import OpenAI from "openai";
import type { Interviewer } from "@workspace/db";

if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
  throw new Error("AI_INTEGRATIONS_OPENAI_BASE_URL must be set. Did you forget to provision the OpenAI AI integration?");
}
if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  throw new Error("AI_INTEGRATIONS_OPENAI_API_KEY must be set. Did you forget to provision the OpenAI AI integration?");
}

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface QuestionContext {
  jobRole: string;
  jobDescription: string | null;
  previousQA: Array<{ question: string; answer: string | null }>;
  interviewerPersonality: string;
  interviewerName: string;
  questionCount: number;
}

export async function generateNextQuestion(ctx: QuestionContext, isFollowUp: boolean): Promise<string> {
  const systemPrompt = `You are ${ctx.interviewerName}, a professional interviewer. Your personality: ${ctx.interviewerPersonality}

You are interviewing a candidate for the role of: ${ctx.jobRole}
${ctx.jobDescription ? `Job description: ${ctx.jobDescription}` : ""}

Rules:
- Ask one clear, focused interview question
- Keep the question to 1-2 sentences maximum
- Do not repeat previously asked questions
- Be conversational and professional
- Do not include preamble like "Great answer!" or "Thank you for sharing"
- Just ask the question directly`;

  const qaHistory = ctx.previousQA
    .map((qa) => `Q: ${qa.question}\nA: ${qa.answer ?? "[No answer provided]"}`)
    .join("\n\n");

  const userPrompt = isFollowUp
    ? `Based on the candidate's last answer, ask a relevant follow-up question that probes deeper into their response.

Previous Q&A:
${qaHistory}

Ask a follow-up question:`
    : `${qaHistory ? `Previous Q&A:\n${qaHistory}\n\n` : ""}Ask the next interview question for question #${ctx.questionCount + 1}. ${ctx.questionCount === 0 ? "Start with a warm opening question like asking them to introduce themselves or walk through their background." : ""}`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 256,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  return response.choices[0]?.message?.content?.trim() ?? "Could you tell me about your experience?";
}

export interface AnswerEvaluation {
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export async function evaluateAnswer(
  question: string,
  answer: string,
  jobRole: string,
  jobDescription: string | null
): Promise<AnswerEvaluation> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 512,
    messages: [
      {
        role: "system",
        content: `You are an expert interview evaluator for the role: ${jobRole}${jobDescription ? `\nJob description: ${jobDescription}` : ""}

Evaluate the candidate's answer and return a JSON object with:
- score (integer 0-100)
- feedback (string, 2-3 sentences of overall feedback)
- strengths (array of 1-3 short strength bullet points)
- improvements (array of 1-3 short improvement suggestions)

Return ONLY valid JSON, no markdown.`,
      },
      {
        role: "user",
        content: `Question: ${question}\n\nCandidate's answer: ${answer}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "{}";
  try {
    const parsed = JSON.parse(raw) as AnswerEvaluation;
    return {
      score: Math.min(100, Math.max(0, Number(parsed.score) || 50)),
      feedback: parsed.feedback ?? "Good attempt.",
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
    };
  } catch {
    return { score: 60, feedback: "Unable to evaluate at this time.", strengths: [], improvements: [] };
  }
}

export async function generateReport(
  jobRole: string,
  jobDescription: string | null,
  qaItems: Array<{ question: string; answer: string | null }>,
  postureScores: number[]
): Promise<{
  overallScore: number;
  communicationScore: number;
  technicalScore: number;
  confidenceScore: number;
  summary: string;
  suggestions: string[];
}> {
  const avgPosture = postureScores.length > 0
    ? Math.round(postureScores.reduce((a, b) => a + b, 0) / postureScores.length)
    : 70;

  const qaText = qaItems
    .map((qa, i) => `Q${i + 1}: ${qa.question}\nA: ${qa.answer ?? "[No answer]"}`)
    .join("\n\n");

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 1024,
    messages: [
      {
        role: "system",
        content: `You are an expert interview coach evaluating a candidate's performance for the role: ${jobRole}${jobDescription ? `\nJob description: ${jobDescription}` : ""}

Based on the Q&A below, return a JSON object with:
- overallScore (integer 0-100)
- communicationScore (integer 0-100, rate clarity and structure of answers)
- technicalScore (integer 0-100, rate technical/domain knowledge demonstrated)
- confidenceScore (integer 0-100, rate confidence and delivery based on answer content)
- summary (string, 3-4 sentence overall assessment)
- suggestions (array of exactly 3 actionable improvement suggestions)

Return ONLY valid JSON, no markdown.`,
      },
      {
        role: "user",
        content: `Interview Q&A:\n\n${qaText}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "{}";
  try {
    const parsed = JSON.parse(raw) as {
      overallScore: number;
      communicationScore: number;
      technicalScore: number;
      confidenceScore: number;
      summary: string;
      suggestions: string[];
    };
    return {
      overallScore: Math.min(100, Math.max(0, Number(parsed.overallScore) || 65)),
      communicationScore: Math.min(100, Math.max(0, Number(parsed.communicationScore) || 65)),
      technicalScore: Math.min(100, Math.max(0, Number(parsed.technicalScore) || 65)),
      confidenceScore: Math.min(100, Math.max(0, Number(parsed.confidenceScore) || 65)),
      summary: parsed.summary ?? "Overall performance was satisfactory.",
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [],
    };
  } catch {
    return {
      overallScore: 65,
      communicationScore: 65,
      technicalScore: 65,
      confidenceScore: 65,
      summary: "Overall performance was satisfactory.",
      suggestions: [],
    };
  }
}

export async function analyzePostureFromImage(imageBase64: string): Promise<{
  score: number;
  feedback: string;
  issues: string[];
}> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 512,
    messages: [
      {
        role: "system",
        content: `You are an expert at analyzing body language and posture for professional video interviews.
        
Analyze the provided image and return a JSON object with:
- score (integer 0-100, posture quality score)
- feedback (string, 1-2 sentences of posture feedback)
- issues (array of specific issues found, e.g. "slouching", "poor eye contact", "bad lighting")

If you cannot see a person clearly, return score: 75, feedback: "Clear image needed for accurate analysis", issues: [].
Return ONLY valid JSON, no markdown.`,
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
              detail: "low",
            },
          },
          {
            type: "text",
            text: "Analyze the person's posture and body language for a professional video interview.",
          },
        ],
      },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "{}";
  try {
    const parsed = JSON.parse(raw) as { score: number; feedback: string; issues: string[] };
    return {
      score: Math.min(100, Math.max(0, Number(parsed.score) || 75)),
      feedback: parsed.feedback ?? "Posture analysis complete.",
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    };
  } catch {
    return { score: 75, feedback: "Unable to analyze posture at this time.", issues: [] };
  }
}

export async function generateTTS(text: string, voiceId: string): Promise<Buffer> {
  const validVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
  type Voice = typeof validVoices[number];
  const voice: Voice = (validVoices.includes(voiceId as Voice) ? voiceId : "nova") as Voice;

  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice,
    input: text,
    response_format: "mp3",
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "mp4" : mimeType.includes("wav") ? "wav" : "webm";
  const filename = `audio.${ext}`;

  const file = new File([new Uint8Array(audioBuffer)], filename, { type: mimeType });

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "gpt-4o-mini-transcribe",
    response_format: "json",
  });

  return transcription.text;
}


export function shouldAskFollowUp(questionCount: number, answerLength: number): boolean {
  if (questionCount < 2) return false;
  if (questionCount > 12) return false;
  const tooShort = answerLength < 80;
  const randomFollowUp = Math.random() < 0.35;
  return tooShort || randomFollowUp;
}

export function getInterviewerForQuestion(
  interviewerIds: number[],
  currentIndex: number,
  questionCount: number
): { interviewerId: number; nextIndex: number } {
  const idx = currentIndex % interviewerIds.length;
  const interviewerId = interviewerIds[idx];
  return { interviewerId, nextIndex: (idx + 1) % interviewerIds.length };
}

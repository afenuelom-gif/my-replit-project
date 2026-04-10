import { Router, type IRouter } from "express";
import { eq, and, asc, isNull } from "drizzle-orm";
import type { Request, Response } from "express";
import { optionalAuth } from "../../middlewares/requireAuth.js";

function isForbidden(session: { userId: string | null }, req: Request): boolean {
  return !!(session.userId && session.userId !== req.userId);
}
import {
  db,
  interviewersTable,
  sessionsTable,
  questionsTable,
  postureAnalysisTable,
  reportsTable,
} from "@workspace/db";
import {
  CreateSessionBody,
  GetSessionParams,
  GetNextQuestionParams,
  GetNextQuestionBody,
  AnalyzePostureParams,
  AnalyzePostureBody,
  CompleteSessionParams,
  CancelSessionParams,
  GetReportParams,
  TextToSpeechParams,
  TextToSpeechBody,
  TranscribeAnswerParams,
  TranscribeAnswerBody,
} from "@workspace/api-zod";
import {
  generateNextQuestion,
  evaluateAnswer,
  generateReport,
  analyzePostureFromImage,
  generateTTS,
  transcribeAudio,
  shouldAskFollowUp,
  generateDynamicInterviewers,
} from "../../lib/interviewAI.js";
import { seedInterviewersIfNeeded, HEYGEN_FEMALE_AVATARS, HEYGEN_MALE_AVATARS, FEMALE_VOICES } from "../../lib/seedInterviewers.js";

const router: IRouter = Router();

router.get("/interview/interviewers", async (_req, res): Promise<void> => {
  const interviewers = await db.select().from(interviewersTable).orderBy(asc(interviewersTable.id));
  res.json(interviewers);
});

router.post("/interview/sessions", optionalAuth, async (req, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { jobRole, jobDescription, durationMinutes: rawDuration } = parsed.data;
  const VALID_DURATIONS = [30, 35, 40, 45];
  const durationMinutes = VALID_DURATIONS.includes(rawDuration) ? rawDuration : 35;

  await seedInterviewersIfNeeded();

  const FEMALE_AVATAR_POOL = [
    "/avatars/interviewer-1.png",
    "/avatars/interviewer-3.png",
    "/avatars/interviewer-5.png",
  ];
  const MALE_AVATAR_POOL = [
    "/avatars/interviewer-2.png",
    "/avatars/interviewer-4.png",
    "/avatars/interviewer-6.png",
  ];
  const FEMALE_VOICE_IDS = FEMALE_VOICES;

  const interviewerCount = Math.floor(Math.random() * 2) + 2;

  const dynamicPersonas = await generateDynamicInterviewers(jobRole, jobDescription ?? null, interviewerCount);

  const [session] = await db
    .insert(sessionsTable)
    .values({
      userId: req.userId ?? null,
      jobRole,
      jobDescription: jobDescription ?? null,
      durationMinutes: durationMinutes ?? 35,
      status: "active",
      interviewerIds: "[]",
      currentInterviewerIndex: 0,
      questionCount: 0,
    })
    .returning();

  let selectedInterviewers: Array<typeof interviewersTable.$inferSelect>;

  if (dynamicPersonas && dynamicPersonas.length >= 2) {
    let femaleAvatarIdx = 0;
    let maleAvatarIdx = 0;

    const inserted = await db
      .insert(interviewersTable)
      .values(
        dynamicPersonas.map((p) => {
          const isFemale = FEMALE_VOICE_IDS.has(p.voiceId);
          const pool = isFemale ? FEMALE_AVATAR_POOL : MALE_AVATAR_POOL;
          const avatarUrl = pool[(isFemale ? femaleAvatarIdx++ : maleAvatarIdx++) % pool.length];
          // Assign gender-appropriate HeyGen avatar ID from fixed public pools
          const heygenPool = isFemale ? HEYGEN_FEMALE_AVATARS : HEYGEN_MALE_AVATARS;
          const heygenIdx = isFemale ? femaleAvatarIdx - 1 : maleAvatarIdx - 1;
          const heygenAvatarId = heygenPool[heygenIdx % heygenPool.length];
          return {
            name: p.name,
            title: p.title,
            company: p.company,
            personality: p.personality,
            voiceId: p.voiceId,
            avatarUrl,
            heygenAvatarId,
            sessionId: session.id,
          };
        })
      )
      .returning();
    selectedInterviewers = inserted;
  } else {
    const seededInterviewers = await db
      .select()
      .from(interviewersTable)
      .where(isNull(interviewersTable.sessionId));
    if (seededInterviewers.length < 2) {
      res.status(500).json({ error: "Not enough interviewers in database." });
      return;
    }
    const shuffled = [...seededInterviewers].sort(() => Math.random() - 0.5);
    selectedInterviewers = shuffled.slice(0, Math.min(interviewerCount, seededInterviewers.length));
  }

  const interviewerIds = selectedInterviewers.map((i) => i.id);

  await db
    .update(sessionsTable)
    .set({ interviewerIds: JSON.stringify(interviewerIds) })
    .where(eq(sessionsTable.id, session.id));

  const interviewer = selectedInterviewers[0];
  if (!interviewer) {
    res.status(500).json({ error: "No interviewers found" });
    return;
  }

  const firstQuestion = await generateNextQuestion(
    {
      jobRole,
      jobDescription: jobDescription ?? null,
      previousQA: [],
      interviewerPersonality: interviewer.personality,
      interviewerName: interviewer.name,
      questionCount: 0,
    },
    false
  );

  await db.insert(questionsTable).values({
    sessionId: session.id,
    questionText: firstQuestion,
    interviewerId: interviewer.id,
    isFollowUp: false,
    questionIndex: 0,
  });

  await db
    .update(sessionsTable)
    .set({ questionCount: 1 })
    .where(eq(sessionsTable.id, session.id));

  const updatedSession = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, session.id))
    .then((rows) => rows[0]);

  res.status(201).json({
    ...updatedSession,
    interviewerIds: JSON.parse(updatedSession.interviewerIds as string),
  });
});

router.get("/interview/sessions/:id", optionalAuth, async (req, res): Promise<void> => {
  const params = GetSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const session = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, params.data.id))
    .then((rows) => rows[0]);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (session.userId && session.userId !== req.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const interviewerIds: number[] = JSON.parse(session.interviewerIds as string);

  const questions = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.sessionId, session.id))
    .orderBy(asc(questionsTable.questionIndex));

  const allInterviewers = await db.select().from(interviewersTable);
  const sessionInterviewers = allInterviewers.filter((i) => interviewerIds.includes(i.id));

  res.json({
    session: { ...session, interviewerIds },
    questions,
    interviewers: sessionInterviewers,
  });
});

router.post("/interview/sessions/:id/next-question", optionalAuth, async (req, res): Promise<void> => {
  const params = GetNextQuestionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = GetNextQuestionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const session = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, params.data.id))
    .then((rows) => rows[0]);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (isForbidden(session, req)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (session.status === "completed") {
    res.json({ done: true, sessionStatus: "completed" });
    return;
  }

  const updateResult = await db
    .update(questionsTable)
    .set({ answerText: body.data.answerText })
    .where(
      and(
        eq(questionsTable.id, body.data.questionId),
        eq(questionsTable.sessionId, session.id),
        isNull(questionsTable.answerText)
      )
    )
    .returning({ id: questionsTable.id });

  if (updateResult.length === 0) {
    const existingQuestion = await db
      .select()
      .from(questionsTable)
      .where(
        and(
          eq(questionsTable.id, body.data.questionId),
          eq(questionsTable.sessionId, session.id)
        )
      )
      .then((rows) => rows[0]);

    if (!existingQuestion) {
      res.status(404).json({ error: "Question not found in this session" });
      return;
    }
    res.status(409).json({ error: "Answer already submitted for this question" });
    return;
  }

  const allQA = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.sessionId, session.id))
    .orderBy(asc(questionsTable.questionIndex));

  const interviewerIds: number[] = JSON.parse(session.interviewerIds as string);

  const maxQuestions = Math.floor((session.durationMinutes * 60) / 180);
  if (session.questionCount >= maxQuestions) {
    await db
      .update(sessionsTable)
      .set({ status: "completed" })
      .where(eq(sessionsTable.id, session.id));
    res.json({ done: true, sessionStatus: "completed" });
    return;
  }

  const isFollowUp = shouldAskFollowUp(session.questionCount, body.data.answerText.length);

  const currentIdx = session.currentInterviewerIndex % interviewerIds.length;
  const nextInterviewerIdx = isFollowUp
    ? currentIdx
    : (currentIdx + 1) % interviewerIds.length;
  const interviewerId = interviewerIds[nextInterviewerIdx];
  const nextIndex = nextInterviewerIdx;

  const interviewer = await db
    .select()
    .from(interviewersTable)
    .where(eq(interviewersTable.id, interviewerId))
    .then((rows) => rows[0]);

  if (!interviewer) {
    res.status(500).json({ error: "Interviewer not found" });
    return;
  }

  const previousQA = allQA.map((q) => ({
    question: q.questionText,
    answer: q.answerText ?? null,
  }));

  const nextQuestion = await generateNextQuestion(
    {
      jobRole: session.jobRole,
      jobDescription: session.jobDescription ?? null,
      previousQA,
      interviewerPersonality: interviewer.personality,
      interviewerName: interviewer.name,
      questionCount: session.questionCount,
    },
    isFollowUp
  );

  const [newQuestion] = await db
    .insert(questionsTable)
    .values({
      sessionId: session.id,
      questionText: nextQuestion,
      interviewerId: interviewer.id,
      isFollowUp,
      questionIndex: session.questionCount,
    })
    .returning();

  await db
    .update(sessionsTable)
    .set({
      questionCount: session.questionCount + 1,
      currentInterviewerIndex: nextIndex,
    })
    .where(eq(sessionsTable.id, session.id));

  res.json({
    done: false,
    question: newQuestion,
    interviewerId: interviewer.id,
    sessionStatus: "active",
  });
});

router.post("/interview/sessions/:id/posture", optionalAuth, async (req, res): Promise<void> => {
  const params = AnalyzePostureParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = AnalyzePostureBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const session = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, params.data.id))
    .then((rows) => rows[0]);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (isForbidden(session, req)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const analysis = await analyzePostureFromImage(body.data.imageBase64);

  await db.insert(postureAnalysisTable).values({
    sessionId: session.id,
    score: analysis.score,
    feedback: analysis.feedback,
    issues: JSON.stringify(analysis.issues),
  });

  res.json({
    score: analysis.score,
    feedback: analysis.feedback,
    issues: analysis.issues,
    timestamp: new Date().toISOString(),
  });
});

router.post("/interview/sessions/:id/complete", optionalAuth, async (req, res): Promise<void> => {
  const params = CompleteSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const session = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, params.data.id))
    .then((rows) => rows[0]);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (isForbidden(session, req)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [updated] = await db
    .update(sessionsTable)
    .set({ status: "completed" })
    .where(eq(sessionsTable.id, params.data.id))
    .returning();

  const interviewerIds: number[] = JSON.parse(updated.interviewerIds as string);
  res.json({ ...updated, interviewerIds });
});

router.delete("/interview/sessions/:id", optionalAuth, async (req, res): Promise<void> => {
  const params = CancelSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const session = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, params.data.id))
    .then((rows) => rows[0]);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (isForbidden(session, req)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [updated] = await db
    .update(sessionsTable)
    .set({ status: "cancelled" })
    .where(eq(sessionsTable.id, params.data.id))
    .returning();

  res.json({ id: updated.id, status: updated.status });
});

router.get("/interview/sessions/:id/report", optionalAuth, async (req, res): Promise<void> => {
  const params = GetReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const session = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, params.data.id))
    .then((rows) => rows[0]);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (session.userId && session.userId !== req.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const existing = await db
    .select()
    .from(reportsTable)
    .where(eq(reportsTable.sessionId, session.id))
    .then((rows) => rows[0]);

  if (existing) {
    const fallbackSuggestions = [
      "Complete the full interview to receive personalised improvement suggestions.",
      "Practice answering questions aloud before starting your next session.",
      "Review common interview questions for your target role to build confidence.",
    ];
    const rawSuggestions: string[] = existing.suggestions ? JSON.parse(existing.suggestions) : [];
    const guaranteedSuggestions = rawSuggestions.length >= 3
      ? rawSuggestions.slice(0, 3)
      : [...rawSuggestions, ...fallbackSuggestions.slice(rawSuggestions.length)];
    res.json({
      sessionId: session.id,
      overallScore: existing.overallScore,
      communicationScore: existing.communicationScore,
      technicalScore: existing.technicalScore,
      confidenceScore: existing.confidenceScore,
      postureScore: existing.postureScore,
      answerFeedback: existing.answerFeedback ? JSON.parse(existing.answerFeedback) : [],
      postureNotes: existing.postureNotes ? JSON.parse(existing.postureNotes) : [],
      suggestions: guaranteedSuggestions,
      summary: existing.summary,
      generatedAt: existing.generatedAt.toISOString(),
    });
    return;
  }

  const questions = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.sessionId, session.id))
    .orderBy(asc(questionsTable.questionIndex));

  const postureRecords = await db
    .select()
    .from(postureAnalysisTable)
    .where(eq(postureAnalysisTable.sessionId, session.id));

  const postureScores = postureRecords.map((p) => p.score);
  const postureNotes = (() => {
    const all = postureRecords.flatMap((p) => {
      const issues: string[] = JSON.parse(p.issues as string);
      return issues;
    });
    const seen = new Set<string>();
    return all.filter(note => {
      const key = note.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  const avgPosture =
    postureScores.length > 0
      ? Math.round(postureScores.reduce((a, b) => a + b, 0) / postureScores.length)
      : 70;

  const answeredQA = questions.filter((q) => q.answerText != null);

  const answerFeedbacks = await Promise.all(
    answeredQA.map(async (q) => {
      const eval_ = await evaluateAnswer(
        q.questionText,
        q.answerText ?? "",
        session.jobRole,
        session.jobDescription ?? null
      );
      return {
        questionId: q.id,
        questionText: q.questionText,
        answerText: q.answerText ?? null,
        score: eval_.score,
        feedback: eval_.feedback,
        strengths: eval_.strengths,
        improvements: eval_.improvements,
      };
    })
  );

  let reportData: {
    overallScore: number;
    communicationScore: number;
    technicalScore: number;
    confidenceScore: number;
    summary: string;
    suggestions: string[];
  };

  if (answeredQA.length === 0) {
    reportData = {
      overallScore: 0,
      communicationScore: 0,
      technicalScore: 0,
      confidenceScore: 0,
      summary:
        "No answers were provided during this session. Please complete the interview to receive a meaningful evaluation.",
      suggestions: [
        "Complete the full interview to receive personalised improvement suggestions.",
        "Practice answering questions aloud before starting your next session.",
        "Review common interview questions for your target role to build confidence.",
      ],
    };
  } else {
    const qaItems = questions.map((q) => ({
      question: q.questionText,
      answer: q.answerText ?? null,
    }));
    reportData = await generateReport(
      session.jobRole,
      session.jobDescription ?? null,
      qaItems,
      postureScores
    );
  }

  await db.insert(reportsTable).values({
    userId: session.userId ?? null,
    sessionId: session.id,
    overallScore: reportData.overallScore,
    communicationScore: reportData.communicationScore,
    technicalScore: reportData.technicalScore,
    confidenceScore: reportData.confidenceScore,
    postureScore: answeredQA.length === 0 ? 0 : avgPosture,
    summary: reportData.summary,
    suggestions: JSON.stringify(reportData.suggestions),
    answerFeedback: JSON.stringify(answerFeedbacks),
    postureNotes: JSON.stringify(postureNotes),
  });

  res.json({
    sessionId: session.id,
    overallScore: reportData.overallScore,
    communicationScore: reportData.communicationScore,
    technicalScore: reportData.technicalScore,
    confidenceScore: reportData.confidenceScore,
    postureScore: answeredQA.length === 0 ? 0 : avgPosture,
    answerFeedback: answerFeedbacks,
    postureNotes,
    suggestions: reportData.suggestions,
    summary: reportData.summary,
    generatedAt: new Date().toISOString(),
  });
});

router.post("/interview/sessions/:id/tts", optionalAuth, async (req, res): Promise<void> => {
  const params = TextToSpeechParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const session = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, params.data.id))
    .then((rows) => rows[0]);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (isForbidden(session, req)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const body = TextToSpeechBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const interviewer = await db
    .select()
    .from(interviewersTable)
    .where(eq(interviewersTable.id, body.data.interviewerId))
    .then((rows) => rows[0]);

  const voiceId = interviewer?.voiceId ?? "nova";
  const audioBuffer = await generateTTS(body.data.text, voiceId);

  res.json({
    audioBase64: audioBuffer.toString("base64"),
    format: "mp3",
  });
});

router.post("/interview/sessions/:id/transcribe", optionalAuth, async (req, res): Promise<void> => {
  const params = TranscribeAnswerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const session = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, params.data.id))
    .then((rows) => rows[0]);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (isForbidden(session, req)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const body = TranscribeAnswerBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const mimeType = body.data.mimeType ?? "audio/webm";
  const audioBuffer = Buffer.from(body.data.audioBase64, "base64");
  const text = await transcribeAudio(audioBuffer, mimeType);

  res.json({ text });
});

// POST /api/interview/heygen/token — get a short-lived HeyGen streaming access token
router.post("/interview/heygen/token", optionalAuth, async (_req, res): Promise<void> => {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "HeyGen integration not configured" });
    return;
  }
  try {
    const resp = await fetch("https://api.heygen.com/v1/streaming.create_token", {
      method: "POST",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
    });
    if (!resp.ok) {
      const text = await resp.text();
      if (resp.status === 410) {
        res.status(410).json({ error: "HeyGen Streaming Avatar API was retired on March 31, 2026 (sunset). Please contact HeyGen support to migrate your credits to their LiveAvatar product." });
        return;
      }
      res.status(resp.status).json({ error: `HeyGen error (${resp.status}): ${text}` });
      return;
    }
    const data = await resp.json() as { data?: { token?: string }; error?: string };
    const token = data?.data?.token;
    if (!token) {
      res.status(502).json({ error: "No token returned from HeyGen" });
      return;
    }
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// HeyGen Video Generation API (non-streaming — still active after March 2026)
// ---------------------------------------------------------------------------

type HeyGenGender = "male" | "female";

// In-memory caches — populated on first call per session
const heygenVoiceCache: { male?: string; female?: string; fetchedAt?: number } = {};
const heygenAvatarCache: { female: string[]; male: string[]; fetchedAt?: number } = { female: [], male: [] };
const HEYGEN_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getHeyGenVoice(apiKey: string, gender: HeyGenGender): Promise<string | undefined> {
  const now = Date.now();
  if (heygenVoiceCache.fetchedAt && now - heygenVoiceCache.fetchedAt < HEYGEN_CACHE_TTL_MS) {
    return gender === "male" ? heygenVoiceCache.male : heygenVoiceCache.female;
  }
  try {
    const resp = await fetch("https://api.heygen.com/v2/voices", {
      headers: { "x-api-key": apiKey },
    });
    if (!resp.ok) return undefined;
    const data = await resp.json() as { data?: { voices?: Array<{ voice_id: string; gender?: string; language?: string; name?: string }> } };
    const voices = data?.data?.voices ?? [];
    const isEnglish = (v: { language?: string }) =>
      !v.language || v.language.toLowerCase().startsWith("en");
    const female = voices.find(v => v.gender?.toLowerCase() === "female" && isEnglish(v));
    const male = voices.find(v => v.gender?.toLowerCase() === "male" && isEnglish(v));
    heygenVoiceCache.female = female?.voice_id;
    heygenVoiceCache.male = male?.voice_id;
    heygenVoiceCache.fetchedAt = now;
    return gender === "male" ? heygenVoiceCache.male : heygenVoiceCache.female;
  } catch {
    return undefined;
  }
}

async function getHeyGenVideoAvatar(apiKey: string, gender: HeyGenGender, slot: number): Promise<string | undefined> {
  const now = Date.now();
  const needsRefresh = !heygenAvatarCache.fetchedAt || now - heygenAvatarCache.fetchedAt > HEYGEN_CACHE_TTL_MS;
  if (needsRefresh) {
    try {
      const resp = await fetch("https://api.heygen.com/v2/avatars", { headers: { "x-api-key": apiKey } });
      if (!resp.ok) return undefined;
      const data = await resp.json() as { data?: { avatars?: Array<{ avatar_id: string; gender?: string; premium?: boolean }> } };
      const all = data?.data?.avatars ?? [];
      // Prefer professional-looking (non-premium) avatars
      const nonPremium = all.filter(a => !a.premium);
      heygenAvatarCache.female = nonPremium
        .filter(a => a.gender?.toLowerCase() === "female")
        .map(a => a.avatar_id)
        .filter((id, i, arr) => arr.indexOf(id) === i); // dedupe
      heygenAvatarCache.male = nonPremium
        .filter(a => a.gender?.toLowerCase() === "male")
        .map(a => a.avatar_id)
        .filter((id, i, arr) => arr.indexOf(id) === i);
      heygenAvatarCache.fetchedAt = now;
    } catch {
      return undefined;
    }
  }
  const pool = gender === "male" ? heygenAvatarCache.male : heygenAvatarCache.female;
  if (!pool.length) return undefined;
  // Use slot (interviewer ID) for consistent assignment across requests
  return pool[slot % pool.length];
}

// GET /api/interview/heygen/video-avatars — list avatars available for video generation
router.get("/interview/heygen/video-avatars", optionalAuth, async (_req, res): Promise<void> => {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) { res.status(503).json({ error: "HeyGen not configured" }); return; }
  try {
    const resp = await fetch("https://api.heygen.com/v2/avatars", { headers: { "x-api-key": apiKey } });
    const raw = await resp.json();
    res.json(raw);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/interview/heygen/voices — list available voices (for debugging / manual selection)
router.get("/interview/heygen/voices", optionalAuth, async (_req, res): Promise<void> => {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) { res.status(503).json({ error: "HeyGen not configured" }); return; }
  try {
    const resp = await fetch("https://api.heygen.com/v2/voices", { headers: { "x-api-key": apiKey } });
    const raw = await resp.json();
    res.json(raw);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/interview/heygen/generate-video — kick off async video generation
router.post("/interview/heygen/generate-video", optionalAuth, async (req, res): Promise<void> => {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "HeyGen not configured" });
    return;
  }
  const { interviewerId, text, gender } = req.body as {
    interviewerId?: number; text?: string; gender?: HeyGenGender;
  };
  if (!interviewerId || !text) {
    res.status(400).json({ error: "interviewerId and text are required" });
    return;
  }
  try {
    const resolvedGender: HeyGenGender = gender ?? "female";
    const [voiceId, avatarId] = await Promise.all([
      getHeyGenVoice(apiKey, resolvedGender),
      getHeyGenVideoAvatar(apiKey, resolvedGender, interviewerId),
    ]);
    if (!voiceId) {
      res.status(503).json({ error: "Could not fetch HeyGen voices — check API key" });
      return;
    }
    if (!avatarId) {
      res.status(503).json({ error: "Could not fetch HeyGen avatar list — check API key" });
      return;
    }
    const voiceConfig = { type: "text", input_text: text, voice_id: voiceId };

    const payload = {
      video_inputs: [{
        character: { type: "avatar", avatar_id: avatarId, avatar_style: "normal" },
        voice: voiceConfig,
      }],
      dimension: { width: 640, height: 480 },
    };

    const resp = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const raw = await resp.json() as { data?: { video_id?: string }; error?: { message?: string; code?: string } };
    if (!resp.ok || !raw?.data?.video_id) {
      const msg = raw?.error?.message ?? `HeyGen video generate error (${resp.status})`;
      res.status(resp.status >= 400 ? resp.status : 502).json({ error: msg });
      return;
    }
    res.json({ videoId: raw.data.video_id });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/interview/heygen/video-status/:videoId — poll generation status
router.get("/interview/heygen/video-status/:videoId", optionalAuth, async (req, res): Promise<void> => {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "HeyGen not configured" });
    return;
  }
  const videoId = String(req.params.videoId);
  try {
    const resp = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`, {
      headers: { "x-api-key": apiKey },
    });
    const raw = await resp.json() as {
      data?: { status?: string; video_url?: string; thumbnail_url?: string; error?: string };
      code?: number; message?: string;
    };
    if (!resp.ok) {
      res.status(resp.status).json({ error: raw?.message ?? `Status check error (${resp.status})` });
      return;
    }
    const status = raw?.data?.status ?? "processing";
    res.json({
      status,           // "processing" | "completed" | "failed" | "pending"
      videoUrl: raw?.data?.video_url ?? null,
      thumbnailUrl: raw?.data?.thumbnail_url ?? null,
      error: raw?.data?.error ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// D-ID Talk Streams proxy routes (real-time WebRTC avatar streaming)
// ---------------------------------------------------------------------------

const DID_API_BASE = "https://api.d-id.com";

const DID_FEMALE_PRESENTER = "https://d-id-public-bucket.s3.amazonaws.com/alice.jpg";
const DID_MALE_PRESENTER   = "https://d-id-public-bucket.s3.amazonaws.com/alice.jpg";

function getDIDHeaders(): { Authorization: string; "content-type": string } | null {
  const apiKey = process.env.DID_API_KEY;
  if (!apiKey) return null;
  return {
    Authorization: `Basic ${apiKey}`,
    "content-type": "application/json",
  };
}

/**
 * D-ID's session_id is a full AWS ALB Set-Cookie string like:
 *   "AWSALB=xxx; Expires=...; AWSALBCORS=yyy; Expires=..."
 * We need to forward it as a Cookie header so AWS routes subsequent
 * requests (SDP / ICE / talk / delete) to the same backend server.
 */
function extractDIDCookie(sessionId: string): string {
  const cookies: string[] = [];
  for (const part of sessionId.split(";")) {
    const t = part.trim();
    if (t.startsWith("AWSALB=") || t.startsWith("AWSALBCORS=")) cookies.push(t);
  }
  return cookies.join("; ");
}

function didHeadersWithSession(
  base: Record<string, string>,
  sessionId?: string
): Record<string, string> {
  if (!sessionId) return base;
  const cookie = extractDIDCookie(sessionId);
  if (!cookie) return base;
  return { ...base, Cookie: cookie };
}

async function didProxy(
  upstreamUrl: string,
  method: string,
  headers: Record<string, string>,
  body?: unknown
): Promise<{ status: number; data: unknown }> {
  const resp = await fetch(upstreamUrl, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  let data: unknown = text;
  try { data = JSON.parse(text); } catch { /* keep as string */ }
  return { status: resp.status, data };
}

/**
 * In-memory record of the last D-ID stream created.
 * D-ID free tier allows only 1 concurrent stream; we track the active one
 * so we can delete it before opening a new session.
 */
let activeDIDStream: { id: string; sessionId: string } | null = null;

/** Delete the currently tracked D-ID stream (no-op if none) */
async function deleteTrackedDIDStream(headers: Record<string, string>): Promise<void> {
  if (!activeDIDStream) return;
  const { id, sessionId } = activeDIDStream;
  activeDIDStream = null; // clear before await so a concurrent request doesn't double-delete
  const headersWithCookie = didHeadersWithSession(headers, sessionId);
  await didProxy(`${DID_API_BASE}/talks/streams/${id}`, "DELETE", headersWithCookie, {
    session_id: sessionId,
  }).catch(() => { /* best-effort */ });
}

// POST /api/interview/did/streams — create a new D-ID streaming session
router.post("/interview/did/streams", optionalAuth, async (req, res): Promise<void> => {
  const headers = getDIDHeaders();
  if (!headers) { res.status(503).json({ error: "D-ID not configured — set DID_API_KEY" }); return; }

  const gender = (req.body as { gender?: string }).gender;
  const sourceUrl = gender === "male" ? DID_MALE_PRESENTER : DID_FEMALE_PRESENTER;

  try {
    // Delete any stale stream from a previous session to free the concurrent-stream slot
    await deleteTrackedDIDStream(headers);

    const { status, data } = await didProxy(`${DID_API_BASE}/talks/streams`, "POST", headers, { source_url: sourceUrl });

    // Track the new stream so we can clean it up next time
    if ((status === 200 || status === 201) && data && typeof data === "object") {
      const d = data as { id?: string; session_id?: string };
      if (d.id) activeDIDStream = { id: d.id, sessionId: d.session_id ?? "" };
    }

    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/interview/did/streams/:streamId/sdp — send SDP answer from client
router.post("/interview/did/streams/:streamId/sdp", optionalAuth, async (req, res): Promise<void> => {
  const base = getDIDHeaders();
  if (!base) { res.status(503).json({ error: "D-ID not configured" }); return; }

  const { streamId } = req.params;
  const { answer, session_id } = req.body as { answer: unknown; session_id: string };
  const headers = didHeadersWithSession(base, session_id);

  try {
    const { status, data } = await didProxy(`${DID_API_BASE}/talks/streams/${streamId}/sdp`, "POST", headers, { answer, session_id });
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/interview/did/streams/:streamId/ice — relay ICE candidate to D-ID
router.post("/interview/did/streams/:streamId/ice", optionalAuth, async (req, res): Promise<void> => {
  const base = getDIDHeaders();
  if (!base) { res.status(503).json({ error: "D-ID not configured" }); return; }

  const { streamId } = req.params;
  const { candidate, session_id } = req.body as { candidate: unknown; session_id: string };
  const headers = didHeadersWithSession(base, session_id);

  try {
    const { status, data } = await didProxy(`${DID_API_BASE}/talks/streams/${streamId}/ice`, "POST", headers, { candidate, session_id });
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/interview/did/streams/:streamId/talk — make the avatar speak
router.post("/interview/did/streams/:streamId/talk", optionalAuth, async (req, res): Promise<void> => {
  const base = getDIDHeaders();
  if (!base) { res.status(503).json({ error: "D-ID not configured" }); return; }

  const { streamId } = req.params;
  const { script, session_id, config } = req.body as {
    script: unknown; session_id: string; config?: unknown;
  };
  const headers = didHeadersWithSession(base, session_id);

  try {
    const { status, data } = await didProxy(`${DID_API_BASE}/talks/streams/${streamId}/talk`, "POST", headers, { script, session_id, config });
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/interview/did/streams/:streamId — close and clean up the stream
router.delete("/interview/did/streams/:streamId", optionalAuth, async (req, res): Promise<void> => {
  const base = getDIDHeaders();
  if (!base) { res.status(503).json({ error: "D-ID not configured" }); return; }

  const { streamId } = req.params;
  const { session_id } = req.body as { session_id?: string };
  const headers = didHeadersWithSession(base, session_id);

  // Clear server-side tracking if this is the currently tracked stream
  if (activeDIDStream?.id === streamId) activeDIDStream = null;

  try {
    const { status, data } = await didProxy(`${DID_API_BASE}/talks/streams/${streamId}`, "DELETE", headers, { session_id: session_id ?? "" });
    res.status(status === 204 ? 200 : status).json(data ?? {});
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// D-ID Talks API routes (non-streaming avatar video generation)
// ---------------------------------------------------------------------------

// POST /api/interview/did/talks — generate a talking-head video clip
router.post("/interview/did/talks", optionalAuth, async (req, res): Promise<void> => {
  const headers = getDIDHeaders();
  if (!headers) { res.status(503).json({ error: "D-ID not configured — set DID_API_KEY" }); return; }

  const { text, gender } = req.body as { text: string; gender?: string };
  if (!text) { res.status(400).json({ error: "text is required" }); return; }

  const sourceUrl = gender === "male" ? DID_MALE_PRESENTER : DID_FEMALE_PRESENTER;
  const voiceId   = gender === "male" ? "en-US-GuyNeural" : "en-US-JennyNeural";

  const body = {
    source_url: sourceUrl,
    script: {
      type: "text",
      input: text,
      provider: { type: "microsoft", voice_id: voiceId },
    },
    config: { fluent: true, pad_audio: 0 },
  };

  try {
    const { status, data } = await didProxy(`${DID_API_BASE}/talks`, "POST", headers, body);
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/interview/did/talks/:id — poll talk generation status
router.get("/interview/did/talks/:id", optionalAuth, async (req, res): Promise<void> => {
  const headers = getDIDHeaders();
  if (!headers) { res.status(503).json({ error: "D-ID not configured" }); return; }

  const talkId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const { status, data } = await didProxy(`${DID_API_BASE}/talks/${talkId}`, "GET", headers);
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;

import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
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
} from "../../lib/interviewAI.js";
import { seedInterviewersIfNeeded } from "../../lib/seedInterviewers.js";

const router: IRouter = Router();

router.get("/interview/interviewers", async (_req, res): Promise<void> => {
  const interviewers = await db.select().from(interviewersTable).orderBy(asc(interviewersTable.id));
  res.json(interviewers);
});

router.post("/interview/sessions", async (req, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { jobRole, jobDescription, durationMinutes: rawDuration } = parsed.data;
  const VALID_DURATIONS = [30, 35, 40, 45];
  const durationMinutes = VALID_DURATIONS.includes(rawDuration) ? rawDuration : 35;

  await seedInterviewersIfNeeded();

  const allInterviewers = await db.select().from(interviewersTable);
  if (allInterviewers.length < 2) {
    res.status(500).json({ error: "Not enough interviewers in database." });
    return;
  }

  const interviewerCount = Math.min(Math.floor(Math.random() * 2) + 2, allInterviewers.length);
  const shuffled = [...allInterviewers].sort(() => Math.random() - 0.5);
  const selectedInterviewers = shuffled.slice(0, interviewerCount);
  const interviewerIds = selectedInterviewers.map((i) => i.id);

  const [session] = await db
    .insert(sessionsTable)
    .values({
      jobRole,
      jobDescription: jobDescription ?? null,
      durationMinutes: durationMinutes ?? 35,
      status: "active",
      interviewerIds: JSON.stringify(interviewerIds),
      currentInterviewerIndex: 0,
      questionCount: 0,
    })
    .returning();

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

router.get("/interview/sessions/:id", async (req, res): Promise<void> => {
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

router.post("/interview/sessions/:id/next-question", async (req, res): Promise<void> => {
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
        eq(questionsTable.sessionId, session.id)
      )
    )
    .returning({ id: questionsTable.id });

  if (updateResult.length === 0) {
    res.status(404).json({ error: "Question not found in this session" });
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

router.post("/interview/sessions/:id/posture", async (req, res): Promise<void> => {
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

router.post("/interview/sessions/:id/complete", async (req, res): Promise<void> => {
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

  const [updated] = await db
    .update(sessionsTable)
    .set({ status: "completed" })
    .where(eq(sessionsTable.id, params.data.id))
    .returning();

  const interviewerIds: number[] = JSON.parse(updated.interviewerIds as string);
  res.json({ ...updated, interviewerIds });
});

router.get("/interview/sessions/:id/report", async (req, res): Promise<void> => {
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

  const existing = await db
    .select()
    .from(reportsTable)
    .where(eq(reportsTable.sessionId, session.id))
    .then((rows) => rows[0]);

  if (existing) {
    res.json({
      sessionId: session.id,
      overallScore: existing.overallScore,
      communicationScore: existing.communicationScore,
      technicalScore: existing.technicalScore,
      confidenceScore: existing.confidenceScore,
      postureScore: existing.postureScore,
      answerFeedback: JSON.parse(existing.answerFeedback),
      postureNotes: JSON.parse(existing.postureNotes),
      suggestions: JSON.parse(existing.suggestions),
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
  const postureNotes = [
    ...new Set(
      postureRecords.flatMap((p) => {
        const issues: string[] = JSON.parse(p.issues as string);
        return issues;
      })
    ),
  ];

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

  const qaItems = questions.map((q) => ({
    question: q.questionText,
    answer: q.answerText ?? null,
  }));

  const reportData = await generateReport(
    session.jobRole,
    session.jobDescription ?? null,
    qaItems,
    postureScores
  );

  await db.insert(reportsTable).values({
    sessionId: session.id,
    overallScore: reportData.overallScore,
    communicationScore: reportData.communicationScore,
    technicalScore: reportData.technicalScore,
    confidenceScore: reportData.confidenceScore,
    postureScore: avgPosture,
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
    postureScore: avgPosture,
    answerFeedback: answerFeedbacks,
    postureNotes,
    suggestions: reportData.suggestions,
    summary: reportData.summary,
    generatedAt: new Date().toISOString(),
  });
});

router.post("/interview/sessions/:id/tts", async (req, res): Promise<void> => {
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

router.post("/interview/sessions/:id/transcribe", async (req, res): Promise<void> => {
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

export default router;

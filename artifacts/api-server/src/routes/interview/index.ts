import { Router, type IRouter } from "express";
import { eq, and, asc, desc, isNull, gte, lte } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { optionalAuth, requireAuth } from "../../middlewares/requireAuth.js";

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
  sessionFeedbackTable,
  usersTable,
} from "@workspace/db";
import { sendFeedbackEmail } from "../../lib/sendEmail.js";
import { sendContactEmail } from "../../lib/sendContactEmail.js";
import { z } from "zod";
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
import { isAdminUserOrEmail, hasAnyAdminConfigured } from "../../lib/adminAuth.js";

const router: IRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/interview/parse-document", upload.single("file"), async (req, res): Promise<void> => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const ext = file.originalname.toLowerCase().split(".").pop();

  try {
    let text = "";

    if (ext === "pdf") {
      // Lazy require to prevent pdf-parse's module-level self-test from running at startup
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(file.buffer);
      text = data.text;
    } else if (ext === "docx" || ext === "doc") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      text = result.value;
    } else if (ext === "txt") {
      text = file.buffer.toString("utf-8");
    } else {
      res.status(400).json({ error: "Unsupported file type. Please upload a PDF, DOCX, DOC, or TXT file." });
      return;
    }

    text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

    if (!text || text.length < 10) {
      res.status(422).json({ error: "Could not extract readable text from the file. Please try a different format." });
      return;
    }

    res.json({ text });
  } catch (err) {
    console.error("Document parse error:", err);
    res.status(500).json({ error: "Failed to parse document. Please try a different file." });
  }
});

const ContactBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  subject: z.string().min(1),
  message: z.string().min(1),
});

router.post("/contact", async (req, res): Promise<void> => {
  const body = ContactBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid contact data" });
    return;
  }
  try {
    await sendContactEmail(body.data);
    res.json({ success: true });
  } catch (err) {
    console.error("[sendContactEmail]", err);
    res.status(500).json({ error: "Failed to send contact message" });
  }
});

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

  // Credit gate — enforce session limits before doing any expensive work
  let userPlan: string | null = null;
  if (req.userId) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    if (user) {
      userPlan = user.plan;
      if (user.plan === "free" && user.trialUsed) {
        res.status(403).json({ error: "You have used your free trial session. Upgrade to continue.", code: "NO_CREDITS" });
        return;
      }
      if (user.plan !== "free" && user.plan !== "pro" && user.sessionCredits <= 0) {
        res.status(403).json({ error: "You have no sessions remaining this month. Upgrade or wait for your next billing cycle.", code: "NO_CREDITS" });
        return;
      }
    }
  }

  const { jobRole, jobDescription, resumeText, durationMinutes: rawDuration } = parsed.data;
  const VALID_DURATIONS = [15, 30, 35, 40, 45];
  const parsedDuration = VALID_DURATIONS.includes(rawDuration) ? rawDuration : 30;
  // Free trial users are always capped at 15 minutes
  const durationMinutes = (!userPlan || userPlan === "free") ? 15 : parsedDuration;

  await seedInterviewersIfNeeded();

  const FEMALE_AVATAR_POOL = [
    "/avatars/interviewer-1.png",
    "/avatars/interviewer-3.png",
    "/avatars/interviewer-5.png",
    "/avatars/interviewer-7.png",
    "/avatars/interviewer-9.png",
    "/avatars/interviewer-11.png",
    "/avatars/interviewer-13.png",
    "/avatars/interviewer-15.png",
    "/avatars/interviewer-17.png",
  ];
  const MALE_AVATAR_POOL = [
    "/avatars/interviewer-2.png",
    "/avatars/interviewer-4.png",
    "/avatars/interviewer-6.png",
    "/avatars/interviewer-8.png",
    "/avatars/interviewer-10.png",
    "/avatars/interviewer-12.png",
    "/avatars/interviewer-14.png",
    "/avatars/interviewer-16.png",
    "/avatars/interviewer-18.png",
  ];
  const FEMALE_VOICE_IDS = FEMALE_VOICES;

  const interviewerCount = Math.floor(Math.random() * 2) + 2;

  const dynamicPersonas = await generateDynamicInterviewers(jobRole, jobDescription ?? null, resumeText ?? null, interviewerCount);

  const [session] = await db
    .insert(sessionsTable)
    .values({
      userId: req.userId ?? null,
      jobRole,
      jobDescription: jobDescription ?? null,
      resumeText: resumeText ?? null,
      durationMinutes: durationMinutes ?? 35,
      status: "active",
      interviewerIds: "[]",
      currentInterviewerIndex: 0,
      questionCount: 0,
    })
    .returning();

  let selectedInterviewers: Array<typeof interviewersTable.$inferSelect>;

  if (dynamicPersonas && dynamicPersonas.length >= 2) {
    let femaleAvatarIdx = Math.floor(Math.random() * FEMALE_AVATAR_POOL.length);
    let maleAvatarIdx = Math.floor(Math.random() * MALE_AVATAR_POOL.length);

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

  await generateTTS("Warm up.", interviewer.voiceId).catch(() => null);

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

  const elapsedMinutes = (Date.now() - session.createdAt.getTime()) / 60000;
  const timeUp = elapsedMinutes >= session.durationMinutes;
  if (timeUp) {
    const thankYouQuestion = `Thank you for interviewing with PrepInterv AI. Please review your performance report!`;
    const interviewer = await db
      .select()
      .from(interviewersTable)
      .where(eq(interviewersTable.id, interviewerIds[session.currentInterviewerIndex % interviewerIds.length]))
      .then((rows) => rows[0]);

    if (!interviewer) {
      res.status(500).json({ error: "Interviewer not found" });
      return;
    }

    const [newQuestion] = await db
      .insert(questionsTable)
      .values({
        sessionId: session.id,
        questionText: thankYouQuestion,
        interviewerId: interviewer.id,
        isFollowUp: false,
        questionIndex: session.questionCount,
      })
      .returning();

    await db
      .update(sessionsTable)
      .set({
        questionCount: session.questionCount + 1,
        currentInterviewerIndex: session.currentInterviewerIndex % interviewerIds.length,
      })
      .where(eq(sessionsTable.id, session.id));

    res.json({
      done: false,
      question: newQuestion,
      interviewerId: interviewer.id,
      sessionStatus: "active",
      isFinalThankYou: true,
    });
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
      resumeText: session.resumeText ?? null,
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

  // Decrement session credits for logged-in users
  let sessionCreditsRemaining: number | null = null;
  if (session.userId) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId)).limit(1);
    if (user) {
      if (user.plan === "free") {
        await db.update(usersTable).set({ trialUsed: true }).where(eq(usersTable.id, session.userId));
        sessionCreditsRemaining = 0;
      } else if (user.plan !== "pro" && user.sessionCredits > 0) {
        const newCredits = user.sessionCredits - 1;
        await db.update(usersTable).set({ sessionCredits: newCredits }).where(eq(usersTable.id, session.userId));
        sessionCreditsRemaining = newCredits;
      } else if (user.plan === "pro") {
        sessionCreditsRemaining = null; // unlimited
      } else {
        sessionCreditsRemaining = user.sessionCredits;
      }
    }
  }

  const interviewerIds: number[] = JSON.parse(updated.interviewerIds as string);
  res.json({ ...updated, interviewerIds, sessionCreditsRemaining });
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
      : 0;

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
    summary: string;
    suggestions: string[];
  };

  if (answeredQA.length === 0) {
    reportData = {
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

  // Category scores = averages of per-question sub-scores (fully consistent with question scores)
  const avg = (key: keyof typeof answerFeedbacks[0]) =>
    answerFeedbacks.length > 0
      ? Math.round(answerFeedbacks.reduce((sum, f) => sum + (f[key] as number), 0) / answerFeedbacks.length)
      : 0;
  const avgQuestionScore = avg("score");
  const communicationScore = avg("communicationScore");
  const technicalScore = avg("technicalScore");
  const confidenceScore = avg("confidenceScore");

  // Overall Score = 40% question average + 60% soft-skills average
  // Soft Skills = (communication + technical + confidence + posture) / 4
  const postureForOverall = answeredQA.length === 0 ? 0 : avgPosture;
  const softSkillsAvg = (communicationScore + technicalScore + confidenceScore + postureForOverall) / 4;
  const overallScore = Math.round(0.4 * avgQuestionScore + 0.6 * softSkillsAvg);

  await db.insert(reportsTable).values({
    userId: session.userId ?? null,
    sessionId: session.id,
    overallScore,
    communicationScore,
    technicalScore,
    confidenceScore,
    postureScore: answeredQA.length === 0 ? 0 : avgPosture,
    summary: reportData.summary,
    suggestions: JSON.stringify(reportData.suggestions),
    answerFeedback: JSON.stringify(answerFeedbacks),
    postureNotes: JSON.stringify(postureNotes),
  });

  // Discard sensitive input data — resume and job description are no longer
  // needed once the report has been generated.
  await db
    .update(sessionsTable)
    .set({ resumeText: null, jobDescription: null })
    .where(eq(sessionsTable.id, session.id));

  res.json({
    sessionId: session.id,
    overallScore,
    communicationScore,
    technicalScore,
    confidenceScore,
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

  // Strip parenthetical/bracketed sound descriptions like (whirring sound), [noise], (clicking), etc.
  const stripped = text
    .replace(/\([^)]*\)/g, "")   // remove (anything in parens)
    .replace(/\[[^\]]*\]/g, "")  // remove [anything in brackets]
    .trim();

  const normalized = stripped
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = normalized ? normalized.split(" ").filter(w => w.length > 0) : [];
  const FILLER = new Set(["uh", "um", "hmm", "mm", "ah", "er", "oh", "okay", "ok", "yeah", "yes", "no", "like"]);
  const meaningfulWords = words.filter(w => !FILLER.has(w));

  const isEmptyOrNoise = !normalized || words.length < 3 || meaningfulWords.length < 2;

  if (isEmptyOrNoise) {
    res.status(422).json({
      error: "NO_CLEAR_RESPONSE",
      message: "We didn't get a response. Please answer the question.",
      text: "",
    });
    return;
  }

  res.json({ text });
});

// ── GET /interview/sessions/:id/feedback/status ───────────────────────────

router.get("/interview/sessions/:id/feedback/status", optionalAuth, async (req: Request, res: Response) => {
  const sessionId = parseInt(req.params.id);
  if (isNaN(sessionId)) { res.status(400).json({ error: "Invalid session ID" }); return; }

  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId)).limit(1);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  if (isForbidden(session, req)) { res.status(403).json({ error: "Forbidden" }); return; }

  const [existing] = await db
    .select({ id: sessionFeedbackTable.id })
    .from(sessionFeedbackTable)
    .where(eq(sessionFeedbackTable.sessionId, sessionId))
    .limit(1);

  res.json({ exists: !!existing });
});

// ── POST /interview/sessions/:id/feedback ─────────────────────────────────

const FeedbackBody = z.object({
  questionRelevance: z.enum(["highly_relevant", "somewhat_relevant", "not_relevant"]),
  feedbackHelpful: z.boolean(),
  additionalComments: z.string().nullable().optional(),
});

router.post("/interview/sessions/:id/feedback", optionalAuth, async (req: Request, res: Response) => {
  const sessionId = parseInt(req.params.id);
  if (isNaN(sessionId)) { res.status(400).json({ error: "Invalid session ID" }); return; }

  const body = FeedbackBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid feedback data" }); return; }

  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId)).limit(1);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  if (isForbidden(session, req)) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.insert(sessionFeedbackTable).values({
    sessionId,
    userId: req.userId ?? null,
    jobRole: session.jobRole,
    questionRelevance: body.data.questionRelevance,
    feedbackHelpful: body.data.feedbackHelpful,
    additionalComments: body.data.additionalComments ?? null,
  });

  sendFeedbackEmail({
    sessionId,
    jobRole: session.jobRole,
    questionRelevance: body.data.questionRelevance,
    feedbackHelpful: body.data.feedbackHelpful,
    additionalComments: body.data.additionalComments ?? null,
  }).catch((err) => console.error("[sendFeedbackEmail]", err));

  res.json({ success: true });
});

// ── Admin middleware ───────────────────────────────────────────────────────

const BYPASS_AUTH = process.env.BYPASS_AUTH === "true";
const DEV_USER_ID = "dev_bypass_user";

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (BYPASS_AUTH) {
    req.userId = DEV_USER_ID;
    next();
    return;
  }

  if (!req.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!hasAnyAdminConfigured()) {
    res.status(403).json({ code: "NO_ADMINS_CONFIGURED", error: "Forbidden: no admin users configured. Set ADMIN_USER_IDS or ADMIN_EMAILS environment variable." });
    return;
  }

  const isAdmin = await isAdminUserOrEmail(req.userId);
  if (!isAdmin) {
    res.status(403).json({ code: "NOT_ADMIN", error: "Forbidden: admin access required" });
    return;
  }

  next();
}

// ── GET /interview/admin/feedback ──────────────────────────────────────────

router.get("/interview/admin/feedback", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { relevance, dateFrom, dateTo } = req.query as {
    relevance?: string;
    dateFrom?: string;
    dateTo?: string;
  };

  const conditions = [];

  if (relevance && ["highly_relevant", "somewhat_relevant", "not_relevant"].includes(relevance)) {
    conditions.push(eq(sessionFeedbackTable.questionRelevance, relevance));
  }

  if (dateFrom) {
    const from = new Date(dateFrom);
    if (!isNaN(from.getTime())) {
      conditions.push(gte(sessionFeedbackTable.createdAt, from));
    }
  }

  if (dateTo) {
    const to = new Date(dateTo);
    if (!isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999);
      conditions.push(lte(sessionFeedbackTable.createdAt, to));
    }
  }

  const rows = await db
    .select()
    .from(sessionFeedbackTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(sessionFeedbackTable.createdAt));

  res.json(rows);
});

export default router;

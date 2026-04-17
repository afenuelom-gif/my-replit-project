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
import { getAdminIds } from "../../lib/adminAuth.js";

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
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(file.buffer);
      text = data.text;
    } else if (ext === "docx" || ext === "doc") {
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

export default router;

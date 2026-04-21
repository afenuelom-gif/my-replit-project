import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { db, resumeTailoringTable, usersTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAuth } from "../../middlewares/requireAuth.js";
import { tailorResume } from "../../lib/resumeAI.js";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

async function extractTextFromFile(file: Express.Multer.File): Promise<string> {
  const ext = file.originalname.toLowerCase().split(".").pop();
  let text = "";

  if (ext === "pdf") {
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
    throw new Error("Unsupported file type. Please upload a PDF, DOCX, DOC, or TXT file.");
  }

  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!text || text.length < 20) {
    throw new Error("Could not extract readable text from this file. Please try a different format.");
  }
  return text;
}

// ── POST /resume/parse-file ─────────────────────────────────────────────────
// Extract text from an uploaded file (for job description or resume preview)
router.post(
  "/resume/parse-file",
  requireAuth,
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    try {
      const text = await extractTextFromFile(req.file);
      res.json({ text });
    } catch (err) {
      res.status(422).json({ error: (err as Error).message });
    }
  },
);

// ── POST /resume/tailor ─────────────────────────────────────────────────────
router.post(
  "/resume/tailor",
  requireAuth,
  upload.fields([
    { name: "resumeFile", maxCount: 1 },
    { name: "jdFile", maxCount: 1 },
  ]),
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId!;

    const { scope, aggressiveness, jdText, resumeText: resumeTextBody } = req.body as {
      scope?: string;
      aggressiveness?: string;
      jdText?: string;
      resumeText?: string;
    };

    if (!scope || !aggressiveness) {
      res.status(400).json({ error: "scope and aggressiveness are required" });
      return;
    }
    if (!["full", "role_specific"].includes(scope)) {
      res.status(400).json({ error: "scope must be 'full' or 'role_specific'" });
      return;
    }
    if (!["conservative", "balanced", "strong"].includes(aggressiveness)) {
      res.status(400).json({ error: "aggressiveness must be 'conservative', 'balanced', or 'strong'" });
      return;
    }

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;

    let jobDescriptionText = jdText?.trim() ?? "";
    if (!jobDescriptionText && files?.jdFile?.[0]) {
      try {
        jobDescriptionText = await extractTextFromFile(files.jdFile[0]);
      } catch (err) {
        res.status(422).json({ error: `Job description file error: ${(err as Error).message}` });
        return;
      }
    }
    if (!jobDescriptionText || jobDescriptionText.length < 20) {
      res.status(400).json({ error: "Job description is required (paste text or upload a file)" });
      return;
    }

    let resumeText = resumeTextBody?.trim() ?? "";
    if (!resumeText && files?.resumeFile?.[0]) {
      try {
        resumeText = await extractTextFromFile(files.resumeFile[0]);
      } catch (err) {
        res.status(422).json({ error: `Resume file error: ${(err as Error).message}` });
        return;
      }
    }
    if (!resumeText || resumeText.length < 20) {
      res.status(400).json({ error: "Resume is required (paste text or upload a file)" });
      return;
    }

    const [user] = await db
      .select({ resumeTailoringCredits: usersTable.resumeTailoringCredits })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user || user.resumeTailoringCredits <= 0) {
      res.status(403).json({
        code: "NO_CREDITS",
        error: "You have no resume tailoring credits remaining. Upgrade your plan to continue.",
      });
      return;
    }

    let result;
    try {
      result = await tailorResume({
        resumeText,
        jobDescriptionText,
        scope: scope as "full" | "role_specific",
        aggressiveness: aggressiveness as "conservative" | "balanced" | "strong",
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message ?? "AI tailoring failed" });
      return;
    }

    await db
      .update(usersTable)
      .set({ resumeTailoringCredits: sql`${usersTable.resumeTailoringCredits} - 1` })
      .where(eq(usersTable.id, userId));

    const [saved] = await db
      .insert(resumeTailoringTable)
      .values({
        userId,
        jobTitle: result.jobTitle,
        scope,
        aggressiveness,
        originalResumeText: resumeText,
        tailoredResumeText: result.tailoredResumeText,
        changeSummary: JSON.stringify(result.changeSummary),
        atsKeywords: JSON.stringify(result.atsKeywords),
        improvementSuggestions: JSON.stringify(result.improvementSuggestions),
      })
      .returning();

    res.json({
      id: saved.id,
      jobTitle: result.jobTitle,
      tailoredResumeText: result.tailoredResumeText,
      changeSummary: result.changeSummary,
      atsKeywords: result.atsKeywords,
      improvementSuggestions: result.improvementSuggestions,
      creditsRemaining: user.resumeTailoringCredits - 1,
    });
  },
);

// ── GET /resume/history ─────────────────────────────────────────────────────
router.get("/resume/history", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;

  const rows = await db
    .select({
      id: resumeTailoringTable.id,
      jobTitle: resumeTailoringTable.jobTitle,
      scope: resumeTailoringTable.scope,
      aggressiveness: resumeTailoringTable.aggressiveness,
      createdAt: resumeTailoringTable.createdAt,
    })
    .from(resumeTailoringTable)
    .where(eq(resumeTailoringTable.userId, userId))
    .orderBy(desc(resumeTailoringTable.createdAt))
    .limit(20);

  const [user] = await db
    .select({ resumeTailoringCredits: usersTable.resumeTailoringCredits })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  res.json({ history: rows, creditsRemaining: user?.resumeTailoringCredits ?? 0 });
});

// ── GET /resume/result/:id ──────────────────────────────────────────────────
router.get("/resume/result/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [row] = await db
    .select()
    .from(resumeTailoringTable)
    .where(and(eq(resumeTailoringTable.id, id), eq(resumeTailoringTable.userId, userId)))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({
    id: row.id,
    jobTitle: row.jobTitle,
    scope: row.scope,
    aggressiveness: row.aggressiveness,
    originalResumeText: row.originalResumeText,
    tailoredResumeText: row.tailoredResumeText,
    changeSummary: JSON.parse(row.changeSummary) as string[],
    atsKeywords: JSON.parse(row.atsKeywords) as string[],
    improvementSuggestions: JSON.parse(row.improvementSuggestions) as string[],
    createdAt: row.createdAt,
  });
});

export default router;

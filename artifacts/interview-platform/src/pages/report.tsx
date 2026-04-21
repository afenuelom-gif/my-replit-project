import React, { useState, useRef, useCallback } from "react";
import { useParams, Link } from "wouter";
import { downloadReportAsPdf } from "@/utils/reportPdf";
import AppFooter from "@/components/AppFooter";
import { useGetReport, getGetReportQueryKey } from "@workspace/api-client-react";
import { AuthPrompt } from "@/components/AuthPrompt";
import { useQuery } from "@tanstack/react-query";
import { useAuthActions } from "@/contexts/auth-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import VoiceReviewPanel from "@/components/VoiceReviewPanel";
import FeedbackModal from "@/components/FeedbackModal";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckCircle2, ChevronLeft, Trophy, ThumbsUp, TrendingUp, Dumbbell, MessageSquare, Code, Lightbulb,
  User, Camera, Volume2, Share2, Mail, Printer, Copy, Check, ExternalLink, Download,
} from "lucide-react";

type AnswerFeedbackItem = {
  questionId: number;
  questionText: string;
  answerText?: string | null;
  feedback: string;
  score: number;
  strengths: string[];
  improvements: string[];
};

function printSingleCard(
  fb: AnswerFeedbackItem,
  idx: number,
  sessionContext?: { jobRole?: string | null; sessionDate?: string | null; overallScore?: number | null },
) {
  const scoreColor =
    fb.score >= 80 ? "#059669" : fb.score >= 60 ? "#d97706" : "#dc2626";
  const scoreBg =
    fb.score >= 80 ? "#ecfdf5" : fb.score >= 60 ? "#fffbeb" : "#fef2f2";
  const scoreBorder =
    fb.score >= 80 ? "#a7f3d0" : fb.score >= 60 ? "#fde68a" : "#fecaca";

  const strengths = fb.strengths
    .map((s) => `<li style="margin-bottom:4px;">• ${s}</li>`)
    .join("");
  const improvements = fb.improvements
    .map((s) => `<li style="margin-bottom:4px;">• ${s}</li>`)
    .join("");

  const sessionMeta = sessionContext
    ? [
        sessionContext.jobRole ? `<span class="meta-item"><span class="meta-key">Role</span> ${sessionContext.jobRole}</span>` : "",
        sessionContext.sessionDate ? `<span class="meta-item"><span class="meta-key">Date</span> ${new Date(sessionContext.sessionDate).toLocaleString()}</span>` : "",
        sessionContext.overallScore != null ? `<span class="meta-item"><span class="meta-key">Session Score</span> ${sessionContext.overallScore}/100</span>` : "",
      ]
        .filter(Boolean)
        .join("")
    : "";

  const sessionBanner = sessionMeta
    ? `<div class="session-banner">${sessionMeta}</div>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Question ${idx + 1} Feedback</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      color: #1e293b;
      background: #fff;
      padding: 32px;
      max-width: 720px;
      margin: 0 auto;
    }
    .label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #64748b;
    }
    .session-banner {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 16px;
      margin-bottom: 16px;
      font-size: 12px;
      color: #475569;
    }
    .meta-item { display: flex; gap: 4px; align-items: baseline; }
    .meta-key {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #94a3b8;
      margin-right: 2px;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .score-badge {
      font-size: 12px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 9999px;
      border: 1px solid ${scoreBorder};
      background: ${scoreBg};
      color: ${scoreColor};
    }
    .question {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
      line-height: 1.5;
    }
    .answer {
      font-size: 13px;
      color: #64748b;
      font-style: italic;
      line-height: 1.6;
      border-left: 2px solid #cbd5e1;
      padding-left: 12px;
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 6px;
    }
    .feedback-text {
      font-size: 13px;
      color: #475569;
      line-height: 1.6;
      margin-bottom: 20px;
    }
    .columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      border-top: 1px solid #f1f5f9;
      padding-top: 16px;
    }
    .col-title-strengths {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #059669;
      margin-bottom: 8px;
    }
    .col-title-improvements {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #d97706;
      margin-bottom: 8px;
    }
    ul { list-style: none; }
    li { font-size: 13px; color: #475569; line-height: 1.5; }
    @media print {
      body { padding: 0; }
      @page { margin: 24px; }
    }
  </style>
</head>
<body>
  ${sessionBanner}
  <div class="header">
    <span class="label">Question ${idx + 1}</span>
    <span class="score-badge">${fb.score}/100</span>
  </div>
  <p class="question">${fb.questionText}</p>
  <p class="answer">"${fb.answerText || "No answer recorded."}"</p>
  <p class="section-title">Feedback</p>
  <p class="feedback-text">${fb.feedback}</p>
  <div class="columns">
    <div>
      <p class="col-title-strengths">Strengths</p>
      <ul>${strengths}</ul>
    </div>
    <div>
      <p class="col-title-improvements">To Improve</p>
      <ul>${improvements}</ul>
    </div>
  </div>
  <script>window.addEventListener('load', () => { window.print(); });<\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=800,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
import { AppHeader } from "@/components/AppHeader";
import { useToast } from "@/hooks/use-toast";

interface FillerResult {
  total: number;
  rate: number;
  wordCount: number;
  breakdown: { word: string; count: number }[];
}

const FILLER_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bum+\b/gi,       label: "um" },
  { pattern: /\buh+\b/gi,       label: "uh" },
  { pattern: /\ber+\b/gi,       label: "er" },
  { pattern: /\bhmm+\b/gi,      label: "hmm" },
  { pattern: /\byou know\b/gi,  label: "you know" },
  { pattern: /\bi mean\b/gi,    label: "I mean" },
  { pattern: /\bkind of\b/gi,   label: "kind of" },
  { pattern: /\bsort of\b/gi,   label: "sort of" },
  { pattern: /\bbasically\b/gi, label: "basically" },
  { pattern: /\bliterally\b/gi, label: "literally" },
  { pattern: /\blike\b/gi,      label: "like" },
];

function analyzeFillerWords(answers: (string | null)[]): FillerResult {
  const allText = answers.filter(Boolean).join(" ");
  const wordCount = allText.trim() ? allText.trim().split(/\s+/).length : 0;

  const breakdown: { word: string; count: number }[] = [];
  let total = 0;

  for (const { pattern, label } of FILLER_PATTERNS) {
    const matches = allText.match(pattern);
    const count = matches?.length ?? 0;
    if (count > 0) {
      breakdown.push({ word: label, count });
      total += count;
    }
  }

  breakdown.sort((a, b) => b.count - a.count);
  const rate = wordCount > 0 ? Math.round((total / wordCount) * 1000) / 10 : 0;

  return { total, rate, wordCount, breakdown };
}

export default function Report() {
  const params = useParams();
  const sessionId = parseInt(params.sessionId || "0");
  const [copied, setCopied] = useState(false);
  const [copiedQId, setCopiedQId] = useState<number | null>(null);
  const copiedQIdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { toast } = useToast();
  const { getAuthHeaders } = useAuthActions();

  const { data: report, isLoading, error: reportError } = useGetReport(sessionId, {
    query: {
      enabled: !!sessionId,
      queryKey: getGetReportQueryKey(sessionId),
      // Retry on 401/403 — these happen during Auth0 token refresh windows.
      // Keep retrying until auth recovers rather than giving up and showing an error.
      retry: (failureCount, error) => {
        const status = (error as Error & { status?: number })?.status;
        if (status === 401 || status === 403) return failureCount < 15;
        return false;
      },
      retryDelay: 2000,
    }
  });

  const { data: sessionData } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/interview/sessions/${sessionId}`, { credentials: "include", headers });
      if (!res.ok) return null;
      return res.json() as Promise<{ session: { jobRole: string } | null; interviewers: Array<{ id: number; name: string; title: string; avatarUrl?: string | null; voiceId?: string }> }>;
    },
    enabled: !!sessionId,
    staleTime: 0,
    refetchOnMount: true,
  });

  const localFeedbackKey = `feedback_given_${sessionId}`;
  const localFeedbackGiven = !!localStorage.getItem(localFeedbackKey);

  const { data: feedbackStatus } = useQuery({
    queryKey: ["feedback-status", sessionId],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/interview/sessions/${sessionId}/feedback/status`, { credentials: "include", headers });
      if (!res.ok) return null;
      return res.json() as Promise<{ exists: boolean }>;
    },
    enabled: !!sessionId,
  });

  // Only show the feedback form when we POSITIVELY know feedback hasn't been given.
  // If the API check fails (e.g. iOS Safari auth token issues), feedbackStatus is null
  // and we conservatively treat it as "already given". The localStorage flag is a
  // cross-reload backup so iOS never prompts again after a successful submission.
  const hasFeedback = localFeedbackGiven || feedbackStatus?.exists !== false;

  const firstInterviewer = sessionData?.interviewers?.[0] ?? null;

  const handleDownloadPdf = useCallback(async () => {
    if (!report || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      const jobRole = sessionData?.session?.jobRole;
      const safeName = jobRole
        ? jobRole.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
        : "";
      const filename = safeName ? `interview-report-${safeName}.pdf` : "interview-report.pdf";
      await downloadReportAsPdf(report as Parameters<typeof downloadReportAsPdf>[0], sessionData ?? null, filename);
    } catch {
      toast({
        title: "PDF generation failed",
        description: "Unable to create the PDF. Please try again or use the Print option in the Share menu.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [report, sessionData, isGeneratingPdf, toast]);

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-slate-600">Analyzing performance…</div>;
  }

  if (reportError) {
    const errStatus = (reportError as Error & { status?: number })?.status;
    if (errStatus === 401) return <AuthPrompt />;
    // 403 means auth token is refreshing — show a reconnecting state while
    // the retry loop (above) waits for the token to recover.
    if (errStatus === 403) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 text-slate-500">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Reconnecting to your session…</p>
        </div>
      );
    }
  }

  if (!report) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-slate-600">Report not found.</div>;
  }

  const filler = analyzeFillerWords(
    (report.answerFeedback ?? []).map((fb) => fb.answerText ?? null)
  );

  const fillerLevel = filler.rate < 2 ? "low" : filler.rate < 5 ? "moderate" : "high";
  const fillerColor    = fillerLevel === "low" ? "text-emerald-600" : fillerLevel === "moderate" ? "text-amber-600" : "text-red-600";
  const fillerBadgeBg  = fillerLevel === "low" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : fillerLevel === "moderate" ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-red-50 border-red-200 text-red-700";
  const fillerCardBg   = fillerLevel === "low" ? "border-emerald-200 bg-emerald-50/40" : fillerLevel === "moderate" ? "border-amber-200 bg-amber-50/40" : "border-red-200 bg-red-50/40";

  const shareText = [
    `🎯 My AI Interview Performance Report`,
    `Overall Score: ${report.overallScore}/100`,
    `Communication: ${report.communicationScore}% | Technical: ${report.technicalScore}% | Confidence: ${report.confidenceScore}%`,
    ``,
    `Just completed a simulated interview session. Continuously improving! 💪`,
  ].join("\n");

  const shortShareText = `I scored ${report.overallScore}/100 on my AI interview simulation! 🎯 Communication: ${report.communicationScore}% | Technical: ${report.technicalScore}% | Confidence: ${report.confidenceScore}% #InterviewPrep #CareerGrowth`;

  const pageUrl = window.location.href;

  function shareViaEmail() {
    const subject = encodeURIComponent(`My Interview Performance Report — ${report!.overallScore}/100`);
    const body = encodeURIComponent(`Hi,\n\nI wanted to share my latest AI interview simulation results:\n\n${shareText}\n\nReport link: ${pageUrl}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  }

  function shareOnX() {
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(shortShareText)}`, "_blank", "noopener,noreferrer");
  }

  function shareOnLinkedIn() {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}&summary=${encodeURIComponent(shortShareText)}`, "_blank", "noopener,noreferrer");
  }

  function shareOnWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText}\n\n${pageUrl}`)}`, "_blank", "noopener,noreferrer");
  }

  async function shareNative() {
    if (navigator.share) {
      try { await navigator.share({ title: "My Interview Performance Report", text: shareText, url: pageUrl }); } catch {}
    }
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${pageUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  async function copyQuestionFeedback(fb: AnswerFeedbackItem, idx: number) {
    const lines = [
      `Question ${idx + 1}: ${fb.questionText}`,
      ``,
      `Answer: ${fb.answerText || "No answer recorded."}`,
      ``,
      `Feedback (${fb.score}/100): ${fb.feedback}`,
      ``,
      `Strengths:`,
      ...fb.strengths.map((s) => `• ${s}`),
      ``,
      `To Improve:`,
      ...fb.improvements.map((s) => `• ${s}`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopiedQId(fb.questionId);
      if (copiedQIdTimer.current) clearTimeout(copiedQIdTimer.current);
      copiedQIdTimer.current = setTimeout(() => setCopiedQId(null), 2000);
    } catch {}
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col overflow-x-hidden print:bg-white">

      {/* Gradient blobs — hidden in print */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none print:hidden">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-blue-500/30 blur-[80px]" />
        <div className="absolute top-1/3 -left-32 w-[400px] h-[400px] rounded-full bg-purple-500/25 blur-[70px]" />
      </div>

      <div className="print:hidden">
        <AppHeader
          right={
            <Link href="/">
              <Button variant="ghost" size="sm" className="cursor-pointer text-slate-600 hover:text-blue-700 hover:bg-blue-50 gap-2 font-medium">
                <ChevronLeft className="w-4 h-4" /> Dashboard
              </Button>
            </Link>
          }
        />
      </div>

      <div className="flex-1 p-6 lg:p-12 print:p-4 relative z-10">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 print:hidden">
            <div className="flex items-start gap-3 sm:block">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-tight">Interview Performance Report</h1>
                <p className="text-slate-500 mt-1 text-sm">Generated on {new Date(report.generatedAt).toLocaleString()}</p>
              </div>

              {/* Compact score — mobile only */}
              {(() => {
                const noInterview = !report.answerFeedback || (report.answerFeedback as unknown[]).length === 0;
                if (noInterview) return (
                  <div className="sm:hidden shrink-0 flex flex-col items-center gap-1 bg-white rounded-xl p-2.5 shadow-sm" style={{ border: "1.5px solid #e2e8f0" }}>
                    <div className="relative flex items-center justify-center" style={{ width: 64, height: 64 }}>
                      <div style={{ position: "relative", zIndex: 10, width: 56, height: 56, borderRadius: "50%", background: "#f8fafc", border: "2.5px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 14, fontWeight: 900, color: "#cbd5e1", lineHeight: 1 }}>N/A</span>
                      </div>
                    </div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, background: "#f8fafc", border: "1.5px solid #e2e8f0" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.01em" }}>Not started</span>
                    </div>
                  </div>
                );
                const s = report.overallScore;
                const tier =
                  s >= 85 ? { label: "Excellent",      Icon: Trophy,     color: "#059669", glow: "rgba(5,150,105,",   badgeBg: "#ecfdf5", badgeBorder: "#6ee7b7", badgeText: "#065f46" }
                : s >= 70 ? { label: "Good",            Icon: ThumbsUp,   color: "#2563eb", glow: "rgba(37,99,235,",   badgeBg: "#eff6ff", badgeBorder: "#93c5fd", badgeText: "#1e3a8a" }
                : s >= 55 ? { label: "Fair",             Icon: TrendingUp, color: "#d97706", glow: "rgba(217,119,6,",  badgeBg: "#fffbeb", badgeBorder: "#fcd34d", badgeText: "#78350f" }
                :            { label: "Needs Practice",  Icon: Dumbbell,   color: "#e11d48", glow: "rgba(225,29,72,",  badgeBg: "#fff1f2", badgeBorder: "#fda4af", badgeText: "#881337" };
                return (
                  <div className="sm:hidden shrink-0 flex flex-col items-center gap-1 bg-white rounded-xl p-2.5 shadow-sm" style={{ border: `1.5px solid ${tier.badgeBorder}` }}>
                    <style>{`
                      @keyframes sonarR {
                        0%   { transform: scale(0.55); opacity: 0.65; }
                        100% { transform: scale(1.95); opacity: 0; }
                      }
                      @keyframes breatheR {
                        0%,100% { box-shadow: 0 0 0 0 ${tier.glow}0.2), 0 0 14px 4px ${tier.glow}0.08); }
                        50%     { box-shadow: 0 0 0 5px ${tier.glow}0.07), 0 0 24px 8px ${tier.glow}0.16); }
                      }
                    `}</style>
                    <div className="relative flex items-center justify-center" style={{ width: 64, height: 64 }}>
                      {[0, 0.6, 1.2, 1.8].map((delay, i) => (
                        <div key={i} style={{ position: "absolute", width: 42, height: 42, borderRadius: "50%", border: `1.5px solid ${tier.color}`, opacity: 0, animation: `sonarR 2.4s ease-out ${delay}s infinite` }} />
                      ))}
                      <div style={{ position: "relative", zIndex: 10, width: 56, height: 56, borderRadius: "50%", background: "#fff", border: `2.5px solid ${tier.color}`, display: "flex", alignItems: "center", justifyContent: "center", animation: "breatheR 3s ease-in-out infinite" }}>
                        <span style={{ fontSize: 20, fontWeight: 900, color: tier.color, lineHeight: 1 }}>{report.overallScore}</span>
                      </div>
                    </div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, background: tier.badgeBg, border: `1.5px solid ${tier.badgeBorder}` }}>
                      <tier.Icon style={{ width: 10, height: 10, color: tier.color }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: tier.badgeText, letterSpacing: "0.01em" }}>{tier.label}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center gap-3 sm:pt-1">
              {/* Download PDF button */}
              <Button
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                variant="outline"
                className="cursor-pointer border-blue-300 text-blue-700 hover:bg-blue-50 hover:text-blue-900 hover:border-blue-400 gap-2 font-medium disabled:opacity-60"
              >
                <Download className={`w-4 h-4 ${isGeneratingPdf ? "animate-bounce" : ""}`} />
                {isGeneratingPdf ? "Generating…" : "Download PDF"}
              </Button>

              {/* Share dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="cursor-pointer border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 gap-2">
                    <Share2 className="w-4 h-4" />
                    Share
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 bg-white border-slate-200 shadow-lg">
                  <DropdownMenuItem onClick={shareViaEmail} className="gap-3 cursor-pointer text-slate-700 hover:text-blue-700 hover:bg-blue-50">
                    <Mail className="w-4 h-4 text-blue-500" /> Email Report
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={shareOnX} className="gap-3 cursor-pointer text-slate-700 hover:text-blue-700 hover:bg-blue-50">
                    <ExternalLink className="w-4 h-4 text-slate-500" /> Share on X
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={shareOnLinkedIn} className="gap-3 cursor-pointer text-slate-700 hover:text-blue-700 hover:bg-blue-50">
                    <ExternalLink className="w-4 h-4 text-blue-600" /> Share on LinkedIn
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={shareOnWhatsApp} className="gap-3 cursor-pointer text-slate-700 hover:text-blue-700 hover:bg-blue-50">
                    <ExternalLink className="w-4 h-4 text-emerald-600" /> Share on WhatsApp
                  </DropdownMenuItem>
                  {typeof navigator !== "undefined" && "share" in navigator && (
                    <DropdownMenuItem onClick={shareNative} className="gap-3 cursor-pointer text-slate-700 hover:text-blue-700 hover:bg-blue-50">
                      <Share2 className="w-4 h-4 text-blue-500" /> More apps…
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-slate-200" />
                  <DropdownMenuItem onClick={copyToClipboard} className="gap-3 cursor-pointer text-slate-700 hover:text-blue-700 hover:bg-blue-50">
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                    {copied ? "Copied!" : "Copy Summary"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.print()} className="gap-3 cursor-pointer text-slate-700 hover:text-blue-700 hover:bg-blue-50">
                    <Printer className="w-4 h-4 text-slate-500" /> Print / Save as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Full score badge — desktop only */}
              {(() => {
                const noInterview = !report.answerFeedback || (report.answerFeedback as unknown[]).length === 0;
                if (noInterview) return (
                  <div className="hidden sm:flex items-center gap-5 bg-white rounded-2xl p-5 shadow-sm" style={{ border: "1.5px solid #e2e8f0" }}>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Overall Score</div>
                      <div className="text-4xl font-black leading-none text-slate-300">N/A</div>
                      <div style={{ display: "inline-flex", alignItems: "center", padding: "4px 11px", borderRadius: "999px", background: "#f8fafc", border: "1.5px solid #e2e8f0" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.01em" }}>Not started</span>
                      </div>
                    </div>
                    <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                      <div style={{ position: "relative", zIndex: 10, width: 72, height: 72, borderRadius: "50%", background: "#f8fafc", border: "3px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 20, fontWeight: 900, color: "#cbd5e1", lineHeight: 1 }}>N/A</span>
                      </div>
                    </div>
                  </div>
                );
                const s = report.overallScore;
                const tier =
                  s >= 85 ? { label: "Excellent",      Icon: Trophy,     color: "#059669", glow: "rgba(5,150,105,",   badgeBg: "#ecfdf5", badgeBorder: "#6ee7b7", badgeText: "#065f46" }
                : s >= 70 ? { label: "Good",            Icon: ThumbsUp,   color: "#2563eb", glow: "rgba(37,99,235,",   badgeBg: "#eff6ff", badgeBorder: "#93c5fd", badgeText: "#1e3a8a" }
                : s >= 55 ? { label: "Fair",             Icon: TrendingUp, color: "#d97706", glow: "rgba(217,119,6,",  badgeBg: "#fffbeb", badgeBorder: "#fcd34d", badgeText: "#78350f" }
                :            { label: "Needs Practice",  Icon: Dumbbell,   color: "#e11d48", glow: "rgba(225,29,72,",  badgeBg: "#fff1f2", badgeBorder: "#fda4af", badgeText: "#881337" };

                return (
                  <div className="hidden sm:flex items-center gap-5 bg-white rounded-2xl p-5 shadow-sm" style={{ border: `1.5px solid ${tier.badgeBorder}` }}>
                    <style>{`
                      @keyframes sonarR {
                        0%   { transform: scale(0.55); opacity: 0.65; }
                        100% { transform: scale(1.95); opacity: 0; }
                      }
                      @keyframes breatheR {
                        0%,100% { box-shadow: 0 0 0 0 ${tier.glow}0.2), 0 0 14px 4px ${tier.glow}0.08); }
                        50%     { box-shadow: 0 0 0 5px ${tier.glow}0.07), 0 0 24px 8px ${tier.glow}0.16); }
                      }
                    `}</style>

                    {/* Score number + tier badge */}
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Overall Score</div>
                      <div className="text-4xl font-black leading-none" style={{ color: tier.color }}>
                        {report.overallScore}<span className="text-lg font-medium text-slate-400 ml-0.5">/100</span>
                      </div>
                      {/* Framed tier badge */}
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 11px", borderRadius: "999px", background: tier.badgeBg, border: `1.5px solid ${tier.badgeBorder}` }}>
                        <tier.Icon style={{ width: 12, height: 12, color: tier.color }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: tier.badgeText, letterSpacing: "0.01em" }}>{tier.label}</span>
                      </div>
                    </div>

                    {/* Compact pulse ring — same 96×96 footprint as before */}
                    <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                      {[0, 0.6, 1.2, 1.8].map((delay, i) => (
                        <div key={i} style={{ position: "absolute", width: 58, height: 58, borderRadius: "50%", border: `1.5px solid ${tier.color}`, opacity: 0, animation: `sonarR 2.4s ease-out ${delay}s infinite` }} />
                      ))}
                      <div style={{ position: "relative", zIndex: 10, width: 72, height: 72, borderRadius: "50%", background: "#fff", border: `3px solid ${tier.color}`, display: "flex", alignItems: "center", justifyContent: "center", animation: "breatheR 3s ease-in-out infinite" }}>
                        <span style={{ fontSize: 24, fontWeight: 900, color: tier.color, lineHeight: 1 }}>{report.overallScore}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Voice-guided walkthrough panel — hidden in print */}
          {report && firstInterviewer && (
            <div className="print:hidden">
              <VoiceReviewPanel
                key={sessionId}
                sessionId={sessionId}
                interviewer={firstInterviewer}
                report={report as { answerFeedback: Array<{ questionText: string; feedback: string; strengths: string[]; improvements: string[] }>; suggestions?: string[] }}
                hasFeedback={hasFeedback}
                onReviewComplete={() => { if (report.answerFeedback?.length > 0 && !hasFeedback) setShowFeedback(true); }}
              />
            </div>
          )}

          {/* Print-only header */}
          <div className="hidden print:block print-header">
            <div className="print-header-logo">
              <span className="print-header-brand">InterviewAI</span>
            </div>
            <div className="print-header-body">
              <h1 className="print-title">Interview Performance Report</h1>
              {sessionData?.session?.jobRole && (
                <p className="print-role">Role: {sessionData.session.jobRole}</p>
              )}
              <p className="print-date">Generated on {new Date(report.generatedAt).toLocaleString()}</p>
            </div>
            <div className="print-score-badge">
              <span className="print-score-label">Overall Score</span>
              <span className="print-score-value">{report.overallScore}<span className="print-score-denom">/100</span></span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:grid-cols-1 print:gap-6">

            {/* Left Column */}
            <div className="lg:col-span-1 space-y-6 print:space-y-4">

              {/* Executive Summary */}
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-900">Executive Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 leading-relaxed">{report.summary}</p>
                </CardContent>
              </Card>

              {/* Category Breakdown */}
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-900">Category Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2 text-slate-700"><MessageSquare className="w-4 h-4 text-blue-500"/> Communication</span>
                      <span className="font-mono text-slate-700">{report.communicationScore}%</span>
                    </div>
                    <Progress value={report.communicationScore} className="h-2" />
                    <p className="text-xs text-slate-400">Clarity, sentence structure, coherence, and relevance to the question</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2 text-slate-700"><Code className="w-4 h-4 text-emerald-500"/> Technical</span>
                      <span className="font-mono text-slate-700">{report.technicalScore}%</span>
                    </div>
                    <Progress value={report.technicalScore} className="h-2" />
                    <p className="text-xs text-slate-400">Domain knowledge, role-relevant vocabulary, and correct use of technical concepts</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2 text-slate-700"><Lightbulb className="w-4 h-4 text-amber-500"/> Confidence</span>
                      <span className="font-mono text-slate-700">{report.confidenceScore}%</span>
                    </div>
                    <Progress value={report.confidenceScore} className="h-2" />
                    <p className="text-xs text-slate-400">Assertive phrasing, directness, and absence of excessive hedging</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2 text-slate-700"><User className="w-4 h-4 text-purple-500"/> Posture</span>
                      <span className="font-mono text-slate-700">{report.postureScore}%</span>
                    </div>
                    <Progress value={report.postureScore} className="h-2" />
                    <p className="text-xs text-slate-400">Body language, eye contact, and on-camera presence from webcam analysis</p>
                  </div>
                </CardContent>
              </Card>

              {/* Filler Word Analysis */}
              {filler.wordCount > 0 && (
                <Card className={`border ${fillerCardBg}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                      <Volume2 className={`w-5 h-5 ${fillerColor}`} />
                      Filler Word Usage
                      <span className={`ml-auto text-xs font-semibold px-2 py-1 rounded-full border ${fillerBadgeBg}`}>
                        {fillerLevel === "low" ? "Minimal" : fillerLevel === "moderate" ? "Moderate" : "Excessive"}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-3xl font-bold ${fillerColor}`}>{filler.rate}</span>
                      <span className="text-sm text-slate-500">per 100 words</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {filler.total} filler {filler.total === 1 ? "word" : "words"} detected across {filler.wordCount.toLocaleString()} words spoken.
                    </p>
                    {filler.breakdown.length > 0 && (
                      <div className="pt-2 border-t border-slate-200 space-y-1.5">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Most Used</p>
                        {filler.breakdown.slice(0, 5).map(({ word, count }) => (
                          <div key={word} className="flex items-center justify-between text-sm">
                            <span className="text-slate-500 italic">"{word}"</span>
                            <span className={`font-mono text-xs font-semibold ${fillerColor}`}>×{count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {fillerLevel !== "low" && (
                      <p className="text-xs text-slate-500 pt-2 border-t border-slate-200">
                        {fillerLevel === "moderate"
                          ? "Aim to pause and collect your thoughts instead of filling silence."
                          : "Practice deliberate pausing — silence is more powerful than filler words in an interview."}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Top Areas for Improvement */}
              <Card className="bg-blue-50 border-blue-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-blue-800">Top Areas for Improvement</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {(() => {
                      const defaults = [
                        "Practice structuring answers using the STAR method (Situation, Task, Action, Result).",
                        "Provide more specific examples and quantifiable outcomes in your responses.",
                        "Work on concise delivery by keeping answers to 1-2 minutes and eliminating filler words.",
                      ];
                      const base = report.suggestions ?? [];
                      return [...base, ...defaults.slice(base.length)].slice(0, 3);
                    })().map((s, i) => (
                      <li key={i} className="flex gap-3 text-sm text-slate-700">
                        <div className="min-w-[20px] pt-0.5"><CheckCircle2 className="w-4 h-4 text-blue-500" /></div>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Posture Notes */}
              {report.postureNotes && report.postureNotes.length > 0 && (
                <Card className="bg-white border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                      <Camera className="w-5 h-5 text-purple-500" />
                      Posture & Presence Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {(() => {
                        const seen = new Set<string>();
                        return (report.postureNotes as string[]).filter(note => {
                          const key = note.trim().toLowerCase();
                          if (seen.has(key)) return false;
                          seen.add(key);
                          return true;
                        });
                      })().map((note: string, i: number) => (
                        <li key={i} className="flex gap-3 text-sm text-slate-600">
                          <div className="min-w-[20px] pt-0.5"><User className="w-4 h-4 text-purple-500" /></div>
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column: Q&A Details */}
            <div className="lg:col-span-2 space-y-6 print:space-y-4">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Question Analysis</h2>
              {report.answerFeedback.map((fb, idx) => (
                <Card key={fb.questionId} className="bg-white border-slate-200 shadow-sm overflow-hidden print:break-inside-avoid">
                  <div className="bg-slate-50 border-b border-slate-200 flex items-center justify-between px-6 py-3">
                    <span className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Question {idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyQuestionFeedback(fb as AnswerFeedbackItem, idx)}
                        title="Copy this question's feedback"
                        className="cursor-pointer print:hidden flex items-center gap-1 px-2 py-1.5 rounded-md transition-colors text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                      >
                        {copiedQId === fb.questionId ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="text-[11px] font-medium text-emerald-600 whitespace-nowrap">Copied!</span>
                          </>
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => printSingleCard(fb as AnswerFeedbackItem, idx, {
                          jobRole: sessionData?.session?.jobRole,
                          sessionDate: report.generatedAt,
                          overallScore: report.overallScore,
                        })}
                        title="Print this question's feedback"
                        className="cursor-pointer print:hidden p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        fb.score >= 80
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : fb.score >= 60
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {fb.score}/100
                      </span>
                    </div>
                  </div>
                  <CardContent className="p-6 print:p-4 space-y-5">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 mb-3">{fb.questionText}</h3>
                      <p className="text-sm text-slate-500 italic leading-relaxed pl-3 border-l-2 border-slate-200">
                        "{fb.answerText || "No answer recorded."}"
                      </p>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-slate-800">Feedback</h4>
                      <p className="text-sm text-slate-600 leading-relaxed">{fb.feedback}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                      <div>
                        <h4 className="text-xs font-semibold text-emerald-600 mb-2 uppercase tracking-wider">Strengths</h4>
                        <ul className="space-y-1">
                          {fb.strengths.map((s, i) => <li key={i} className="text-sm text-slate-600">• {s}</li>)}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-amber-600 mb-2 uppercase tracking-wider">To Improve</h4>
                        <ul className="space-y-1">
                          {fb.improvements.map((s, i) => <li key={i} className="text-sm text-slate-600">• {s}</li>)}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="print:hidden">
        <AppFooter />
      </div>

      {showFeedback && (
        <div className="print:hidden">
          <FeedbackModal
            sessionId={sessionId}
            jobRole={sessionData?.session?.jobRole ?? "this role"}
            onClose={() => setShowFeedback(false)}
          />
        </div>
      )}
    </div>
  );
}

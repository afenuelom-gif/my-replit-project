import React, { useState } from "react";
import { useParams, Link } from "wouter";
import AppFooter from "@/components/AppFooter";
import { useGetReport, getGetReportQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
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
  CheckCircle2, ChevronLeft, Target, MessageSquare, Code, Lightbulb,
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

function printSingleCard(fb: AnswerFeedbackItem, idx: number) {
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
  const [showFeedback, setShowFeedback] = useState(false);

  const { data: report, isLoading } = useGetReport(sessionId, {
    query: { enabled: !!sessionId, queryKey: getGetReportQueryKey(sessionId) }
  });

  const { data: sessionData } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/interview/sessions/${sessionId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json() as Promise<{ session: { jobRole: string } | null; interviewers: Array<{ id: number; name: string; title: string; avatarUrl?: string | null; voiceId?: string }> }>;
    },
    enabled: !!sessionId,
  });

  const { data: feedbackStatus } = useQuery({
    queryKey: ["feedback-status", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/interview/sessions/${sessionId}/feedback/status`, { credentials: "include" });
      if (!res.ok) return { exists: false };
      return res.json() as Promise<{ exists: boolean }>;
    },
    enabled: !!sessionId,
  });

  const hasFeedback = feedbackStatus?.exists ?? false;

  const firstInterviewer = sessionData?.interviewers?.[0] ?? null;

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-slate-600">Analyzing performance…</div>;
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
              <Button variant="ghost" size="sm" className="text-slate-600 hover:text-blue-700 hover:bg-blue-50 gap-2 font-medium">
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
              <div className="sm:hidden shrink-0 bg-white border border-blue-200 rounded-xl px-4 py-2.5 text-center shadow-sm">
                <div className="text-2xl font-bold text-blue-600 leading-none">{report.overallScore}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">/100</div>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:pt-1">
              {/* Download PDF button */}
              <Button
                onClick={() => window.print()}
                variant="outline"
                className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:text-blue-900 hover:border-blue-400 gap-2 font-medium"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </Button>

              {/* Share dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 gap-2">
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
                    <Printer className="w-4 h-4 text-slate-500" /> Save as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Full score badge — desktop only */}
              <div className="hidden sm:flex items-center gap-4 bg-white border border-blue-200 rounded-2xl p-6 shadow-sm">
                <div className="text-right">
                  <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Overall Score</div>
                  <div className="text-4xl font-bold text-blue-600">{report.overallScore}<span className="text-xl text-slate-400">/100</span></div>
                </div>
                <div className="w-24 h-24 rounded-full border-8 border-blue-100 flex items-center justify-center relative">
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle
                      className="text-blue-500"
                      strokeWidth="8"
                      stroke="currentColor"
                      fill="transparent"
                      r="38"
                      cx="48"
                      cy="48"
                      strokeDasharray={`${report.overallScore * 2.38} 240`}
                    />
                  </svg>
                  <Target className="w-8 h-8 text-blue-500" />
                </div>
              </div>
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
                        onClick={() => printSingleCard(fb as AnswerFeedbackItem, idx)}
                        title="Print this question's feedback"
                        className="print:hidden p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
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

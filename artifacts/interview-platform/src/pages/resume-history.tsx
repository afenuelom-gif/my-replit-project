import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuthActions } from "@/contexts/auth-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppHeader } from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import {
  Loader2,
  ArrowLeft,
  FileText,
  ChevronDown,
  Download,
  Calendar,
  Briefcase,
} from "lucide-react";

interface HistoryItem {
  id: number;
  jobTitle: string;
  scope: string;
  aggressiveness: string;
  createdAt: string;
}

interface FullHistoryResult {
  id: number;
  jobTitle: string;
  scope: string;
  aggressiveness: string;
  tailoredResumeText: string;
  changeSummary: string[];
  atsKeywords: string[];
  improvementSuggestions: string[];
}

interface ParsedLine {
  kind: "section" | "bold" | "bullet" | "blank" | "text";
  text: string;
}

function parseResumeLine(line: string): ParsedLine {
  const trimmed = line.trim();
  if (!trimmed) return { kind: "blank", text: "" };
  if (trimmed.startsWith("• ")) return { kind: "bullet", text: trimmed.slice(2) };
  if (trimmed.startsWith("**") && trimmed.endsWith("**") && trimmed.length > 4) {
    const inner = trimmed.slice(2, -2);
    const isSection = /^[A-Z][A-Z\s&/,\-–]+$/.test(inner) && inner.length >= 3;
    return { kind: isSection ? "section" : "bold", text: inner };
  }
  return { kind: "text", text: line };
}

function ResumeDisplay({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="font-sans text-sm text-slate-700 leading-relaxed">
      {lines.map((line, i) => {
        const parsed = parseResumeLine(line);
        if (parsed.kind === "blank") return <div key={i} className="h-2" />;
        if (parsed.kind === "section") {
          return (
            <div key={i} className="font-bold text-slate-900 text-[13px] uppercase tracking-wide border-b border-slate-200 pb-0.5 mt-4 mb-1 first:mt-0">
              {parsed.text}
            </div>
          );
        }
        if (parsed.kind === "bold") {
          return <div key={i} className="font-bold text-slate-900">{parsed.text}</div>;
        }
        if (parsed.kind === "bullet") {
          return (
            <div key={i} className="flex gap-2 pl-1 mt-0.5">
              <span className="shrink-0 select-none">•</span>
              <span>{parsed.text}</span>
            </div>
          );
        }
        return <div key={i}>{parsed.text}</div>;
      })}
    </div>
  );
}

async function handleDownloadDocx(r: FullHistoryResult) {
  if (!r?.tailoredResumeText) return;
  const { Document, Packer, Paragraph, TextRun, BorderStyle } = await import("docx");
  const lines = r.tailoredResumeText.split("\n");
  const paragraphs = lines.map((line) => {
    const parsed = parseResumeLine(line);
    if (parsed.kind === "blank") return new Paragraph({});
    if (parsed.kind === "section") {
      return new Paragraph({
        children: [new TextRun({ text: parsed.text, bold: true, size: 22 })],
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "cccccc" } },
        spacing: { before: 200, after: 80 },
      });
    }
    if (parsed.kind === "bold") {
      return new Paragraph({ children: [new TextRun({ text: parsed.text, bold: true, size: 20 })] });
    }
    if (parsed.kind === "bullet") {
      return new Paragraph({
        children: [new TextRun({ text: parsed.text, size: 20 })],
        bullet: { level: 0 },
        spacing: { before: 40 },
      });
    }
    return new Paragraph({ children: [new TextRun({ text: parsed.text || " ", size: 20 })] });
  });
  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${r.jobTitle.replace(/[^a-z0-9]/gi, "_")}_tailored_resume.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

async function handleDownloadPdf(r: FullHistoryResult) {
  if (!r?.tailoredResumeText) return;
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 50;
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;
  const lineHeight = 14;
  function checkPage() {
    if (y > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
  }
  const lines = r.tailoredResumeText.split("\n");
  for (const line of lines) {
    const parsed = parseResumeLine(line);
    if (parsed.kind === "blank") { y += lineHeight * 0.5; continue; }
    if (parsed.kind === "section") {
      y += 6;
      checkPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(parsed.text || " ", margin, y);
      y += 3;
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, y, margin + maxWidth, y);
      y += lineHeight;
      doc.setDrawColor(0, 0, 0);
    } else if (parsed.kind === "bold") {
      checkPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const wrapped = doc.splitTextToSize(parsed.text || " ", maxWidth) as string[];
      for (const wl of wrapped) { checkPage(); doc.text(wl, margin, y); y += lineHeight; }
    } else if (parsed.kind === "bullet") {
      checkPage();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const wrapped = doc.splitTextToSize(parsed.text || " ", maxWidth - 14) as string[];
      doc.text("•", margin, y);
      for (let wi = 0; wi < wrapped.length; wi++) {
        checkPage();
        doc.text(wrapped[wi], margin + 14, y);
        y += lineHeight;
      }
    } else {
      checkPage();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const wrapped = doc.splitTextToSize(parsed.text || " ", maxWidth) as string[];
      for (const wl of wrapped) { checkPage(); doc.text(wl, margin, y); y += lineHeight; }
    }
  }
  doc.save(`${r.jobTitle.replace(/[^a-z0-9]/gi, "_")}_tailored_resume.pdf`);
}

export default function ResumeHistory() {
  const [, setLocation] = useLocation();
  const { signIn, getAuthHeaders } = useAuthActions();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [fullResult, setFullResult] = useState<FullHistoryResult | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const { data, isLoading, isError, error } = useQuery<{ history: HistoryItem[] }>({
    queryKey: ["resume-history-page"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/resume/history", { credentials: "include", headers });
      if (res.status === 401) throw new Error("UNAUTHORIZED");
      if (!res.ok) throw new Error("Failed");
      const d = await res.json() as { history: HistoryItem[] };
      return { history: d.history ?? [] };
    },
    retry: false,
  });

  const isLoggedOut = (error as Error | null)?.message === "UNAUTHORIZED";

  async function openItem(id: number) {
    if (expandedId === id) { setExpandedId(null); setFullResult(null); return; }
    setExpandedId(id);
    setFullResult(null);
    setLoadingId(id);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/resume/result/${id}`, { credentials: "include", headers });
      if (res.ok) setFullResult(await res.json() as FullHistoryResult);
    } finally {
      setLoadingId(null);
    }
  }

  const history = data?.history ?? [];

  return (
    <div className="min-h-screen bg-white flex flex-col overflow-x-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-48 -right-48 w-[700px] h-[700px] rounded-full bg-blue-500/35 blur-[90px]" />
        <div className="absolute -top-32 -left-48 w-[600px] h-[600px] rounded-full bg-purple-500/30 blur-[80px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[400px] rounded-full bg-indigo-400/20 blur-[110px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] rounded-full bg-blue-500/12 blur-[110px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[400px] rounded-full bg-purple-500/10 blur-[110px]" />
      </div>
      <div className="absolute top-0 left-0 right-0 h-[70vh] bg-gradient-to-b from-blue-100/90 via-purple-50/40 to-transparent pointer-events-none" />

      <AppHeader
        right={
          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer text-slate-600 font-medium hover:text-blue-700 hover:bg-blue-50 gap-2"
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Button>
        }
      />

      <div className="flex-1 p-6 relative z-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Resume Tailor History</h1>
            <p className="text-slate-500 text-sm">Your past AI-tailored resumes</p>
          </div>

          {isLoading && (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          )}

          {isError && isLoggedOut && (
            <Card className="bg-white border-red-200 shadow-sm">
              <CardContent className="py-12 text-center space-y-4">
                <p className="text-red-600 font-semibold text-lg">Sign In Required</p>
                <p className="text-slate-600 text-sm max-w-md mx-auto">
                  You must be signed in to view your resume tailor history.
                </p>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => signIn({ redirectUrl: window.location.href })}
                >
                  Sign In
                </Button>
              </CardContent>
            </Card>
          )}

          {isError && !isLoggedOut && (
            <Card className="bg-white border-red-200 shadow-sm">
              <CardContent className="py-8 text-center text-red-600">
                Failed to load history. Please try again.
              </CardContent>
            </Card>
          )}

          {!isLoading && !isError && history.length === 0 && (
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardContent className="py-16 text-center space-y-4">
                <FileText className="h-12 w-12 text-slate-300 mx-auto" />
                <p className="text-slate-500">You haven't tailored any resumes yet.</p>
                <Button onClick={() => setLocation("/resume-tailor")} variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50">
                  Tailor Your First Resume
                </Button>
              </CardContent>
            </Card>
          )}

          {!isLoading && !isError && history.length > 0 && (
            <div className="space-y-3">
              {history.map((item) => {
                const isOpen = expandedId === item.id;
                const date = new Date(item.createdAt).toLocaleDateString("en-US", {
                  year: "numeric", month: "short", day: "numeric",
                  hour: "2-digit", minute: "2-digit",
                });
                const scopeLabel = item.scope === "full" ? "Full resume" : "Recent role only";
                const aggLabel = item.aggressiveness === "conservative" ? "Conservative" : item.aggressiveness === "balanced" ? "Balanced" : "Strong";
                return (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                      onClick={() => openItem(item.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 text-sm truncate">{item.jobTitle}</p>
                          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-400 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {date}
                            </span>
                            <span className="hidden sm:inline">·</span>
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-3 w-3" /> {scopeLabel}
                            </span>
                            <span className="hidden sm:inline">·</span>
                            <span>{aggLabel}</span>
                          </div>
                        </div>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 ml-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-100">
                        {loadingId === item.id ? (
                          <div className="flex items-center justify-center py-10">
                            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                          </div>
                        ) : fullResult?.id === item.id ? (
                          <div className="p-5 space-y-4">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tailored Resume</p>
                              <div className="flex gap-1.5">
                                <Button variant="outline" size="sm" onClick={() => handleDownloadDocx(fullResult)} className="h-7 text-xs gap-1.5 text-slate-600 border-slate-200 hover:border-slate-300">
                                  <Download className="w-3 h-3" /> Word
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(fullResult)} className="h-7 text-xs gap-1.5 text-slate-600 border-slate-200 hover:border-slate-300">
                                  <Download className="w-3 h-3" /> PDF
                                </Button>
                              </div>
                            </div>
                            <div className="rounded-lg border border-slate-100 bg-slate-50 p-5 max-h-96 overflow-y-auto">
                              <ResumeDisplay text={fullResult.tailoredResumeText} />
                            </div>
                            {fullResult.changeSummary?.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Changes Made</p>
                                <ul className="space-y-1">
                                  {fullResult.changeSummary.map((c, i) => (
                                    <li key={i} className="flex gap-2 text-sm text-slate-600">
                                      <span className="text-emerald-500 shrink-0 mt-0.5">✓</span>
                                      <span>{c}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {fullResult.atsKeywords?.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">ATS Keywords Added</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {fullResult.atsKeywords.map((kw, i) => (
                                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">{kw}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <AppFooter />
    </div>
  );
}

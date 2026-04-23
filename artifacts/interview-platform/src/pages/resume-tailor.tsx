import React, { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { AppHeader } from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import { useAuthActions } from "@/contexts/auth-actions";
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  X,
  Loader2,
  Check,
  Copy,
  Download,
  Sparkles,
  FileText,
  Briefcase,
  Tag,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  LogIn,
  UserPlus,
  RotateCcw,
  AlertTriangle,
  Info,
} from "lucide-react";

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

function stripMarkdown(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("**") && trimmed.endsWith("**") && trimmed.length > 4) {
        return trimmed.slice(2, -2);
      }
      if (trimmed.startsWith("• ")) return "• " + trimmed.slice(2);
      return line;
    })
    .join("\n");
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

interface ResumeTailorProps {
  authMenu?: React.ReactNode;
  authMobileMenu?: React.ReactNode;
  showAuthPrompt?: boolean;
}

interface TailoringResult {
  id: number;
  jobTitle: string;
  scope: Scope;
  aggressiveness: Aggressiveness;
  tailoredResumeText: string;
  changeSummary: string[];
  atsKeywords: string[];
  improvementSuggestions: string[];
  creditsRemaining: number;
}

type Scope = "full" | "role_specific";
type Aggressiveness = "conservative" | "balanced" | "strong";

const STEPS = ["Job Description", "Your Resume", "Options", "Results"];

const LOADING_MESSAGES = [
  "Reading your resume…",
  "Analyzing the job description…",
  "Matching your experience to requirements…",
  "Rewriting bullet points for ATS…",
  "Incorporating keywords naturally…",
  "Polishing your tailored resume…",
  "Almost there — finalizing the output…",
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <div className={`h-px w-8 sm:w-14 transition-colors ${done ? "bg-blue-500" : "bg-slate-200"}`} />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  done
                    ? "bg-blue-600 text-white"
                    : active
                    ? "bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-md shadow-blue-200"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {done ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`hidden sm:block text-xs font-medium ${active ? "text-blue-700" : done ? "text-slate-600" : "text-slate-400"}`}>
                {label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function FileDropZone({
  onFile,
  onText,
  text,
  setText,
  placeholder,
  file,
  setFile,
  parsing,
}: {
  onFile: (file: File) => void;
  onText?: (text: string) => void;
  text: string;
  setText: (t: string) => void;
  placeholder: string;
  file: File | null;
  setFile: (f: File | null) => void;
  parsing: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    onFile(f);
  }, [onFile, setFile]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !file && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-5 transition-all cursor-pointer text-center ${
          dragging ? "border-blue-400 bg-blue-50" : file ? "border-slate-300 bg-slate-50 cursor-default" : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/40"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        {parsing ? (
          <div className="flex items-center justify-center gap-2 text-slate-500 py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Extracting text…</span>
          </div>
        ) : file ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-slate-700 text-sm">
              <FileText className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="truncate max-w-[200px]">{file.name}</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setFile(null); setText(""); }}
              className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-1 py-2">
            <Upload className="w-5 h-5 text-slate-400 mx-auto" />
            <p className="text-sm text-slate-500">
              <span className="text-blue-600 font-medium">Upload a file</span> or drag & drop
            </p>
            <p className="text-xs text-slate-400">PDF, DOCX, DOC, TXT</p>
          </div>
        )}
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-xs text-slate-400 font-medium">or paste text below</span>
        </div>
      </div>

      <Textarea
        value={text}
        onChange={(e) => { setText(e.target.value); if (e.target.value) setFile(null); }}
        placeholder={placeholder}
        rows={8}
        className="resize-none text-sm text-slate-700 border-slate-200 focus:border-blue-400 focus:ring-blue-400/20"
      />
    </div>
  );
}

function ScopeCard({
  value,
  selected,
  onSelect,
  title,
  description,
  icon: Icon,
}: {
  value: Scope;
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
        selected
          ? "border-blue-500 bg-blue-50 shadow-sm shadow-blue-100"
          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 p-2 rounded-lg ${selected ? "bg-blue-100" : "bg-slate-100"}`}>
          <Icon className={`w-4 h-4 ${selected ? "text-blue-600" : "text-slate-500"}`} />
        </div>
        <div>
          <p className={`font-semibold text-sm ${selected ? "text-blue-800" : "text-slate-800"}`}>{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
        {selected && <Check className="w-4 h-4 text-blue-600 ml-auto mt-0.5 shrink-0" />}
      </div>
    </button>
  );
}

function AggressivenessCard({
  value,
  selected,
  onSelect,
  title,
  description,
  color,
}: {
  value: Aggressiveness;
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
        selected
          ? "border-purple-500 bg-purple-50 shadow-sm shadow-purple-100"
          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`text-xl ${color}`}>{value === "conservative" ? "🌿" : value === "balanced" ? "⚖️" : "🚀"}</span>
        <div className="flex-1">
          <p className={`font-semibold text-sm ${selected ? "text-purple-800" : "text-slate-800"}`}>{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
        {selected && <Check className="w-4 h-4 text-purple-600 ml-auto mt-0.5 shrink-0" />}
      </div>
    </button>
  );
}

function AuthPromptCard() {
  const { signIn, signUp } = useAuthActions();
  const redirectUrl = window.location.href;
  return (
    <Card className="bg-white shadow-sm border-slate-200">
      <CardContent className="py-10 text-center space-y-5">
        <div className="space-y-2">
          <p className="text-lg font-semibold text-slate-900">Sign in to tailor your resume</p>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Create a free account to access the AI Resume Tailoring service.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0 gap-2"
            onClick={() => signIn({ redirectUrl })}
          >
            <LogIn className="w-4 h-4" /> Sign In
          </Button>
          <Button
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-50 gap-2"
            onClick={() => signUp({ redirectUrl })}
          >
            <UserPlus className="w-4 h-4" /> Create Account
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ResumeTailor({ authMenu, authMobileMenu, showAuthPrompt }: ResumeTailorProps) {
  const [, setLocation] = useLocation();
  const { getAuthHeaders } = useAuthActions();

  const [step, setStep] = useState(0);

  const [jdText, setJdText] = useState("");
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [jdParsing, setJdParsing] = useState(false);

  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeParsing, setResumeParsing] = useState(false);

  const [scope, setScope] = useState<Scope>("full");
  const [aggressiveness, setAggressiveness] = useState<Aggressiveness>("balanced");

  const [loading, setLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  const [error, setError] = useState("");
  const [noCreditsError, setNoCreditsError] = useState(false);
  const [result, setResult] = useState<TailoringResult | null>(null);

  const [copied, setCopied] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [expandedSections, setExpandedSections] = useState({ changes: true, keywords: true, suggestions: false });

  const [showRegenPanel, setShowRegenPanel] = useState(false);
  const [regenScope, setRegenScope] = useState<Scope>("full");
  const [regenAggressiveness, setRegenAggressiveness] = useState<Aggressiveness>("balanced");
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenError, setRegenError] = useState("");

  const { data: meData, refetch: refetchCredits } = useQuery<{
    plan: string;
    resumeTailoringCredits: number;
  }>({
    queryKey: ["resume-me"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const [histRes, meRes] = await Promise.all([
        fetch("/api/resume/history", { credentials: "include", headers }),
        fetch("/api/users/me", { credentials: "include", headers, cache: "no-store" }),
      ]);
      if (!histRes.ok || !meRes.ok) throw new Error("Failed");
      const [hist, me] = await Promise.all([
        histRes.json() as Promise<{ creditsRemaining: number }>,
        meRes.json() as Promise<{ plan: string }>,
      ]);
      return { plan: me.plan, resumeTailoringCredits: hist.creditsRemaining };
    },
    enabled: !showAuthPrompt,
    staleTime: 0,
    retry: false,
  });

  useEffect(() => {
    if (!loading) {
      setLoadingMsgIdx(0);
      setLoadingElapsed(0);
      return;
    }
    const msgInterval = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 7000);
    const secInterval = setInterval(() => {
      setLoadingElapsed((s) => s + 1);
    }, 1000);
    return () => {
      clearInterval(msgInterval);
      clearInterval(secInterval);
    };
  }, [loading]);

  async function parseFile(file: File, kind: "jd" | "resume") {
    const setter = kind === "jd" ? setJdParsing : setResumeParsing;
    const textSetter = kind === "jd" ? setJdText : setResumeText;
    setter(true);
    try {
      const headers = await getAuthHeaders();
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/resume/parse-file", {
        method: "POST",
        credentials: "include",
        headers,
        body: fd,
      });
      const data = await res.json() as { text?: string; error?: string };
      if (!res.ok || !data.text) {
        setError(res.status === 401 ? "Your session has expired. Please sign in again." : (data.error ?? "Could not parse file"));
      } else {
        textSetter(data.text);
      }
    } catch {
      setError("Failed to upload file. Please paste text instead.");
    } finally {
      setter(false);
    }
  }

  async function handleSubmit() {
    setError("");
    setNoCreditsError(false);
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const fd = new FormData();
      fd.append("scope", scope);
      fd.append("aggressiveness", aggressiveness);
      if (jdText.trim()) {
        fd.append("jdText", jdText);
      } else if (jdFile) {
        fd.append("jdFile", jdFile);
      }
      if (resumeText.trim()) {
        fd.append("resumeText", resumeText);
      } else if (resumeFile) {
        fd.append("resumeFile", resumeFile);
      }
      const res = await fetch("/api/resume/tailor", {
        method: "POST",
        credentials: "include",
        headers,
        body: fd,
      });
      const data = await res.json() as TailoringResult & { code?: string; error?: string };
      if (!res.ok) {
        if (res.status === 401) {
          setError("Your session has expired. Please sign in again to continue.");
        } else if (data.code === "NO_CREDITS") {
          setNoCreditsError(true);
          setError(data.error ?? "You have no resume tailoring credits remaining.");
        } else {
          setError(data.error ?? "Something went wrong. Please try again.");
        }
        return;
      }
      setResult(data);
      setStep(3);
      refetchCredits();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegenerate() {
    if (!result) return;
    setRegenError("");
    setRegenLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/resume/regenerate", {
        method: "POST",
        credentials: "include",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ tailoringId: result.id, scope: regenScope, aggressiveness: regenAggressiveness }),
      });
      const data = await res.json() as TailoringResult & { code?: string; error?: string };
      if (!res.ok) {
        if (data.code === "NO_CREDITS") {
          setRegenError("No credits remaining. Top up or upgrade to regenerate.");
        } else {
          setRegenError(data.error ?? "Something went wrong. Please try again.");
        }
        return;
      }
      setResult(data);
      setShowRegenPanel(false);
      setExpandedSections({ changes: true, keywords: true, suggestions: false });
      setShowOriginal(false);
      refetchCredits();
    } catch {
      setRegenError("Network error. Please try again.");
    } finally {
      setRegenLoading(false);
    }
  }

  function handleCopy() {
    if (!result) return;
    navigator.clipboard.writeText(stripMarkdown(result.tailoredResumeText)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleDownloadDocx(resultOverride?: { jobTitle: string; tailoredResumeText: string }) {
    const r = resultOverride ?? result;
    if (!r) return;
    const { Document, Packer, Paragraph, TextRun } = await import("docx");
    const lines = r.tailoredResumeText.split("\n");
    const paragraphs = lines.map((line) => {
      const parsed = parseResumeLine(line);
      if (parsed.kind === "blank") {
        return new Paragraph({ children: [new TextRun({ text: "" })], spacing: { after: 60 } });
      }
      if (parsed.kind === "section") {
        return new Paragraph({
          children: [new TextRun({ text: parsed.text, bold: true, size: 22, allCaps: true })],
          spacing: { before: 240, after: 60 },
          border: { bottom: { style: "single", size: 6, color: "AAAAAA", space: 4 } },
        });
      }
      if (parsed.kind === "bold") {
        return new Paragraph({
          children: [new TextRun({ text: parsed.text, bold: true, size: 20 })],
          spacing: { after: 20 },
        });
      }
      if (parsed.kind === "bullet") {
        return new Paragraph({
          children: [new TextRun({ text: parsed.text, size: 20 })],
          bullet: { level: 0 },
          spacing: { after: 40 },
        });
      }
      return new Paragraph({
        children: [new TextRun({ text: parsed.text, size: 20 })],
        spacing: { after: 40 },
      });
    });
    const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
    const buffer = await Packer.toBlob(doc);
    const url = URL.createObjectURL(buffer);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${r.jobTitle.replace(/[^a-z0-9]/gi, "_")}_tailored_resume.docx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDownloadPdf(resultOverride?: { jobTitle: string; tailoredResumeText: string }) {
    const r = resultOverride ?? result;
    if (!r) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 60;
    const bulletIndent = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxWidth = pageWidth - margin * 2;
    const pageHeight = doc.internal.pageSize.getHeight();
    const lineHeight = 15;
    let y = margin;

    const checkPage = () => {
      if (y > pageHeight - margin) { doc.addPage(); y = margin; }
    };

    for (const rawLine of r.tailoredResumeText.split("\n")) {
      const parsed = parseResumeLine(rawLine);

      if (parsed.kind === "blank") {
        y += 6;
        continue;
      }

      if (parsed.kind === "section") {
        y += 10;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        checkPage();
        doc.text(parsed.text.toUpperCase(), margin, y);
        y += 3;
        doc.setDrawColor(170);
        doc.line(margin, y, pageWidth - margin, y);
        doc.setDrawColor(0);
        y += lineHeight - 2;
        continue;
      }

      if (parsed.kind === "bold") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        const wrapped = doc.splitTextToSize(parsed.text, maxWidth) as string[];
        for (const wl of wrapped) { checkPage(); doc.text(wl, margin, y); y += lineHeight; }
        continue;
      }

      if (parsed.kind === "bullet") {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const wrapped = doc.splitTextToSize(parsed.text, maxWidth - bulletIndent) as string[];
        checkPage();
        doc.text("•", margin, y);
        doc.text(wrapped[0], margin + bulletIndent, y);
        y += lineHeight;
        for (let i = 1; i < wrapped.length; i++) {
          checkPage();
          doc.text(wrapped[i], margin + bulletIndent, y);
          y += lineHeight;
        }
        continue;
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const wrapped = doc.splitTextToSize(parsed.text || " ", maxWidth) as string[];
      for (const wl of wrapped) { checkPage(); doc.text(wl, margin, y); y += lineHeight; }
    }
    doc.save(`${r.jobTitle.replace(/[^a-z0-9]/gi, "_")}_tailored_resume.pdf`);
  }

  function toggleSection(key: keyof typeof expandedSections) {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function startOver() {
    setStep(0);
    setJdText("");
    setJdFile(null);
    setResumeText("");
    setResumeFile(null);
    setScope("full");
    setAggressiveness("balanced");
    setResult(null);
    setError("");
    setShowRegenPanel(false);
    setRegenError("");
  }

  function openRegenPanel() {
    if (!result) return;
    setRegenScope(result.scope ?? "full");
    setRegenAggressiveness(result.aggressiveness ?? "balanced");
    setRegenError("");
    setShowRegenPanel(true);
  }

  const creditsRemaining = result?.creditsRemaining ?? meData?.resumeTailoringCredits ?? null;
  const jdReady = jdText.trim().length > 20 || !!jdFile;
  const resumeReady = resumeText.trim().length > 20 || !!resumeFile;

  return (
    <div className="min-h-screen bg-white flex flex-col overflow-x-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-48 -right-48 w-[700px] h-[700px] rounded-full bg-blue-500/30 blur-[90px]" />
        <div className="absolute -top-32 -left-48 w-[600px] h-[600px] rounded-full bg-purple-500/25 blur-[80px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[400px] rounded-full bg-indigo-400/15 blur-[110px]" />
      </div>
      <div className="absolute top-0 left-0 right-0 h-[60vh] bg-gradient-to-b from-blue-100/90 via-purple-50/40 to-transparent pointer-events-none" />

      <AppHeader
        right={
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-600 font-medium hover:text-blue-700 hover:bg-blue-50 gap-2"
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Button>
        }
        mobileMenuExtra={authMobileMenu}
      />

      <main className="flex-1 p-6 relative z-10">
        <div className="max-w-2xl mx-auto">

          <div className="mb-8 text-center space-y-2">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-full px-4 py-1.5 text-sm text-blue-700 font-medium shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              AI Resume Tailoring
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Land more interviews
            </h1>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Tailor your resume to any job description in seconds. ATS-optimized, human tone — never robotic.
            </p>
            {creditsRemaining !== null && step < 3 && (
              creditsRemaining === 0 ? (
                <div className="inline-flex items-center gap-2 bg-red-50 border border-red-200 rounded-full px-4 py-1.5 text-sm text-red-700 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  No tailor credits left —{" "}
                  <a href="/pricing" className="underline underline-offset-2 hover:text-red-900">upgrade or top up</a>
                </div>
              ) : creditsRemaining === 1 ? (
                <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 text-sm text-amber-700 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  1 tailor credit left —{" "}
                  <a href="/pricing" className="underline underline-offset-2 hover:text-amber-900">top up</a>
                </div>
              ) : (
                <p className="text-xs font-medium text-slate-500">
                  {`${creditsRemaining} tailoring credit${creditsRemaining !== 1 ? "s" : ""} remaining`}
                </p>
              )
            )}
          </div>

          {showAuthPrompt ? (
            <AuthPromptCard />
          ) : meData?.plan === "free" && !meData?.resumeTailoringCredits && !result ? (
            <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mx-auto shadow-lg">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-slate-900">Resume Tailoring is a paid feature</h2>
                <p className="text-slate-500 text-sm max-w-sm mx-auto">
                  Upgrade to Starter or Pro to tailor your resume to any job description — ATS-optimised, human tone.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
                <a
                  href="/pricing"
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm shadow-md transition-all hover:scale-[1.02]"
                >
                  View plans &amp; upgrade
                </a>
              </div>
            </div>
          ) : (
            <>
              {step < 3 && <StepIndicator current={step} />}

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
                  <span className="shrink-0 mt-0.5 font-black">!</span>
                  <span>
                    {error}
                    {noCreditsError && (
                      <> <a href="/pricing" className="underline underline-offset-2 font-medium hover:text-red-900">View plans &amp; upgrade →</a></>
                    )}
                  </span>
                </div>
              )}

              {/* ── Step 0: Job Description ── */}
              {step === 0 && (
                <Card className="shadow-sm border-slate-200">
                  <CardContent className="p-6 space-y-4">
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-blue-500" />
                        Job Description
                      </h2>
                      <p className="text-sm text-slate-500">
                        Paste or upload the job posting. Include the title, responsibilities, and required skills.
                      </p>
                    </div>
                    <FileDropZone
                      text={jdText}
                      setText={setJdText}
                      file={jdFile}
                      setFile={setJdFile}
                      onFile={(f) => parseFile(f, "jd")}
                      parsing={jdParsing}
                      placeholder="Paste the full job description here — job title, responsibilities, required skills, qualifications…"
                    />
                    <div className="flex justify-end pt-2">
                      <Button
                        onClick={() => setStep(1)}
                        disabled={!jdReady || jdParsing}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0 gap-2"
                      >
                        Next <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── Step 1: Resume ── */}
              {step === 1 && (
                <Card className="shadow-sm border-slate-200">
                  <CardContent className="p-6 space-y-4">
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-500" />
                        Your Resume
                      </h2>
                      <p className="text-sm text-slate-500">
                        Upload your current resume or paste the text. Supported: PDF, DOCX, TXT.
                      </p>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
                      <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-blue-700 leading-relaxed">
                        <span className="font-semibold">Privacy tip:</span> We recommend removing your personal contact details — full name, address, phone number, and email — before uploading. The tailored result will include clearly marked placeholders (e.g. <span className="font-mono bg-blue-100 px-1 rounded">[Your Name]</span>, <span className="font-mono bg-blue-100 px-1 rounded">[Phone Number]</span>) so you know exactly where to add them back before sending to employers.
                      </p>
                    </div>
                    <FileDropZone
                      text={resumeText}
                      setText={setResumeText}
                      file={resumeFile}
                      setFile={setResumeFile}
                      onFile={(f) => parseFile(f, "resume")}
                      parsing={resumeParsing}
                      placeholder="Paste your resume here — omit your name, address, phone and email (placeholders will be added). Include your summary, experience, education and skills…"
                    />
                    <div className="flex justify-between pt-2">
                      <Button variant="ghost" onClick={() => setStep(0)} className="text-slate-600 gap-1">
                        <ArrowLeft className="w-4 h-4" /> Back
                      </Button>
                      <Button
                        onClick={() => setStep(2)}
                        disabled={!resumeReady || resumeParsing}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0 gap-2"
                      >
                        Next <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── Step 2: Options ── */}
              {step === 2 && (
                <Card className="shadow-sm border-slate-200">
                  <CardContent className="p-6 space-y-6">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900 mb-3">Optimization Scope</h2>
                      <div className="space-y-2">
                        <ScopeCard
                          value="full"
                          selected={scope === "full"}
                          onSelect={() => setScope("full")}
                          icon={FileText}
                          title="Full Resume Optimization"
                          description="Tailors your summary, all relevant experience roles, and the skills section for maximum alignment."
                        />
                        <ScopeCard
                          value="role_specific"
                          selected={scope === "role_specific"}
                          onSelect={() => setScope("role_specific")}
                          icon={Briefcase}
                          title="Role-Specific Optimization"
                          description="Tailors only your most recent role and the summary. Older roles are left mostly unchanged."
                        />
                      </div>
                    </div>

                    <div>
                      <h2 className="text-lg font-semibold text-slate-900 mb-3">Optimization Aggressiveness</h2>
                      <div className="space-y-2">
                        <AggressivenessCard
                          value="conservative"
                          selected={aggressiveness === "conservative"}
                          onSelect={() => setAggressiveness("conservative")}
                          title="Conservative"
                          description="Light edits. Preserves your original phrasing with minimal changes — just enough for ATS alignment."
                          color=""
                        />
                        <AggressivenessCard
                          value="balanced"
                          selected={aggressiveness === "balanced"}
                          onSelect={() => setAggressiveness("balanced")}
                          title="Balanced"
                          description="Standard ATS optimization with natural rephrasing. Recommended for most people."
                          color=""
                        />
                        <AggressivenessCard
                          value="strong"
                          selected={aggressiveness === "strong"}
                          onSelect={() => setAggressiveness("strong")}
                          title="Strong Optimization"
                          description="Extensive rewriting for maximum alignment. Best when your background doesn't closely match the role."
                          color=""
                        />
                      </div>
                    </div>

                    <div className="flex justify-between pt-2">
                      <Button variant="ghost" onClick={() => setStep(1)} disabled={loading} className="text-slate-600 gap-1">
                        <ArrowLeft className="w-4 h-4" /> Back
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0 gap-2"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                            <span className="truncate max-w-[220px]">{LOADING_MESSAGES[loadingMsgIdx]}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Tailor My Resume
                          </>
                        )}
                      </Button>
                    </div>
                    {loading && (
                      <p className="text-center text-xs text-slate-400 pt-1">
                        AI tailoring typically takes 1–3 minutes. Please keep this page open.
                        {loadingElapsed >= 10 && (
                          <span className="ml-1 tabular-nums">({loadingElapsed}s)</span>
                        )}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ── Step 3: Results ── */}
              {step === 3 && result && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">
                        Tailored for: <span className="text-blue-700">{result.jobTitle}</span>
                      </h2>
                      {result.creditsRemaining > 0 ? (
                        <p className="text-sm text-slate-500 mt-0.5">
                          {result.creditsRemaining} tailoring credit{result.creditsRemaining !== 1 ? "s" : ""} remaining
                        </p>
                      ) : (
                        <p className="text-sm text-amber-600 mt-0.5 font-medium">
                          0 credits remaining —{" "}
                          <a href="/pricing" className="underline underline-offset-2 hover:text-amber-700">
                            top up or upgrade
                          </a>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openRegenPanel}
                        className="gap-1.5 text-purple-700 border-purple-200 hover:text-purple-800 hover:bg-purple-50 hover:border-purple-300"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Regenerate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={startOver}
                        className="gap-1.5 text-slate-600 border-slate-200 hover:text-blue-700 hover:bg-blue-50 hover:border-blue-200"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        New Tailoring
                      </Button>
                    </div>
                  </div>

                  {/* ── Regenerate panel ── */}
                  {showRegenPanel && (
                    <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 shadow-sm">
                      <CardContent className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-500" />
                            Regenerate with different options
                          </h3>
                          <button
                            onClick={() => setShowRegenPanel(false)}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-500">
                          Your resume and job description are saved — just pick new settings and generate a fresh version. Uses 1 credit.
                        </p>

                        <div>
                          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Scope</p>
                          <div className="grid grid-cols-2 gap-2">
                            {(["full", "role_specific"] as Scope[]).map((s) => (
                              <button
                                key={s}
                                onClick={() => setRegenScope(s)}
                                className={`px-3 py-2.5 rounded-lg border text-sm font-medium text-left transition-all ${
                                  regenScope === s
                                    ? "border-purple-400 bg-white text-purple-700 shadow-sm"
                                    : "border-slate-200 bg-white/60 text-slate-600 hover:border-purple-300 hover:text-purple-600"
                                }`}
                              >
                                {s === "full" ? "Full Resume" : "Last Role Only"}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Aggressiveness</p>
                          <div className="grid grid-cols-3 gap-2">
                            {(["conservative", "balanced", "strong"] as Aggressiveness[]).map((a) => (
                              <button
                                key={a}
                                onClick={() => setRegenAggressiveness(a)}
                                className={`px-3 py-2.5 rounded-lg border text-sm font-medium text-center capitalize transition-all ${
                                  regenAggressiveness === a
                                    ? "border-purple-400 bg-white text-purple-700 shadow-sm"
                                    : "border-slate-200 bg-white/60 text-slate-600 hover:border-purple-300 hover:text-purple-600"
                                }`}
                              >
                                {a === "strong" ? "Strong" : a.charAt(0).toUpperCase() + a.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>

                        {regenError && (
                          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            {regenError}
                            {regenError.includes("credits") && (
                              <> <a href="/pricing" className="underline underline-offset-2 font-medium hover:text-red-900">Top up →</a></>
                            )}
                          </div>
                        )}

                        <Button
                          onClick={handleRegenerate}
                          disabled={regenLoading}
                          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border-0 gap-2"
                        >
                          {regenLoading ? (
                            <><Loader2 className="w-4 h-4 animate-spin" />Generating new version…</>
                          ) : (
                            <><Sparkles className="w-4 h-4" />Generate New Version</>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {/* Tailored resume */}
                  <Card className="shadow-sm border-slate-200">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                      <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500" />
                        Tailored Resume
                      </h3>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCopy}
                          className="gap-1.5 text-slate-500 hover:text-slate-700 h-8"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                          {copied ? "Copied" : "Copy"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadDocx()}
                          className="gap-1.5 text-slate-500 hover:text-slate-700 h-8"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Word
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadPdf()}
                          className="gap-1.5 text-slate-500 hover:text-slate-700 h-8"
                        >
                          <Download className="w-3.5 h-3.5" />
                          PDF
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-5">
                      <ResumeDisplay text={result.tailoredResumeText} />
                    </CardContent>
                  </Card>

                  {/* Toggle original */}
                  <button
                    onClick={() => setShowOriginal((v) => !v)}
                    className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    {showOriginal ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {showOriginal ? "Hide" : "Show"} original resume
                  </button>
                  {showOriginal && (
                    <Card className="shadow-sm border-slate-200 bg-slate-50">
                      <CardContent className="p-5">
                        <pre className="whitespace-pre-wrap font-sans text-xs text-slate-500 leading-relaxed">
                          {resumeText}
                        </pre>
                      </CardContent>
                    </Card>
                  )}

                  {/* Changes summary */}
                  {result.changeSummary.length > 0 && (
                    <Card className="shadow-sm border-slate-200">
                      <button
                        className="w-full flex items-center justify-between px-5 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors"
                        onClick={() => toggleSection("changes")}
                      >
                        <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-500" />
                          Changes Made ({result.changeSummary.length})
                        </h3>
                        {expandedSections.changes ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </button>
                      {expandedSections.changes && (
                        <CardContent className="p-5">
                          <ul className="space-y-2">
                            {result.changeSummary.map((change, i) => (
                              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                                <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                                {change}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      )}
                    </Card>
                  )}

                  {/* ATS Keywords */}
                  {result.atsKeywords.length > 0 && (
                    <Card className="shadow-sm border-slate-200">
                      <button
                        className="w-full flex items-center justify-between px-5 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors"
                        onClick={() => toggleSection("keywords")}
                      >
                        <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                          <Tag className="w-4 h-4 text-blue-500" />
                          ATS Keywords Incorporated ({result.atsKeywords.length})
                        </h3>
                        {expandedSections.keywords ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </button>
                      {expandedSections.keywords && (
                        <CardContent className="p-5">
                          <div className="flex flex-wrap gap-2">
                            {result.atsKeywords.map((kw, i) => (
                              <span key={i} className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium px-2.5 py-1 rounded-full">
                                {kw}
                              </span>
                            ))}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  )}

                  {/* Improvement Suggestions */}
                  {result.improvementSuggestions.length > 0 && (
                    <Card className="shadow-sm border-slate-200">
                      <button
                        className="w-full flex items-center justify-between px-5 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors"
                        onClick={() => toggleSection("suggestions")}
                      >
                        <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-amber-500" />
                          Further Improvement Tips ({result.improvementSuggestions.length})
                        </h3>
                        {expandedSections.suggestions ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </button>
                      {expandedSections.suggestions && (
                        <CardContent className="p-5">
                          <ul className="space-y-2">
                            {result.improvementSuggestions.map((tip, i) => (
                              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                                <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      )}
                    </Card>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <AppFooter />
    </div>
  );
}

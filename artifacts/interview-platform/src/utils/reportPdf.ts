import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface AnswerFeedbackItem {
  questionId: number;
  questionText: string;
  answerText?: string | null;
  feedback: string;
  score: number;
  strengths: string[];
  improvements: string[];
}

interface ReportData {
  overallScore: number;
  communicationScore: number;
  technicalScore: number;
  confidenceScore: number;
  postureScore: number;
  summary: string;
  suggestions?: string[];
  postureNotes?: string[];
  answerFeedback: AnswerFeedbackItem[];
  generatedAt: string;
}

interface SessionData {
  session?: { jobRole: string } | null;
}

interface FillerResult {
  total: number;
  rate: number;
  wordCount: number;
  breakdown: { word: string; count: number }[];
}

const FILLER_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bum+\b/gi, label: "um" },
  { pattern: /\buh+\b/gi, label: "uh" },
  { pattern: /\ber+\b/gi, label: "er" },
  { pattern: /\bhmm+\b/gi, label: "hmm" },
  { pattern: /\byou know\b/gi, label: "you know" },
  { pattern: /\bi mean\b/gi, label: "I mean" },
  { pattern: /\bkind of\b/gi, label: "kind of" },
  { pattern: /\bsort of\b/gi, label: "sort of" },
  { pattern: /\bbasically\b/gi, label: "basically" },
  { pattern: /\bliterally\b/gi, label: "literally" },
  { pattern: /\blike\b/gi, label: "like" },
];

function analyzeFillerWords(answers: (string | null)[]): FillerResult {
  const allText = answers.filter(Boolean).join(" ");
  const wordCount = allText.trim() ? allText.trim().split(/\s+/).length : 0;
  const breakdown: { word: string; count: number }[] = [];
  let total = 0;
  for (const { pattern, label } of FILLER_PATTERNS) {
    const matches = allText.match(pattern);
    const count = matches?.length ?? 0;
    if (count > 0) breakdown.push({ word: label, count }), (total += count);
  }
  breakdown.sort((a, b) => b.count - a.count);
  const rate = wordCount > 0 ? Math.round((total / wordCount) * 1000) / 10 : 0;
  return { total, rate, wordCount, breakdown };
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bar(value: number, color: string): string {
  return `<div style="height:8px;background:#f1f5f9;border-radius:9999px;overflow:hidden;border:1px solid #e2e8f0;"><div style="height:100%;width:${value}%;background:${color};border-radius:9999px;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div></div>`;
}

function qCard(fb: AnswerFeedbackItem, idx: number): string {
  const c = fb.score >= 80 ? "#059669" : fb.score >= 60 ? "#d97706" : "#dc2626";
  const bg = fb.score >= 80 ? "#ecfdf5" : fb.score >= 60 ? "#fffbeb" : "#fef2f2";
  const bd = fb.score >= 80 ? "#a7f3d0" : fb.score >= 60 ? "#fde68a" : "#fecaca";
  const str = fb.strengths.map((s) => `<li style="color:#475569;font-size:11px;margin-bottom:3px;">• ${esc(s)}</li>`).join("");
  const imp = fb.improvements.map((s) => `<li style="color:#475569;font-size:11px;margin-bottom:3px;">• ${esc(s)}</li>`).join("");
  return `<div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#fff;margin-bottom:14px;page-break-inside:avoid;break-inside:avoid;">
  <div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:9px 16px;display:flex;align-items:center;justify-content:space-between;">
    <span style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Question ${idx + 1}</span>
    <span style="font-size:10px;font-weight:700;padding:2px 9px;border-radius:9999px;border:1px solid ${bd};background:${bg};color:${c};-webkit-print-color-adjust:exact;">${fb.score}/100</span>
  </div>
  <div style="padding:16px;">
    <p style="font-size:12.5px;font-weight:600;color:#0f172a;margin:0 0 9px;line-height:1.45;">${esc(fb.questionText)}</p>
    <p style="font-size:11px;color:#64748b;font-style:italic;line-height:1.55;border-left:2px solid #cbd5e1;padding-left:10px;margin:0 0 12px;">&ldquo;${esc(fb.answerText || "No answer recorded.")}&rdquo;</p>
    <p style="font-size:10.5px;font-weight:600;color:#334155;margin:0 0 3px;">Feedback</p>
    <p style="font-size:11px;color:#475569;line-height:1.55;margin:0 0 12px;">${esc(fb.feedback)}</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;border-top:1px solid #f1f5f9;padding-top:10px;">
      <div><p style="font-size:8.5px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 5px;">Strengths</p><ul style="list-style:none;margin:0;padding:0;">${str}</ul></div>
      <div><p style="font-size:8.5px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 5px;">To Improve</p><ul style="list-style:none;margin:0;padding:0;">${imp}</ul></div>
    </div>
  </div>
</div>`;
}

function buildHtml(report: ReportData, sessionData?: SessionData | null): string {
  const filler = analyzeFillerWords(report.answerFeedback.map((f) => f.answerText ?? null));
  const fl = filler.rate < 2 ? "low" : filler.rate < 5 ? "moderate" : "high";
  const fc = fl === "low" ? "#059669" : fl === "moderate" ? "#d97706" : "#dc2626";
  const fbg = fl === "low" ? "#ecfdf5" : fl === "moderate" ? "#fffbeb" : "#fef2f2";
  const fbd = fl === "low" ? "#a7f3d0" : fl === "moderate" ? "#fde68a" : "#fecaca";
  const flabel = fl === "low" ? "Minimal" : fl === "moderate" ? "Moderate" : "Excessive";

  const suggestions = [...(report.suggestions ?? []), "Practice structuring answers using the STAR method.", "Provide more specific examples and quantifiable outcomes.", "Work on concise delivery and eliminating filler words."].slice(0, 3);

  const postureNotes = (() => {
    const seen = new Set<string>();
    return (report.postureNotes ?? []).filter((n) => { const k = n.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  })();

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#1e293b;background:#fff;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.page{width:1100px;padding:36px 40px;}
.card{border:1px solid #e2e8f0;border-radius:8px;background:#fff;margin-bottom:14px;overflow:hidden;}
.ch{padding:12px 16px;border-bottom:1px solid #e2e8f0;}
.ct{font-size:12.5px;font-weight:600;color:#0f172a;}
.cb{padding:14px 16px;}
</style></head><body><div class="page">

<div style="display:flex;align-items:center;gap:14px;border-bottom:2.5px solid #1d4ed8;padding-bottom:14px;margin-bottom:20px;">
  <div style="flex-shrink:0;width:38px;height:38px;border-radius:7px;background:#1d4ed8;display:flex;align-items:center;justify-content:center;">
    <span style="color:#fff;font-size:6px;font-weight:700;letter-spacing:0.04em;text-align:center;line-height:1.2;">Interview<br/>AI</span>
  </div>
  <div style="flex:1;">
    <h1 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 2px;">Interview Performance Report</h1>
    ${sessionData?.session?.jobRole ? `<p style="font-size:10.5px;font-weight:600;color:#1d4ed8;margin:0 0 1px;">Role: ${esc(sessionData.session.jobRole)}</p>` : ""}
    <p style="font-size:9px;color:#64748b;margin:0;">Generated on ${new Date(report.generatedAt).toLocaleString()}</p>
  </div>
  <div style="flex-shrink:0;text-align:center;border:1.5px solid #bfdbfe;border-radius:9px;padding:8px 16px;background:#eff6ff;">
    <span style="display:block;font-size:8px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px;">Overall Score</span>
    <span style="display:block;font-size:28px;font-weight:700;color:#1d4ed8;line-height:1;">${report.overallScore}<span style="font-size:14px;color:#94a3b8;">/100</span></span>
  </div>
</div>

<div style="display:grid;grid-template-columns:300px 1fr;gap:20px;align-items:start;">
<div>

<div class="card">
  <div class="ch"><span class="ct">Executive Summary</span></div>
  <div class="cb"><p style="font-size:11.5px;color:#475569;line-height:1.6;">${esc(report.summary)}</p></div>
</div>

<div class="card">
  <div class="ch"><span class="ct">Category Breakdown</span></div>
  <div class="cb" style="display:flex;flex-direction:column;gap:13px;">
    <div><div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="font-size:11px;color:#334155;font-weight:500;">Communication</span><span style="font-size:11px;font-family:monospace;color:#334155;">${report.communicationScore}%</span></div>${bar(report.communicationScore, "#3b82f6")}<p style="font-size:8.5px;color:#94a3b8;margin-top:2px;">Clarity, structure, coherence, and relevance</p></div>
    <div><div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="font-size:11px;color:#334155;font-weight:500;">Technical</span><span style="font-size:11px;font-family:monospace;color:#334155;">${report.technicalScore}%</span></div>${bar(report.technicalScore, "#10b981")}<p style="font-size:8.5px;color:#94a3b8;margin-top:2px;">Domain knowledge and technical concepts</p></div>
    <div><div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="font-size:11px;color:#334155;font-weight:500;">Confidence</span><span style="font-size:11px;font-family:monospace;color:#334155;">${report.confidenceScore}%</span></div>${bar(report.confidenceScore, "#f59e0b")}<p style="font-size:8.5px;color:#94a3b8;margin-top:2px;">Assertive phrasing and directness</p></div>
    <div><div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="font-size:11px;color:#334155;font-weight:500;">Posture</span><span style="font-size:11px;font-family:monospace;color:#334155;">${report.postureScore}%</span></div>${bar(report.postureScore, "#a855f7")}<p style="font-size:8.5px;color:#94a3b8;margin-top:2px;">Body language and on-camera presence</p></div>
  </div>
</div>

${filler.wordCount > 0 ? `
<div class="card" style="border-color:${fbd};">
  <div class="ch" style="border-color:${fbd};display:flex;align-items:center;justify-content:space-between;">
    <span class="ct">Filler Word Usage</span>
    <span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:9999px;border:1px solid ${fbd};background:${fbg};color:${fc};-webkit-print-color-adjust:exact;">${flabel}</span>
  </div>
  <div class="cb">
    <div style="display:flex;align-items:baseline;gap:5px;margin-bottom:4px;"><span style="font-size:24px;font-weight:700;color:${fc};">${filler.rate}</span><span style="font-size:9.5px;color:#64748b;">per 100 words</span></div>
    <p style="font-size:10px;color:#64748b;margin-bottom:8px;">${filler.total} filler ${filler.total === 1 ? "word" : "words"} across ${filler.wordCount.toLocaleString()} words spoken.</p>
    ${filler.breakdown.length > 0 ? `<div style="border-top:1px solid #e2e8f0;padding-top:8px;"><p style="font-size:8px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:5px;">Most Used</p>${filler.breakdown.slice(0, 5).map(({ word, count }) => `<div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="font-size:10px;color:#64748b;font-style:italic;">"${esc(word)}"</span><span style="font-size:10px;font-family:monospace;font-weight:600;color:${fc};">×${count}</span></div>`).join("")}</div>` : ""}
  </div>
</div>` : ""}

<div class="card" style="background:#eff6ff;border-color:#bfdbfe;">
  <div class="ch" style="border-color:#bfdbfe;"><span class="ct" style="color:#1e40af;">Top Areas for Improvement</span></div>
  <div class="cb">
    <ul style="list-style:none;display:flex;flex-direction:column;gap:9px;">
      ${suggestions.map((s) => `<li style="display:flex;gap:7px;font-size:11px;color:#334155;"><span style="flex-shrink:0;color:#3b82f6;font-weight:600;">✓</span><span>${esc(s)}</span></li>`).join("")}
    </ul>
  </div>
</div>

${postureNotes.length > 0 ? `
<div class="card">
  <div class="ch"><span class="ct">Posture &amp; Presence Notes</span></div>
  <div class="cb">
    <ul style="list-style:none;display:flex;flex-direction:column;gap:7px;">
      ${postureNotes.map((n) => `<li style="display:flex;gap:7px;font-size:11px;color:#475569;"><span style="flex-shrink:0;color:#a855f7;">◉</span><span>${esc(n)}</span></li>`).join("")}
    </ul>
  </div>
</div>` : ""}

</div>
<div>
  <h2 style="font-size:15px;font-weight:600;color:#0f172a;margin-bottom:14px;">Question Analysis</h2>
  ${report.answerFeedback.map((fb, i) => qCard(fb, i)).join("")}
</div>
</div>

</div></body></html>`;
}

export async function downloadReportAsPdf(
  report: ReportData,
  sessionData?: SessionData | null,
  filename = "interview-report.pdf"
): Promise<void> {
  const html = buildHtml(report, sessionData);

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:1180px;height:2000px;visibility:hidden;border:none;";
  document.body.appendChild(iframe);

  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();
  });

  await new Promise((r) => setTimeout(r, 600));

  const pageEl = iframe.contentDocument!.querySelector(".page") as HTMLElement;
  iframe.style.height = `${pageEl.scrollHeight + 60}px`;
  await new Promise((r) => setTimeout(r, 100));

  const canvas = await html2canvas(pageEl, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    width: pageEl.scrollWidth,
    height: pageEl.scrollHeight,
    windowWidth: 1180,
  });

  document.body.removeChild(iframe);

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const usableW = pdfW - margin * 2;
  const scale = usableW / canvas.width;
  const fullH = canvas.height * scale;
  const pageH = pdfH - margin * 2;
  const totalPages = Math.ceil(fullH / pageH);

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) pdf.addPage();

    const srcY = Math.round((page * pageH) / scale);
    const srcH = Math.min(Math.round(pageH / scale), canvas.height - srcY);
    if (srcH <= 0) break;

    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = srcH;
    const ctx = slice.getContext("2d")!;
    ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

    const sliceImg = slice.toDataURL("image/jpeg", 0.92);
    const sliceH = srcH * scale;
    pdf.addImage(sliceImg, "JPEG", margin, margin, usableW, sliceH);
  }

  pdf.save(filename);
}

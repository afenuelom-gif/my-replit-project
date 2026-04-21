import React, { useState } from "react";
import { X, CheckCircle2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthActions } from "@/contexts/auth-actions";

interface FeedbackModalProps {
  sessionId: number;
  jobRole: string;
  onClose: () => void;
}

const RELEVANCE_OPTIONS = [
  { value: "highly_relevant",    label: "Highly relevant" },
  { value: "somewhat_relevant",  label: "Somewhat relevant" },
  { value: "not_relevant",       label: "Not relevant" },
] as const;

type Relevance = typeof RELEVANCE_OPTIONS[number]["value"];

export default function FeedbackModal({ sessionId, jobRole, onClose }: FeedbackModalProps) {
  const { getAuthHeaders } = useAuthActions();
  const [relevance, setRelevance]         = useState<Relevance | "">("");
  const [helpful, setHelpful]             = useState<boolean | null>(null);
  const [comments, setComments]           = useState("");
  const [submitting, setSubmitting]       = useState(false);
  const [submitted, setSubmitted]         = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!relevance || helpful === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/interview/sessions/${sessionId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        credentials: "include",
        body: JSON.stringify({
          questionRelevance: relevance,
          feedbackHelpful: helpful,
          additionalComments: comments.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit feedback");
      try { localStorage.setItem(`feedback_given_${sessionId}`, "1"); } catch { /* storage unavailable */ }
      setSubmitted(true);
      setTimeout(onClose, 2200);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="flex-1 pr-4">
            <p className="text-sm font-medium text-blue-600 mb-1">Your interviewer says</p>
            <h2 className="text-base font-semibold text-slate-900 leading-snug">
              "We would appreciate your feedback on this interview to help us improve the service."
            </h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="px-6 pb-8 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            <p className="text-base font-semibold text-slate-900">Thank you for your feedback!</p>
            <p className="text-sm text-slate-500">Your response helps us improve the experience.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-5">
            <div className="h-px bg-slate-100" />

            {/* Question relevance */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Were the questions you received for the role of <span className="text-blue-600">{jobRole}</span> relevant?
              </label>
              <div className="relative">
                <select
                  value={relevance}
                  onChange={(e) => setRelevance(e.target.value as Relevance)}
                  required
                  className="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2.5 pr-9 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="" disabled>Select an option…</option>
                  {RELEVANCE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Feedback helpfulness */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Was the feedback helpful?</label>
              <div className="flex gap-3">
                {([true, false] as const).map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => setHelpful(val)}
                    className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      helpful === val
                        ? val
                          ? "bg-emerald-50 border-emerald-400 text-emerald-700"
                          : "bg-red-50 border-red-400 text-red-700"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {val ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>

            {/* Additional comments */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Any other feedback? <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                placeholder="Share any thoughts…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Skip
              </button>
              <Button
                type="submit"
                disabled={!relevance || helpful === null || submitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40"
              >
                {submitting ? "Submitting…" : "Submit Feedback"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  Filter,
  X,
} from "lucide-react";

interface FeedbackRow {
  id: number;
  sessionId: number;
  userId: string | null;
  jobRole: string;
  questionRelevance: string;
  feedbackHelpful: boolean;
  additionalComments: string | null;
  createdAt: string;
}

const RELEVANCE_LABELS: Record<string, string> = {
  highly_relevant: "Highly Relevant",
  somewhat_relevant: "Somewhat Relevant",
  not_relevant: "Not Relevant",
};

const RELEVANCE_COLORS: Record<string, string> = {
  highly_relevant: "bg-emerald-100 text-emerald-800 border-emerald-200",
  somewhat_relevant: "bg-amber-100 text-amber-800 border-amber-200",
  not_relevant: "bg-red-100 text-red-800 border-red-200",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminFeedback() {
  const [, setLocation] = useLocation();
  const [relevanceFilter, setRelevanceFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    relevance: "",
    dateFrom: "",
    dateTo: "",
  });

  const queryParams = new URLSearchParams();
  if (appliedFilters.relevance) queryParams.set("relevance", appliedFilters.relevance);
  if (appliedFilters.dateFrom) queryParams.set("dateFrom", appliedFilters.dateFrom);
  if (appliedFilters.dateTo) queryParams.set("dateTo", appliedFilters.dateTo);
  const queryString = queryParams.toString();

  const { data: rows, isLoading, isError, error } = useQuery<FeedbackRow[]>({
    queryKey: ["admin-feedback", queryString],
    queryFn: async () => {
      const url = `/api/interview/admin/feedback${queryString ? `?${queryString}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 401) throw new Error("UNAUTHORIZED");
      if (res.status === 403) throw new Error("FORBIDDEN");
      if (!res.ok) throw new Error("FETCH_FAILED");
      return res.json();
    },
    retry: false,
  });

  const errorMsg = (error as Error | null)?.message ?? "";
  const isUnauthorized = errorMsg === "UNAUTHORIZED" || errorMsg === "FORBIDDEN";

  function applyFilters() {
    setAppliedFilters({ relevance: relevanceFilter, dateFrom, dateTo });
  }

  function clearFilters() {
    setRelevanceFilter("");
    setDateFrom("");
    setDateTo("");
    setAppliedFilters({ relevance: "", dateFrom: "", dateTo: "" });
  }

  const hasActiveFilters =
    appliedFilters.relevance || appliedFilters.dateFrom || appliedFilters.dateTo;

  const helpfulCount = rows?.filter((r) => r.feedbackHelpful).length ?? 0;
  const notHelpfulCount = rows?.filter((r) => !r.feedbackHelpful).length ?? 0;

  return (
    <div className="min-h-screen bg-white flex flex-col overflow-x-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-48 -right-48 w-[700px] h-[700px] rounded-full bg-blue-500/35 blur-[90px]" />
        <div className="absolute -top-32 -left-48 w-[600px] h-[600px] rounded-full bg-purple-500/30 blur-[80px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[400px] rounded-full bg-indigo-400/20 blur-[110px]" />
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
      />

      <div className="flex-1 p-6 relative z-10">
        <div className="max-w-5xl mx-auto space-y-6">

          <div>
            <h1 className="text-2xl font-bold text-slate-900">Feedback Dashboard</h1>
            <p className="text-slate-500 text-sm">All collected session feedback submissions</p>
          </div>

          {isUnauthorized && (
            <Card className="bg-white border-red-200 shadow-sm">
              <CardContent className="py-12 text-center space-y-2">
                <p className="text-red-600 font-medium">Access denied</p>
                <p className="text-slate-500 text-sm">You don't have permission to view this page.</p>
              </CardContent>
            </Card>
          )}

          {!isUnauthorized && (
            <>
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardContent className="pt-5 pb-4">
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex flex-col gap-1 min-w-[180px]">
                      <label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                        <Filter className="h-3 w-3" /> Relevance
                      </label>
                      <select
                        value={relevanceFilter}
                        onChange={(e) => setRelevanceFilter(e.target.value)}
                        className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      >
                        <option value="">All ratings</option>
                        <option value="highly_relevant">Highly Relevant</option>
                        <option value="somewhat_relevant">Somewhat Relevant</option>
                        <option value="not_relevant">Not Relevant</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> From
                      </label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-slate-600">To</label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={applyFilters}
                      >
                        Apply
                      </Button>
                      {hasActiveFilters && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-200 text-slate-600 hover:bg-slate-50 gap-1"
                          onClick={clearFilters}
                        >
                          <X className="h-3 w-3" /> Clear
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {isLoading && (
                <div className="flex justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              )}

              {isError && !isUnauthorized && (
                <Card className="bg-white border-red-200 shadow-sm">
                  <CardContent className="py-8 text-center text-red-600">
                    Failed to load feedback. Please try again.
                  </CardContent>
                </Card>
              )}

              {!isLoading && !isError && rows && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-white border-slate-200 shadow-sm">
                      <CardContent className="pt-4 pb-4 text-center">
                        <div className="text-2xl font-bold text-slate-900">{rows.length}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Total Submissions</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white border-slate-200 shadow-sm">
                      <CardContent className="pt-4 pb-4 text-center">
                        <div className="text-2xl font-bold text-emerald-600">{helpfulCount}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Found Helpful</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white border-slate-200 shadow-sm">
                      <CardContent className="pt-4 pb-4 text-center">
                        <div className="text-2xl font-bold text-red-500">{notHelpfulCount}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Not Helpful</div>
                      </CardContent>
                    </Card>
                  </div>

                  {rows.length === 0 && (
                    <Card className="bg-white border-slate-200 shadow-sm">
                      <CardContent className="py-16 text-center space-y-3">
                        <MessageSquare className="h-10 w-10 text-slate-300 mx-auto" />
                        <p className="text-slate-500">
                          {hasActiveFilters
                            ? "No feedback matches the current filters."
                            : "No feedback submitted yet."}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {rows.length > 0 && (
                    <div className="space-y-3">
                      {rows.map((row) => (
                        <Card
                          key={row.id}
                          className="bg-white border-slate-200 shadow-sm hover:border-blue-200 hover:shadow-md transition-all"
                        >
                          <CardHeader className="pb-2 pt-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="space-y-0.5">
                                <CardTitle className="text-sm font-semibold text-slate-900">
                                  {row.jobRole}
                                </CardTitle>
                                <p className="text-xs text-slate-400">
                                  Session #{row.sessionId}
                                  {row.userId && (
                                    <> · <span className="font-mono">{row.userId.slice(0, 12)}…</span></>
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${RELEVANCE_COLORS[row.questionRelevance] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}
                                >
                                  {RELEVANCE_LABELS[row.questionRelevance] ?? row.questionRelevance}
                                </span>
                                {row.feedbackHelpful ? (
                                  <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 gap-1 text-xs">
                                    <ThumbsUp className="h-3 w-3" /> Helpful
                                  </Badge>
                                ) : (
                                  <Badge className="bg-red-100 text-red-700 border border-red-200 hover:bg-red-100 gap-1 text-xs">
                                    <ThumbsDown className="h-3 w-3" /> Not Helpful
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pb-4 space-y-2">
                            {row.additionalComments && (
                              <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 italic">
                                "{row.additionalComments}"
                              </p>
                            )}
                            <div className="flex items-center gap-1 text-xs text-slate-400">
                              <Calendar className="h-3 w-3" />
                              {formatDate(row.createdAt)}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      <AppFooter />
    </div>
  );
}

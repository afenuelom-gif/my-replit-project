import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowLeft,
  Loader2,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  Filter,
  X,
  TrendingUp,
  BarChart2,
  Copy,
  Check,
  Download,
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

function toDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function toWeekKey(iso: string): string {
  const d = new Date(iso);
  const day = d.getDay();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day);
  return "Wk of " + sunday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function useChartData(rows: FeedbackRow[] | undefined) {
  return useMemo(() => {
    if (!rows || rows.length === 0) return { dailyData: [], weeklyData: [], roleData: [] };

    const dailyMap = new Map<string, { date: string; helpful: number; notHelpful: number }>();
    const weeklyMap = new Map<string, { date: string; helpful: number; notHelpful: number }>();
    const roleMap = new Map<string, { role: string; helpful: number; notHelpful: number }>();

    const sorted = [...rows].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (const row of sorted) {
      const dateKey = toDateKey(row.createdAt);
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { date: dateKey, helpful: 0, notHelpful: 0 });
      }
      const day = dailyMap.get(dateKey)!;
      if (row.feedbackHelpful) day.helpful += 1;
      else day.notHelpful += 1;

      const weekKey = toWeekKey(row.createdAt);
      if (!weeklyMap.has(weekKey)) {
        weeklyMap.set(weekKey, { date: weekKey, helpful: 0, notHelpful: 0 });
      }
      const week = weeklyMap.get(weekKey)!;
      if (row.feedbackHelpful) week.helpful += 1;
      else week.notHelpful += 1;

      const roleKey = row.jobRole;
      if (!roleMap.has(roleKey)) {
        roleMap.set(roleKey, { role: roleKey, helpful: 0, notHelpful: 0 });
      }
      const role = roleMap.get(roleKey)!;
      if (row.feedbackHelpful) role.helpful += 1;
      else role.notHelpful += 1;
    }

    const roleData = Array.from(roleMap.values()).sort(
      (a, b) => b.notHelpful - a.notHelpful
    );

    return {
      dailyData: Array.from(dailyMap.values()),
      weeklyData: Array.from(weeklyMap.values()),
      roleData,
    };
  }, [rows]);
}

function escapeCsvCell(value: string | null | undefined): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportToCSV(rows: FeedbackRow[]) {
  const headers = ["Date", "Job Role", "Helpful", "Relevance", "Comments"];
  const dataRows = rows.map((row) => [
    escapeCsvCell(formatDate(row.createdAt)),
    escapeCsvCell(row.jobRole),
    escapeCsvCell(row.feedbackHelpful ? "Yes" : "No"),
    escapeCsvCell(RELEVANCE_LABELS[row.questionRelevance] ?? row.questionRelevance),
    escapeCsvCell(row.additionalComments),
  ]);

  const csvContent = [headers.join(","), ...dataRows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `feedback-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AdminFeedback() {
  const [, setLocation] = useLocation();
  const { openSignIn } = useClerk();
  const [relevanceFilter, setRelevanceFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    relevance: "",
    dateFrom: "",
    dateTo: "",
  });
  const [copied, setCopied] = useState(false);

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
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        if (body?.code === "NO_ADMINS_CONFIGURED") {
          throw new Error("NO_ADMINS_CONFIGURED");
        }
        throw new Error("FORBIDDEN");
      }
      if (!res.ok) throw new Error("FETCH_FAILED");
      return res.json();
    },
    retry: false,
  });

  const { data: allRows } = useQuery<FeedbackRow[]>({
    queryKey: ["admin-feedback-total"],
    queryFn: async () => {
      const res = await fetch("/api/interview/admin/feedback", { credentials: "include" });
      if (res.status === 401) throw new Error("UNAUTHORIZED");
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        if (body?.code === "NO_ADMINS_CONFIGURED") throw new Error("NO_ADMINS_CONFIGURED");
        throw new Error("FORBIDDEN");
      }
      if (!res.ok) throw new Error("FETCH_FAILED");
      return res.json();
    },
    enabled: !!(appliedFilters.relevance || appliedFilters.dateFrom || appliedFilters.dateTo),
    retry: false,
  });

  const errorMsg = (error as Error | null)?.message ?? "";
  const isNoAdminsConfigured = errorMsg === "NO_ADMINS_CONFIGURED";
  const isForbidden = errorMsg === "FORBIDDEN";
  const isLoggedOut = errorMsg === "UNAUTHORIZED";
  const isUnauthorized = isNoAdminsConfigured || isLoggedOut || isForbidden;

  const showUserId = isNoAdminsConfigured || isForbidden;

  const { data: meData, isError: isMeError } = useQuery<{ userId: string }>({
    queryKey: ["users-me"],
    queryFn: async () => {
      const res = await fetch("/api/users/me", { credentials: "include" });
      if (!res.ok) throw new Error("FETCH_FAILED");
      return res.json();
    },
    enabled: showUserId,
    retry: false,
  });

  function handleCopy() {
    if (!meData?.userId) return;
    navigator.clipboard.writeText(meData.userId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

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
  const total = rows?.length ?? 0;
  const helpfulPct = total > 0 ? Math.round((helpfulCount / total) * 100) : 0;
  const notHelpfulPct = total > 0 ? Math.round((notHelpfulCount / total) * 100) : 0;

  const [chartZoom, setChartZoom] = useState<"30d" | "90d" | "all">("all");

  const chartRows = useMemo(() => {
    if (!rows || chartZoom === "all") return rows;
    const days = chartZoom === "30d" ? 30 : 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return rows.filter((r) => new Date(r.createdAt) >= cutoff);
  }, [rows, chartZoom]);

  const { dailyData, weeklyData, roleData } = useChartData(chartRows);

  const autoWeekly = dailyData.length > 14;
  const [granularityOverride, setGranularityOverride] = useState<"daily" | "weekly" | null>(() => {
    const saved = localStorage.getItem("feedbackGranularity");
    return saved === "daily" || saved === "weekly" ? saved : null;
  });
  const granularity = granularityOverride ?? (autoWeekly ? "weekly" : "daily");

  function setGranularity(value: "daily" | "weekly") {
    localStorage.setItem("feedbackGranularity", value);
    setGranularityOverride(value);
  }
  const trendData = granularity === "weekly" ? weeklyData : dailyData;

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

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Feedback Dashboard</h1>
              <p className="text-slate-500 text-sm">All collected session feedback submissions</p>
            </div>
            {rows && rows.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="border-slate-200 text-slate-700 hover:bg-slate-50 gap-2"
                onClick={() => exportToCSV(rows)}
              >
                <Download className="h-4 w-4" />
                {hasActiveFilters && allRows != null
                  ? `Export CSV (${rows.length} of ${allRows.length} ${allRows.length === 1 ? "row" : "rows"})`
                  : `Export CSV (${rows.length} ${rows.length === 1 ? "row" : "rows"})`}
              </Button>
            )}
          </div>

          {isUnauthorized && (
            <Card className="bg-white border-red-200 shadow-sm">
              <CardContent className="py-12 text-center space-y-3">
                <p className="text-red-600 font-semibold text-lg">Access Denied</p>
                {isNoAdminsConfigured ? (
                  <>
                    <p className="text-slate-600 text-sm max-w-md mx-auto">
                      No admin users have been configured yet. To grant yourself access, set the{" "}
                      <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono text-xs">ADMIN_USER_IDS</code>{" "}
                      environment secret in your Replit project settings.
                    </p>
                    {meData?.userId ? (
                      <div className="max-w-sm mx-auto space-y-2 pt-1">
                        <p className="text-slate-500 text-xs font-medium">Your Clerk user ID:</p>
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                          <code className="flex-1 text-left text-slate-800 font-mono text-sm break-all">{meData.userId}</code>
                          <button
                            onClick={handleCopy}
                            className="flex-shrink-0 text-slate-400 hover:text-slate-700 transition-colors"
                            title="Copy to clipboard"
                          >
                            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                          </button>
                        </div>
                        <p className="text-slate-400 text-xs">
                          Copy this ID and paste it into the{" "}
                          <code className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded font-mono">ADMIN_USER_IDS</code>{" "}
                          secret to grant yourself access.
                        </p>
                      </div>
                    ) : isMeError ? (
                      <p className="text-slate-400 text-xs max-w-sm mx-auto pt-1">
                        Couldn't load your user ID — try refreshing, or visit{" "}
                        <span className="font-mono">/api/users/me</span> while signed in.
                      </p>
                    ) : null}
                  </>
                ) : isForbidden ? (
                  <>
                    <p className="text-slate-600 text-sm max-w-md mx-auto">
                      Your account does not have admin access. If you should have access, ask the project owner to add your user ID to the{" "}
                      <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono text-xs">ADMIN_USER_IDS</code>{" "}
                      environment secret.
                    </p>
                    {meData?.userId ? (
                      <div className="max-w-sm mx-auto space-y-2 pt-1">
                        <p className="text-slate-500 text-xs font-medium">Your Clerk user ID:</p>
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                          <code className="flex-1 text-left text-slate-800 font-mono text-sm break-all">{meData.userId}</code>
                          <button
                            onClick={handleCopy}
                            className="flex-shrink-0 text-slate-400 hover:text-slate-700 transition-colors"
                            title="Copy to clipboard"
                          >
                            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                          </button>
                        </div>
                        <p className="text-slate-400 text-xs">
                          Share this ID with the project owner to request access.
                        </p>
                      </div>
                    ) : isMeError ? (
                      <p className="text-slate-400 text-xs max-w-sm mx-auto pt-1">
                        Couldn't load your user ID — try refreshing, or visit{" "}
                        <span className="font-mono">/api/users/me</span> while signed in.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <div className="space-y-4">
                    <p className="text-slate-600 text-sm max-w-md mx-auto">
                      You must be signed in to access this page.
                    </p>
                    <Button
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() =>
                        openSignIn({ redirectUrl: window.location.href })
                      }
                    >
                      Sign In
                    </Button>
                  </div>
                )}
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
                  {/* ── Summary stats ── */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                        {total > 0 && (
                          <div className="text-xs text-emerald-500 font-medium mt-0.5">{helpfulPct}%</div>
                        )}
                      </CardContent>
                    </Card>
                    <Card className="bg-white border-slate-200 shadow-sm">
                      <CardContent className="pt-4 pb-4 text-center">
                        <div className="text-2xl font-bold text-red-500">{notHelpfulCount}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Not Helpful</div>
                        {total > 0 && (
                          <div className="text-xs text-red-400 font-medium mt-0.5">{notHelpfulPct}%</div>
                        )}
                      </CardContent>
                    </Card>
                    <Card className="bg-white border-slate-200 shadow-sm">
                      <CardContent className="pt-4 pb-4 text-center">
                        <div className="flex items-end justify-center gap-1 mt-1 mb-0.5">
                          <div
                            className="rounded-sm bg-emerald-400"
                            style={{ width: 20, height: total > 0 ? Math.max(8, (helpfulPct / 100) * 36) : 8 }}
                          />
                          <div
                            className="rounded-sm bg-red-400"
                            style={{ width: 20, height: total > 0 ? Math.max(8, (notHelpfulPct / 100) * 36) : 8 }}
                          />
                        </div>
                        <div className="text-xs text-slate-500 mt-1">Helpful Split</div>
                        {total > 0 && (
                          <div className="text-xs text-slate-400 mt-0.5">{helpfulPct}% / {notHelpfulPct}%</div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* ── Charts (only when there's data) ── */}
                  {rows.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Submissions over time */}
                      <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader className="pb-2 pt-4">
                          <div className="flex items-center justify-between gap-2">
                            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-blue-500" />
                              Submissions Over Time
                              {autoWeekly && granularityOverride === null && (
                                <span className="text-xs font-normal text-slate-400">(weekly)</span>
                              )}
                            </CardTitle>
                            <div className="flex items-center gap-2">
                            <div className="flex items-center rounded-md border border-slate-200 overflow-hidden text-xs font-medium">
                              {(["30d", "90d", "all"] as const).map((z, i) => (
                                <button
                                  key={z}
                                  onClick={() => setChartZoom(z)}
                                  className={`px-2.5 py-1 transition-colors ${i > 0 ? "border-l border-slate-200" : ""} ${chartZoom === z ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}
                                >
                                  {z === "30d" ? "30d" : z === "90d" ? "90d" : "All"}
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center rounded-md border border-slate-200 overflow-hidden text-xs font-medium">
                              <button
                                onClick={() => setGranularity("daily")}
                                className={`px-2.5 py-1 transition-colors ${granularity === "daily" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}
                              >
                                Daily
                              </button>
                              <button
                                onClick={() => setGranularity("weekly")}
                                className={`px-2.5 py-1 transition-colors border-l border-slate-200 ${granularity === "weekly" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}
                              >
                                Weekly
                              </button>
                            </div>
                          </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pb-4">
                          {trendData.length === 1 ? (
                            <div className="flex flex-col items-center justify-center h-[200px] gap-2">
                              <div className="flex gap-6 text-sm">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                                  <span className="text-slate-600">{trendData[0].helpful} helpful</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full bg-red-400" />
                                  <span className="text-slate-600">{trendData[0].notHelpful} not helpful</span>
                                </div>
                              </div>
                              <p className="text-xs text-slate-400">{trendData[0].date}</p>
                            </div>
                          ) : (
                            <ResponsiveContainer width="100%" height={200}>
                              <LineChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis
                                  dataKey="date"
                                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                                  tickLine={false}
                                  axisLine={false}
                                />
                                <YAxis
                                  allowDecimals={false}
                                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                                  tickLine={false}
                                  axisLine={false}
                                />
                                <Tooltip
                                  contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e2e8f0" }}
                                  labelStyle={{ color: "#475569", fontWeight: 600 }}
                                />
                                <Legend
                                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                                  iconType="circle"
                                  iconSize={8}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="helpful"
                                  name="Helpful"
                                  stroke="#34d399"
                                  strokeWidth={2}
                                  dot={{ r: 3, fill: "#34d399" }}
                                  activeDot={{ r: 5 }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="notHelpful"
                                  name="Not Helpful"
                                  stroke="#f87171"
                                  strokeWidth={2}
                                  dot={{ r: 3, fill: "#f87171" }}
                                  activeDot={{ r: 5 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          )}
                        </CardContent>
                      </Card>

                      {/* Breakdown by job role */}
                      <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader className="pb-2 pt-4">
                          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <BarChart2 className="h-4 w-4 text-purple-500" />
                            Feedback by Job Role
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4">
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart
                              data={roleData}
                              layout="vertical"
                              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                              <XAxis
                                type="number"
                                allowDecimals={false}
                                tick={{ fontSize: 11, fill: "#94a3b8" }}
                                tickLine={false}
                                axisLine={false}
                              />
                              <YAxis
                                type="category"
                                dataKey="role"
                                width={110}
                                tick={{ fontSize: 11, fill: "#64748b" }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(v: string) =>
                                  v.length > 16 ? v.slice(0, 14) + "…" : v
                                }
                              />
                              <Tooltip
                                contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e2e8f0" }}
                                labelStyle={{ color: "#475569", fontWeight: 600 }}
                              />
                              <Legend
                                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                                iconType="circle"
                                iconSize={8}
                              />
                              <Bar dataKey="helpful" name="Helpful" fill="#34d399" radius={[0, 3, 3, 0]} barSize={10} />
                              <Bar dataKey="notHelpful" name="Not Helpful" fill="#f87171" radius={[0, 3, 3, 0]} barSize={10} />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>
                  )}

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

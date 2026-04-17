import { useLocation } from "wouter";
import AppFooter from "@/components/AppFooter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Trophy, Calendar, Briefcase, ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

interface SessionWithReport {
  id: number;
  userId: string | null;
  jobRole: string;
  jobDescription: string | null;
  durationMinutes: number;
  status: string;
  createdAt: string;
  report: {
    overallScore: number;
    communicationScore: number;
    technicalScore: number;
    confidenceScore: number;
    postureScore: number;
  } | null;
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
}

function scoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-50";
  if (score >= 60) return "bg-amber-50";
  return "bg-red-50";
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "completed") return "default";
  if (status === "cancelled") return "destructive";
  return "secondary";
}

export default function History() {
  const [, setLocation] = useLocation();

  const { data: sessions, isLoading, isError } = useQuery<SessionWithReport[]>({
    queryKey: ["user-sessions"],
    queryFn: async () => {
      const res = await fetch("/api/users/me/sessions", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json();
    },
  });

  return (
    <div className="min-h-screen bg-white flex flex-col overflow-x-hidden relative">

      {/* Gradient blobs — matches home page */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-48 -right-48 w-[700px] h-[700px] rounded-full bg-blue-500/35 blur-[90px]" />
        <div className="absolute -top-32 -left-48 w-[600px] h-[600px] rounded-full bg-purple-500/30 blur-[80px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[400px] rounded-full bg-indigo-400/20 blur-[110px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] rounded-full bg-blue-500/12 blur-[110px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[400px] rounded-full bg-purple-500/10 blur-[110px]" />
      </div>

      {/* Top gradient wash */}
      <div className="absolute top-0 left-0 right-0 h-[70vh] bg-gradient-to-b from-blue-100/90 via-purple-50/40 to-transparent pointer-events-none" />

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
        <div className="max-w-4xl mx-auto space-y-6">

          <div>
            <h1 className="text-2xl font-bold text-slate-900">Interview History</h1>
            <p className="text-slate-500 text-sm">Your past interview sessions</p>
          </div>

          {isLoading && (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          )}

          {isError && (
            <Card className="bg-white border-red-200 shadow-sm">
              <CardContent className="py-8 text-center text-red-600">
                Failed to load sessions. Please try again.
              </CardContent>
            </Card>
          )}

          {!isLoading && !isError && sessions && sessions.length === 0 && (
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardContent className="py-16 text-center space-y-4">
                <Briefcase className="h-12 w-12 text-slate-300 mx-auto" />
                <p className="text-slate-500">You haven't completed any interviews yet.</p>
                <Button onClick={() => setLocation("/")} variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50">
                  Start Your First Interview
                </Button>
              </CardContent>
            </Card>
          )}

          {!isLoading && !isError && sessions && sessions.length > 0 && (
            <div className="space-y-4">
              {sessions.map((session) => (
                <Card
                  key={session.id}
                  className="bg-white border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => {
                    if (session.report && session.status === "completed") {
                      setLocation(`/report/${session.id}`);
                    }
                  }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Briefcase className="h-4 w-4 text-blue-500 shrink-0" />
                        <CardTitle className="text-base truncate text-slate-900">{session.jobRole}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={statusBadgeVariant(session.status)} className="capitalize">
                          {session.status}
                        </Badge>
                        {session.report && session.status === "completed" && (
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        {new Date(session.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="hidden sm:inline">·</span>
                      <span>{session.durationMinutes} min session</span>
                    </div>

                    {session.report ? (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {[
                          { label: "Overall", value: session.report.overallScore },
                          { label: "Communication", value: session.report.communicationScore },
                          { label: "Technical", value: session.report.technicalScore },
                          { label: "Confidence", value: session.report.confidenceScore },
                          { label: "Posture", value: session.report.postureScore },
                        ].map(({ label, value }) => (
                          <div key={label} className={`rounded-lg p-2 text-center ${scoreBg(value)}`}>
                            <div className={`text-lg font-bold ${scoreColor(value)}`}>{value}</div>
                            <div className="text-[10px] text-slate-500">{label}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Trophy className="h-3.5 w-3.5" />
                        <span>No report generated</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      <AppFooter />
    </div>
  );
}

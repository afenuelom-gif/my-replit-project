import { useLocation } from "wouter";
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
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  return "text-red-400";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  return "Needs Work";
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
      const res = await fetch("/api/users/me/sessions", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json();
    },
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader
        right={
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-white gap-2" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Button>
        }
      />
      <div className="flex-1 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Interview History</h1>
          <p className="text-muted-foreground text-sm">Your past interview sessions</p>
        </div>

        {isLoading && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {isError && (
          <Card className="bg-card/50 border-red-500/30">
            <CardContent className="py-8 text-center text-red-400">
              Failed to load sessions. Please try again.
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && sessions && sessions.length === 0 && (
          <Card className="bg-card/50 border-white/10">
            <CardContent className="py-16 text-center space-y-4">
              <Briefcase className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">You haven't completed any interviews yet.</p>
              <Button onClick={() => setLocation("/")} variant="outline">
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
                className="bg-card/50 border-white/10 hover:border-primary/40 transition-all cursor-pointer"
                onClick={() => {
                  if (session.report && session.status === "completed") {
                    setLocation(`/report/${session.id}`);
                  }
                }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Briefcase className="h-4 w-4 text-primary shrink-0" />
                      <CardTitle className="text-base truncate">{session.jobRole}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={statusBadgeVariant(session.status)} className="capitalize">
                        {session.status}
                      </Badge>
                      {session.report && session.status === "completed" && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{new Date(session.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}</span>
                    <span>·</span>
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
                        <div key={label} className="bg-background/40 rounded-lg p-2 text-center">
                          <div className={`text-lg font-bold ${scoreColor(value)}`}>{value}</div>
                          <div className="text-[10px] text-muted-foreground">{label}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
    </div>
  );
}

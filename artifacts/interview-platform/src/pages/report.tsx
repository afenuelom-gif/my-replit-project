import React from "react";
import { useParams, Link } from "wouter";
import { useGetReport, getGetReportQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronLeft, Target, MessageSquare, Code, Lightbulb, User, Camera } from "lucide-react";

export default function Report() {
  const params = useParams();
  const sessionId = parseInt(params.sessionId || "0");

  const { data: report, isLoading } = useGetReport(sessionId, {
    query: { enabled: !!sessionId, queryKey: getGetReportQueryKey(sessionId) }
  });

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-white">Analyzing performance...</div>;
  }

  if (!report) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-white">Report not found.</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 lg:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/">
              <Button variant="ghost" size="sm" className="mb-4 text-muted-foreground hover:text-white">
                <ChevronLeft className="w-4 h-4 mr-2" /> Back to Dashboard
              </Button>
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-white">Interview Performance Report</h1>
            <p className="text-muted-foreground mt-1">Generated on {new Date(report.generatedAt).toLocaleString()}</p>
          </div>
          
          <div className="flex items-center gap-4 bg-card border border-white/10 rounded-2xl p-6">
            <div className="text-right">
              <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Overall Score</div>
              <div className="text-4xl font-bold text-primary">{report.overallScore}<span className="text-xl text-muted-foreground">/100</span></div>
            </div>
            <div className="w-24 h-24 rounded-full border-8 border-primary/20 flex items-center justify-center relative">
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  className="text-primary"
                  strokeWidth="8"
                  stroke="currentColor"
                  fill="transparent"
                  r="38"
                  cx="48"
                  cy="48"
                  strokeDasharray={`${report.overallScore * 2.38} 240`}
                />
              </svg>
              <Target className="w-8 h-8 text-primary" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Summary & Scores */}
          <div className="lg:col-span-1 space-y-8">
            <Card className="bg-card border-white/10">
              <CardHeader>
                <CardTitle className="text-lg">Executive Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">{report.summary}</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-white/10">
              <CardHeader>
                <CardTitle className="text-lg">Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-blue-400"/> Communication</span>
                    <span className="font-mono">{report.communicationScore}%</span>
                  </div>
                  <Progress value={report.communicationScore} className="h-2 bg-white/5" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2"><Code className="w-4 h-4 text-green-400"/> Technical</span>
                    <span className="font-mono">{report.technicalScore}%</span>
                  </div>
                  <Progress value={report.technicalScore} className="h-2 bg-white/5" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2"><Lightbulb className="w-4 h-4 text-yellow-400"/> Confidence</span>
                    <span className="font-mono">{report.confidenceScore}%</span>
                  </div>
                  <Progress value={report.confidenceScore} className="h-2 bg-white/5" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2"><User className="w-4 h-4 text-purple-400"/> Posture</span>
                    <span className="font-mono">{report.postureScore}%</span>
                  </div>
                  <Progress value={report.postureScore} className="h-2 bg-white/5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-primary/10 border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg text-primary">Top Areas for Improvement</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {report.suggestions.map((s, i) => (
                    <li key={i} className="flex gap-3 text-sm text-primary-foreground">
                      <div className="min-w-[20px] pt-0.5"><CheckCircle2 className="w-4 h-4 text-primary" /></div>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            {report.postureNotes && report.postureNotes.length > 0 && (
              <Card className="bg-card border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Camera className="w-5 h-5 text-purple-400" />
                    Posture & Presence Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {report.postureNotes.map((note: string, i: number) => (
                      <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                        <div className="min-w-[20px] pt-0.5"><User className="w-4 h-4 text-purple-400" /></div>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Q&A Details */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-semibold text-white mb-4">Question Analysis</h2>
            {report.answerFeedback.map((fb, idx) => (
              <Card key={fb.questionId} className="bg-card border-white/10 overflow-hidden">
                <div className="p-1 bg-white/5 border-b border-white/10 flex items-center justify-between px-6 py-3">
                  <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Question {idx + 1}</span>
                  <span className={`px-2 py-1 rounded text-xs font-mono font-bold ${fb.score >= 80 ? 'bg-green-500/20 text-green-400' : fb.score >= 60 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                    Score: {fb.score}/100
                  </span>
                </div>
                <CardContent className="p-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-white mb-2">{fb.questionText}</h3>
                    <div className="p-4 bg-black/40 rounded-lg border border-white/5 text-muted-foreground text-sm italic">
                      "{fb.answerText || "No answer recorded."}"
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-white">Feedback</h4>
                    <p className="text-sm text-muted-foreground">{fb.feedback}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                    <div>
                      <h4 className="text-xs font-semibold text-green-400 mb-2 uppercase tracking-wider">Strengths</h4>
                      <ul className="space-y-1">
                        {fb.strengths.map((s, i) => <li key={i} className="text-sm text-muted-foreground">• {s}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-yellow-400 mb-2 uppercase tracking-wider">To Improve</h4>
                      <ul className="space-y-1">
                        {fb.improvements.map((s, i) => <li key={i} className="text-sm text-muted-foreground">• {s}</li>)}
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
  );
}

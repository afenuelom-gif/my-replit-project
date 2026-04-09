import React, { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useCreateSession } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Briefcase, FileText, Upload, X } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const createSession = useCreateSession();
  
  const [jobRole, setJobRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setJobDescription(text);
      setUploadedFileName(file.name);
    };
    reader.readAsText(file);
  };

  const clearFile = () => {
    setUploadedFileName(null);
    setJobDescription("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobRole) return;

    try {
      const session = await createSession.mutateAsync({
        data: {
          jobRole,
          jobDescription: jobDescription || undefined,
        }
      });
      setLocation(`/interview/${session.id}`);
    } catch (error) {
      console.error("Failed to start session:", error);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
      
      <div className="max-w-2xl w-full z-10 space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
            AI Job Interview Simulator
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Prepare for your next career move with our immersive, AI-driven interview environment. Experience real-world pressure in a simulated setting.
          </p>
        </div>

        <Card className="bg-card/50 backdrop-blur-sm border-white/10">
          <CardHeader>
            <CardTitle className="text-xl">Session Configuration</CardTitle>
            <CardDescription>Define the parameters for your interview simulation.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleStart} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="jobRole" className="text-sm font-medium text-white flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" />
                  Target Job Role <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="jobRole"
                  placeholder="e.g. Senior Frontend Engineer"
                  value={jobRole}
                  onChange={(e) => setJobRole(e.target.value)}
                  className="bg-black/50 border-white/10 text-white placeholder:text-muted-foreground focus-visible:ring-primary"
                  required
                  data-testid="input-jobRole"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="jobDescription" className="text-sm font-medium text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Job Description (Optional)
                </Label>
                
                <div className="flex gap-2 mb-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-white/10 text-zinc-300 hover:text-white hover:bg-white/10"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload .txt or .pdf
                  </Button>
                  {uploadedFileName && (
                    <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-md">
                      <span className="truncate max-w-[180px]">{uploadedFileName}</span>
                      <button type="button" onClick={clearFile} className="text-primary hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={handleFileUpload}
                  data-testid="input-jobDescriptionFile"
                />
                
                <Textarea
                  id="jobDescription"
                  placeholder="...or paste the job description here to tailor the interview questions"
                  value={jobDescription}
                  onChange={(e) => {
                    setJobDescription(e.target.value);
                    setUploadedFileName(null);
                  }}
                  className="min-h-[120px] bg-black/50 border-white/10 text-white placeholder:text-muted-foreground focus-visible:ring-primary resize-none"
                  data-testid="input-jobDescription"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold transition-all hover:scale-[1.02]"
                disabled={!jobRole || createSession.isPending}
                data-testid="button-start-interview"
              >
                {createSession.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : null}
                {createSession.isPending ? "Initializing..." : "Start Interview Simulation"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-4 text-center text-sm text-muted-foreground">
          <div className="space-y-1">
            <div className="text-2xl font-bold text-white">30-45</div>
            <div>Minutes</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-white">2-3</div>
            <div>AI Interviewers</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-white">AI</div>
            <div>Performance Report</div>
          </div>
        </div>
      </div>
    </div>
  );
}

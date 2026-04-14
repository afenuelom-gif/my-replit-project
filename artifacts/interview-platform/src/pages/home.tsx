import React, { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useCreateSession } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Briefcase, FileText, Upload, X } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

interface HomeProps {
  authMenu?: React.ReactNode;
}

export default function Home({ authMenu }: HomeProps) {
  const [, setLocation] = useLocation();
  const createSession = useCreateSession();

  const [jobRole, setJobRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

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

  const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setResumeText(text);
      setResumeFileName(file.name);
    };
    reader.readAsText(file);
  };

  const uploadAccept = ".txt,.doc,.docx,.pdf";

  const clearResume = () => {
    setResumeText("");
    setResumeFileName(null);
    if (resumeInputRef.current) resumeInputRef.current.value = "";
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobRole) return;

    try {
      const session = await createSession.mutateAsync({
        data: {
          jobRole,
          jobDescription: jobDescription || undefined,
          resumeText: resumeText || undefined,
          durationMinutes,
        },
      });
      setLocation(`/interview/${session.id}`);
    } catch (error) {
      console.error("Failed to start session:", error);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-background to-background pointer-events-none" />

      <AppHeader right={authMenu} />

      <div className="flex-1 flex flex-col items-center justify-center p-6 z-10">
        <div className="max-w-2xl w-full space-y-8">
          {/* Hero */}
          <div className="text-center space-y-5">
            <div className="flex justify-center">
              <img
                src="/logo.png"
                alt="IntervYou AI"
                className="h-24 w-24 rounded-3xl shadow-2xl shadow-blue-500/20 object-cover"
              />
            </div>
            <div className="space-y-2">
              <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-none">
                <span className="text-white">IntervYou</span>
                <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent ml-2">
                  AI
                </span>
              </h1>
              <p className="text-lg font-medium text-blue-300/80 tracking-wide uppercase text-sm">
                Smarter Interview Practice
              </p>
            </div>
            <p className="text-base text-muted-foreground max-w-lg mx-auto">
              Prepare for your next career move with immersive, AI-driven interview simulations. Experience real-world pressure in a safe, supportive environment.
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
                  <Label className="text-sm font-medium text-white flex items-center gap-2">
                    Interview Duration
                  </Label>
                  <div className="flex gap-2">
                    {[2, 30, 35, 40, 45].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setDurationMinutes(mins)}
                        className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                          durationMinutes === mins
                            ? "border-primary bg-primary/20 text-primary"
                            : "border-white/10 text-zinc-400 hover:border-white/30 hover:text-white"
                        }`}
                        data-testid={`button-duration-${mins}`}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      Job Description (Optional)
                    </Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-white/10 text-zinc-300 hover:text-white hover:bg-white/10"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload job description
                      </Button>
                      {uploadedFileName && (
                        <button type="button" onClick={clearFile} className="text-primary hover:text-white">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={uploadAccept}
                      className="hidden"
                      onChange={handleFileUpload}
                      data-testid="input-jobDescriptionFile"
                    />
                    <div className="text-xs text-zinc-500 truncate">
                      {uploadedFileName ? uploadedFileName : "Upload .doc, .docx, .pdf, or .txt"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-white flex items-center gap-2">
                      <Upload className="w-4 h-4 text-primary" />
                      Resume (Optional)
                    </Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-white/10 text-zinc-300 hover:text-white hover:bg-white/10"
                        onClick={() => resumeInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload resume
                      </Button>
                      {resumeFileName && (
                        <button type="button" onClick={clearResume} className="text-primary hover:text-white">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <input
                      ref={resumeInputRef}
                      type="file"
                      accept={uploadAccept}
                      className="hidden"
                      onChange={handleResumeUpload}
                      data-testid="input-resumeFile"
                    />
                    <div className="text-xs text-zinc-500 truncate">
                      {resumeFileName ? resumeFileName : "Upload .doc, .docx, .pdf, or .txt"}
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold transition-all hover:scale-[1.02] bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0"
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
    </div>
  );
}

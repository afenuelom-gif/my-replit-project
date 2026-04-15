import React, { useState, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useCreateSession } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Briefcase, FileText, Upload, X } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ProductPreview } from "@/components/ProductPreview";

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
  const [jdUploadError, setJdUploadError] = useState<string | null>(null);
  const [resumeUploadError, setResumeUploadError] = useState<string | null>(null);
  const [jdParsing, setJdParsing] = useState(false);
  const [resumeParsing, setResumeParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  const parseDocument = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/interview/parse-document", { method: "POST", body: formData });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to parse file");
    return json.text as string;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setJdUploadError(null);
    setJdParsing(true);
    try {
      const text = await parseDocument(file);
      setJobDescription(text);
      setUploadedFileName(file.name);
    } catch (err: unknown) {
      setJdUploadError(err instanceof Error ? err.message : "Failed to read file");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setJdParsing(false);
    }
  };

  const clearFile = () => {
    setUploadedFileName(null);
    setJobDescription("");
    setJdUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeUploadError(null);
    setResumeParsing(true);
    try {
      const text = await parseDocument(file);
      setResumeText(text);
      setResumeFileName(file.name);
    } catch (err: unknown) {
      setResumeUploadError(err instanceof Error ? err.message : "Failed to read file");
      if (resumeInputRef.current) resumeInputRef.current.value = "";
    } finally {
      setResumeParsing(false);
    }
  };

  const uploadAccept = ".txt,.doc,.docx,.pdf";

  const clearResume = () => {
    setResumeText("");
    setResumeFileName(null);
    setResumeUploadError(null);
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
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/25 via-background to-background pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-purple-900/10 rounded-full blur-3xl pointer-events-none" />

      <AppHeader right={authMenu} />

      {/* ── Hero Section ── */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-16 pb-20">
        <div className="flex justify-center mb-6">
          <img
            src="/logo.png"
            alt="IntervYou AI"
            className="h-20 w-20 rounded-3xl shadow-2xl shadow-blue-500/20 object-cover"
          />
        </div>

        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary font-medium mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Free trial — no credit card required
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight max-w-3xl">
          <span className="text-white">Practice interviews.</span>
          <br />
          <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Land the job.
          </span>
        </h1>

        <p className="mt-5 text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed">
          Sit down with 2–3 AI interviewers who ask real questions based on your role and background. Get a detailed performance report when you're done.
        </p>

        <div className="mt-10 w-full">
          <ProductPreview />
        </div>

        <a href="#configure" className="mt-10 w-full max-w-sm mx-auto block text-center py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm transition-all hover:scale-[1.02] shadow-lg shadow-blue-500/20">
          Start your free session
        </a>
        <p className="mt-3 text-xs text-zinc-600">No credit card required. First session free.</p>
      </section>

      {/* ── Setup Form ── */}
      <div id="configure" className="flex flex-col items-center px-6 pb-20 z-10">
        <div className="max-w-2xl w-full space-y-8">
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
                        disabled={jdParsing}
                        className="border-white/10 text-zinc-300 hover:text-white hover:bg-white/10"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {jdParsing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        {jdParsing ? "Reading…" : "Upload job description"}
                      </Button>
                      {uploadedFileName && !jdParsing && (
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
                    {jdUploadError ? (
                      <div className="text-xs text-red-400">{jdUploadError}</div>
                    ) : (
                      <div className="text-xs text-zinc-500 truncate">
                        {uploadedFileName ? uploadedFileName : "PDF, DOCX, DOC or TXT"}
                      </div>
                    )}
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
                        disabled={resumeParsing}
                        className="border-white/10 text-zinc-300 hover:text-white hover:bg-white/10"
                        onClick={() => resumeInputRef.current?.click()}
                      >
                        {resumeParsing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        {resumeParsing ? "Reading…" : "Upload resume"}
                      </Button>
                      {resumeFileName && !resumeParsing && (
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
                    {resumeUploadError ? (
                      <div className="text-xs text-red-400">{resumeUploadError}</div>
                    ) : (
                      <div className="text-xs text-zinc-500 truncate">
                        {resumeFileName ? resumeFileName : "PDF, DOCX, DOC or TXT"}
                      </div>
                    )}
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

          <p className="text-center text-sm text-zinc-500">
            First session is free — no credit card required.{" "}
            <Link href="/pricing" className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">
              See plans
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

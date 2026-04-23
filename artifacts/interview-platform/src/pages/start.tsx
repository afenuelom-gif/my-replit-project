import React, { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useCreateSession } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Briefcase, FileText, Upload, X, LogIn, UserPlus } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import { useAuthActions } from "@/contexts/auth-actions";

interface StartProps {
  authMenu?: React.ReactNode;
  authMobileMenu?: React.ReactNode;
  showAuthPrompt?: boolean;
}

function AuthPromptCard() {
  const { signIn, signUp } = useAuthActions();
  const redirectUrl = window.location.href;

  return (
    <Card className="bg-white shadow-sm border-slate-200">
      <CardContent className="py-10 text-center space-y-5">
        <div className="space-y-2">
          <p className="text-lg font-semibold text-slate-900">Sign in to start your interview</p>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            An account is required to run and save your interview session. Sign in or create a free account to continue.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            className="flex-1 sm:flex-none sm:min-w-[140px] bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0 gap-2"
            onClick={() => signIn({ redirectUrl })}
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </Button>
          <Button
            variant="outline"
            className="flex-1 sm:flex-none sm:min-w-[140px] border-slate-300 text-slate-700 hover:bg-slate-50 gap-2"
            onClick={() => signUp({ redirectUrl })}
          >
            <UserPlus className="w-4 h-4" />
            Create Account
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Start({ authMenu, authMobileMenu, showAuthPrompt }: StartProps) {
  const [, setLocation] = useLocation();
  const createSession = useCreateSession();

  const [jobRole, setJobRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [noCreditsError, setNoCreditsError] = useState<string | null>(null);
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

  const uploadAccept = ".txt,.doc,.docx,.pdf";

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

  const clearResume = () => {
    setResumeText("");
    setResumeFileName(null);
    setResumeUploadError(null);
    if (resumeInputRef.current) resumeInputRef.current.value = "";
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobRole) return;
    setNoCreditsError(null);
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
    } catch (error: unknown) {
      const apiError = error as { status?: number; data?: { code?: string; error?: string } };
      if (apiError.status === 403 && apiError.data?.code === "NO_CREDITS") {
        setNoCreditsError(apiError.data.error ?? "You have no sessions remaining.");
      } else {
        console.error("Failed to start session:", error);
      }
    }
  };

  return (
    <div className="min-h-screen w-full bg-white flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-blue-500/35 blur-[80px]" />
        <div className="absolute -top-16 -left-32 w-[400px] h-[400px] rounded-full bg-purple-500/30 blur-[70px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] rounded-full bg-indigo-400/20 blur-[70px]" />
      </div>
      <div className="absolute top-0 left-0 right-0 h-[60vh] bg-gradient-to-b from-blue-100/90 via-purple-50/40 to-transparent pointer-events-none" />

      <AppHeader right={authMenu} mobileMenuExtra={authMobileMenu} />

      <div className="flex-1 flex flex-col items-center justify-center p-6 z-10">
        <div className="max-w-2xl w-full space-y-8">

          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Configure your session</h1>
            <p className="text-slate-500 text-sm">Tell us the role and we'll handle the rest.</p>
          </div>

          {showAuthPrompt ? <AuthPromptCard /> : <Card className="bg-white shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-xl">Session Configuration</CardTitle>
              <CardDescription>Define the parameters for your interview simulation.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleStart} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="jobRole" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-primary" />
                    Target Job Role <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="jobRole"
                    placeholder="e.g. Senior Frontend Engineer"
                    value={jobRole}
                    onChange={(e) => setJobRole(e.target.value)}
                    className="focus-visible:ring-primary"
                    required
                    data-testid="input-jobRole"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
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
                            : "border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-900"
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
                    <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      Job Description (Optional)
                    </Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={jdParsing}
                        className="border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {jdParsing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        {jdParsing ? "Reading…" : "Upload job description"}
                      </Button>
                      {uploadedFileName && !jdParsing && (
                        <button type="button" onClick={clearFile} className="text-primary hover:text-slate-900">
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
                      <div className="text-xs text-slate-400 truncate">
                        {uploadedFileName ? uploadedFileName : "PDF, DOCX, DOC or TXT"}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <Upload className="w-4 h-4 text-primary" />
                      Resume (Optional)
                    </Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={resumeParsing}
                        className="border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                        onClick={() => resumeInputRef.current?.click()}
                      >
                        {resumeParsing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        {resumeParsing ? "Reading…" : "Upload resume"}
                      </Button>
                      {resumeFileName && !resumeParsing && (
                        <button type="button" onClick={clearResume} className="text-primary hover:text-slate-900">
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
                      <div className="text-xs text-slate-400 truncate">
                        {resumeFileName ? resumeFileName : "PDF, DOCX, DOC or TXT"}
                      </div>
                    )}
                  </div>
                </div>

                {noCreditsError && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-3">
                    <div className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                      <span className="text-red-600 text-xs font-black">!</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-red-800">{noCreditsError}</p>
                      <a href="/pricing" className="text-xs text-red-600 underline underline-offset-2 hover:text-red-700 font-medium">
                        View plans &amp; upgrade →
                      </a>
                    </div>
                  </div>
                )}

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
          </Card>}

          <div className="grid grid-cols-3 gap-4 text-center text-sm text-slate-500">
            <div className="space-y-1">
              <div className="text-2xl font-bold text-slate-900">30-45</div>
              <div>Minutes</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-slate-900">2-3</div>
              <div>AI Interviewers</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-slate-900">AI</div>
              <div>Performance Report</div>
            </div>
          </div>
        </div>
      </div>
      <AppFooter />
    </div>
  );
}

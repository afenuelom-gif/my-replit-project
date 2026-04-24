import React, { useState, useEffect, useRef, useCallback, createRef } from "react";
import { useLocation, useParams } from "wouter";
import { 
  useGetSession, 
  getGetSessionQueryKey,
  useCompleteSession,
  useGetNextQuestion,
  useTranscribeAnswer,
  useAnalyzePosture
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useAuthActions } from "@/contexts/auth-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Mic, Video, VideoOff, SquareSquare, Activity, Loader2, MessagesSquare, XCircle, Play, Zap, CheckCircle2, Trophy } from "lucide-react";
import InterviewerCard, { type InterviewerCardHandle } from "@/components/InterviewerCard";
import { AuthPrompt } from "@/components/AuthPrompt";

export default function Interview() {
  const params = useParams();
  const sessionId = parseInt(params.sessionId || "0");
  const [, setLocation] = useLocation();
  const { getAuthHeaders } = useAuthActions();
  const { data: sessionData, isLoading, error, refetch } = useGetSession(sessionId, {
    query: { enabled: !!sessionId, queryKey: getGetSessionQueryKey(sessionId) }
  });

  const { data: userMe } = useQuery({
    queryKey: ["users-me"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/users/me", { headers });
      if (!res.ok) return null;
      return res.json() as Promise<{ plan: string; sessionCredits: number }>;
    },
    staleTime: 60_000,
  });

  const completeSession = useCompleteSession();
  const getNextQuestion = useGetNextQuestion();
  const transcribeAnswer = useTranscribeAnswer();
  const analyzePosture = useAnalyzePosture();
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [timeExpired, setTimeExpired] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [webcamEnabled, setWebcamEnabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [lastPlayedQuestionId, setLastPlayedQuestionId] = useState<number | null>(() => {
    const stored = sessionStorage.getItem(`interview_lastQ_${sessionId}`);
    return stored ? parseInt(stored, 10) : null;
  });
  const [hasPlayedWelcome, setHasPlayedWelcome] = useState<boolean>(() => {
    return sessionStorage.getItem(`interview_welcome_${sessionId}`) === "true";
  });
  const [statusMessage, setStatusMessage] = useState("Waiting...");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isHeyGenSpeaking, setIsHeyGenSpeaking] = useState(false);
  const [isFinalThankYou, setIsFinalThankYou] = useState(false);
  const [isEndingManually, setIsEndingManually] = useState(false);
  // iOS requires a user gesture before AudioContext can play audio.
  // audioUnlocked gates the TTS useEffect until the user taps "Begin".
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  // Mobile: allows the user to expand a truncated question to read it in full.
  const [questionExpanded, setQuestionExpanded] = useState(false);
  // Mobile: shows the last transcribed answer in the footer.
  const [lastTranscript, setLastTranscript] = useState("");
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);

  // Refs for user webcam / recording
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const postureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStartedRef = useRef(false);
  const hasTTSStartedRef = useRef(false);
  const closingTTSStartedRef = useRef(false);
  const isFinalThankYouRef = useRef(false);
  const isEndingManuallyRef = useRef(false);
  // Set when user hits End while recording — lets onstop score first, then ends
  const pendingEndRef = useRef(false);

  // Interviewer card refs — keyed by interviewer ID
  const cardRefsMap = useRef<Map<number, React.RefObject<InterviewerCardHandle | null>>>(new Map());

  const getOrCreateCardRef = useCallback((id: number) => {
    if (!cardRefsMap.current.has(id)) {
      cardRefsMap.current.set(id, createRef<InterviewerCardHandle>());
    }
    return cardRefsMap.current.get(id)!;
  }, []);

  const isAnySpeaking = isHeyGenSpeaking;

  // Tap-to-begin handler — called synchronously from a button onClick so
  // iOS recognises it as a user gesture and allows AudioContext to resume.
  const handleBeginInterview = useCallback(async () => {
    const unlockPromises: Promise<void>[] = [];
    for (const ref of cardRefsMap.current.values()) {
      if (ref.current?.unlockAudio) unlockPromises.push(ref.current.unlockAudio());
    }
    await Promise.all(unlockPromises);
    setAudioUnlocked(true);
  }, []);

  // Persist TTS progress to sessionStorage so hot-reloads don't re-trigger auto-play
  useEffect(() => {
    if (lastPlayedQuestionId !== null)
      sessionStorage.setItem(`interview_lastQ_${sessionId}`, String(lastPlayedQuestionId));
  }, [lastPlayedQuestionId, sessionId]);

  useEffect(() => {
    if (hasPlayedWelcome)
      sessionStorage.setItem(`interview_welcome_${sessionId}`, "true");
  }, [hasPlayedWelcome, sessionId]);

  // Setup timer — only after the user taps "Begin Interview" so the
  // countdown doesn't run while the start overlay is still showing.
  useEffect(() => {
    if (sessionData?.session.durationMinutes && !timerStartedRef.current && audioUnlocked) {
      timerStartedRef.current = true;
      setTimeLeft(sessionData.session.durationMinutes * 60);
    }
  }, [sessionData, audioUnlocked]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setTimeExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft > 0]);

  // Update status when timer expires
  useEffect(() => {
    if (!timeExpired) return;
    setStatusMessage(prev => {
      if (prev === "Recording... click again to submit your answer") {
        return "Time's up — please finish your answer.";
      }
      return "Time's up — please give your final answer";
    });
  }, [timeExpired]);

  // Setup webcam
  useEffect(() => {
    const initWebcam = async () => {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        mediaStreamRef.current = videoStream;
        if (videoRef.current) {
          videoRef.current.srcObject = videoStream;
        }
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        audioStreamRef.current = audioStream;
      } catch (err) {
        console.error("Webcam error:", err);
        setWebcamEnabled(false);
      }
    };
    if (webcamEnabled) {
      initWebcam();
    } else {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(t => t.stop());
        audioStreamRef.current = null;
      }
    }
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(t => t.stop());
        audioStreamRef.current = null;
      }
    };
  }, [webcamEnabled]);

  // Posture capture every 90s
  useEffect(() => {
    if (!sessionData) return;
    postureTimerRef.current = setInterval(() => {
      capturePosture();
    }, 90000);
    return () => {
      if (postureTimerRef.current) clearInterval(postureTimerRef.current);
    };
  }, [sessionData]);

  const capturePosture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !webcamEnabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    ctx.drawImage(videoRef.current, 0, 0);
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
    try {
      await analyzePosture.mutateAsync({ id: sessionId, data: { imageBase64 } });
    } catch (e) {
      console.error("Posture analysis error:", e);
    }
  }, [sessionId, webcamEnabled]);

  useEffect(() => {
    if (!audioUnlocked) return; // Wait until user has tapped "Begin" (required for iOS audio)
    const currentQ = sessionData?.questions[sessionData.questions.length - 1];
    if (!currentQ || currentQ.id === lastPlayedQuestionId) return;
    if (isEndingManuallyRef.current) return;

    const activeInterviewer = sessionData?.interviewers.find(i => i.id === currentQ.interviewerId);
    if (!activeInterviewer) return;

    const cardRef = cardRefsMap.current.get(activeInterviewer.id);

    setLastPlayedQuestionId(currentQ.id);
    hasTTSStartedRef.current = true;
    if (isFinalThankYouRef.current) {
      closingTTSStartedRef.current = true;
    }

    if (cardRef?.current) {
      setStatusMessage("Interviewer speaking...");
      if (!hasPlayedWelcome) {
        setHasPlayedWelcome(true);
        const introText = "Hello, welcome to our interview practice session. Let's get started!";
        cardRef.current.speak(introText)
          .then(() => {
            if (isEndingManuallyRef.current || isFinalThankYouRef.current) return;
            return cardRef.current!.speak(currentQ.questionText);
          })
          .catch(() => {
            if (isEndingManuallyRef.current || isFinalThankYouRef.current) return;
            cardRef.current?.speak(currentQ.questionText).catch(() => {
              setStatusMessage("Read the question above, then click the mic to answer");
            });
          });
      } else {
        cardRef.current.speak(currentQ.questionText).catch(() => {
          setStatusMessage("Read the question above, then click the mic to answer");
        });
      }
    } else {
      setStatusMessage("Read the question above, then click the mic to answer");
    }
  }, [sessionData?.questions?.length, audioUnlocked]);

  // After final thank-you TTS finishes, navigate to report
  useEffect(() => {
    if (isFinalThankYou && !isAnySpeaking && closingTTSStartedRef.current) {
      handleComplete();
    }
  }, [isFinalThankYou, isAnySpeaking]);

  // Fallback: if isFinalThankYou is set but TTS never starts, navigate after 5s
  useEffect(() => {
    if (!isFinalThankYou) return;
    const fallback = setTimeout(() => {
      if (!closingTTSStartedRef.current) {
        handleComplete();
      }
    }, 5000);
    return () => clearTimeout(fallback);
  }, [isFinalThankYou]);

  // After manual-end TTS finishes, navigate to report
  useEffect(() => {
    if (isEndingManually && !isAnySpeaking && closingTTSStartedRef.current) {
      handleComplete();
    }
  }, [isEndingManually, isAnySpeaking]);

  const destroyAllCards = useCallback(async () => {
    const destroyPromises: Promise<void>[] = [];
    for (const ref of cardRefsMap.current.values()) {
      if (ref.current) destroyPromises.push(Promise.resolve(ref.current.destroy()));
    }
    await Promise.allSettled(destroyPromises);
  }, []);

  const handleComplete = async () => {
    for (const ref of cardRefsMap.current.values()) {
      ref.current?.stop();
    }
    await destroyAllCards();
    // Clear persisted TTS progress so a future reload doesn't replay on a completed session
    sessionStorage.removeItem(`interview_lastQ_${sessionId}`);
    sessionStorage.removeItem(`interview_welcome_${sessionId}`);
    try {
      await completeSession.mutateAsync({ id: sessionId });
      // Show upgrade nudge for Starter users who just used their last session
      if (userMe?.plan === "starter" && userMe.sessionCredits <= 1) {
        setShowUpsellModal(true);
      } else {
        setLocation(`/report/${sessionId}`);
      }
    } catch (e) {
      console.error(e);
      setLocation(`/report/${sessionId}`);
    }
  };

  const CLOSING_LINE = "Thank you for interviewing with PrepInterv AI. Please review your performance report!";

  const handleEndWithThankYou = async () => {
    // If currently recording, let the onstop handler score the answer first,
    // then it will call handleEndWithThankYou again (pendingEndRef prevents recursion).
    if (isRecording && mediaRecorderRef.current && !pendingEndRef.current) {
      pendingEndRef.current = true;
      setIsEndingManually(true); // disables the End button immediately
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
      setStatusMessage("Scoring your answer before finishing...");
      return;
    }
    // Mark as ending FIRST so any in-flight TTS chains bail out
    isEndingManuallyRef.current = true;
    setIsEndingManually(true);
    // Stop ALL cards immediately so nothing overlaps the closing line
    for (const ref of cardRefsMap.current.values()) {
      ref.current?.stop();
    }
    // Speak the closing line, then call handleComplete() directly so we don't
    // rely on the isAnySpeaking effect (which has a race between closingTTSStartedRef
    // being set and the effect firing after the isEndingManually state change).
    const activeCard = activeInterviewerId
      ? cardRefsMap.current.get(activeInterviewerId)?.current
      : [...cardRefsMap.current.values()][0]?.current ?? null;
    if (activeCard) {
      try { await activeCard.speak(CLOSING_LINE); } catch { /* non-fatal */ }
    }
    handleComplete();
  };

  const handleCancel = async () => {
    isEndingManuallyRef.current = true;
    for (const ref of cardRefsMap.current.values()) {
      ref.current?.stop();
    }
    await destroyAllCards();
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/interview/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) {
        console.error("Cancel request failed:", res.status);
        setIsCancelling(false);
        setShowCancelDialog(false);
        setStatusMessage("Failed to cancel — please try again.");
        return;
      }
    } catch (e) {
      console.error("Cancel error:", e);
      setIsCancelling(false);
      setShowCancelDialog(false);
      setStatusMessage("Failed to cancel — please check your connection.");
      return;
    }
    setIsCancelling(false);
    setShowCancelDialog(false);
    setLocation("/");
  };

  const currentQuestion = sessionData?.questions[sessionData.questions.length - 1];
  const activeInterviewerId = currentQuestion?.interviewerId;

  // Collapse expansions and clear last transcript whenever a new question arrives.
  useEffect(() => {
    setQuestionExpanded(false);
    setLastTranscript("");
    setTranscriptExpanded(false);
  }, [currentQuestion?.id]);

  const handleToggleRecord = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      setIsProcessing(true);
      setStatusMessage("Transcribing your answer…");
    } else {
      const sourceStream = audioStreamRef.current ?? mediaStreamRef.current;
      if (!sourceStream) {
        setStatusMessage("No microphone detected. Please enable webcam/mic first.");
        return;
      }

      const audioTracks = sourceStream.getAudioTracks();
      if (audioTracks.length === 0) {
        setStatusMessage("No microphone detected. Please enable webcam/mic first.");
        return;
      }
      const recordingStream = new MediaStream(audioTracks);
      audioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
      }
      
      const recorder = new MediaRecorder(recordingStream, { mimeType });
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      recorder.onstop = async () => {
        // If the user clicked "End & Get Report" before recording started, skip entirely
        if (isEndingManuallyRef.current) {
          setIsProcessing(false);
          return;
        }
        // Check whether End was hit while this recording was active
        const endAfterScoring = pendingEndRef.current;

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          try {
            const transcribeRes = await transcribeAnswer.mutateAsync({
              id: sessionId,
              data: { audioBase64: base64Audio, mimeType }
            });
            if (!transcribeRes.text?.trim()) {
              if (endAfterScoring) {
                // No usable audio — just end without re-prompting
                pendingEndRef.current = false;
                handleEndWithThankYou();
                return;
              }
              setStatusMessage("Interviewer speaking...");
              const activeCard = activeInterviewerId ? cardRefsMap.current.get(activeInterviewerId)?.current : null;
              if (activeCard) {
                await activeCard.speak("I didn't quite catch that. Could you please go ahead and answer the question?").catch(() => {});
              }
              setStatusMessage("Please answer the question above, then click the mic.");
              return;
            }
            const transcript = transcribeRes.text.trim();
            setLastTranscript(transcript);
            setTranscriptExpanded(false);
            setStatusMessage("Evaluating your answer… this may take a moment.");

            if (currentQuestion) {
              const nextQ = await getNextQuestion.mutateAsync({
                id: sessionId,
                data: {
                  questionId: currentQuestion.id,
                  answerText: transcript
                }
              });

              if (endAfterScoring) {
                pendingEndRef.current = false;
                handleEndWithThankYou();
                return;
              }

              // Normal continue-interview flow
              if (nextQ.done) {
                handleComplete();
              } else if (nextQ.isFinalThankYou) {
                isFinalThankYouRef.current = true;
                setIsFinalThankYou(true);
                await refetch();
              } else {
                await refetch();
              }
            } else if (endAfterScoring) {
              pendingEndRef.current = false;
              handleEndWithThankYou();
            }
          } catch (e) {
            if (endAfterScoring) {
              // Error during scoring — still proceed to end
              pendingEndRef.current = false;
              handleEndWithThankYou();
              return;
            }
            if (e instanceof Error && e.message.includes("NO_CLEAR_RESPONSE")) {
              setStatusMessage("Interviewer speaking...");
              const activeCard = activeInterviewerId ? cardRefsMap.current.get(activeInterviewerId)?.current : null;
              if (activeCard) {
                await activeCard.speak("I didn't quite catch that. Could you please go ahead and answer the question?").catch(() => {});
              }
              setStatusMessage("Please answer the question above, then click the mic.");
              return;
            }
            console.error("Failed to process answer", e);
            setStatusMessage("Error processing answer. Please try again.");
          } finally {
            setIsProcessing(false);
          }
        };
      };
      
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setStatusMessage("Recording... click again to submit your answer");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-zinc-400">Loading interview session...</p>
      </div>
    );
  }

  if (error instanceof Error && 'status' in error && (error as Error & { status: number }).status === 401) {
    return <AuthPrompt />;
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col relative overflow-hidden">
      <canvas ref={canvasRef} className="hidden" />

      {/* Gradient orbs — same blue/purple family as the rest of the site */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-48 -right-48 w-[700px] h-[700px] rounded-full bg-blue-600/20 blur-[100px]" />
        <div className="absolute -top-32 -left-48 w-[600px] h-[600px] rounded-full bg-purple-600/15 blur-[90px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[400px] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[400px] rounded-full bg-purple-600/8 blur-[120px]" />
      </div>

      {/* iOS audio gate — requires one user tap before any audio can play */}
      {sessionData && !audioUnlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="text-center px-8 max-w-sm">
            <div className="w-20 h-20 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center mx-auto mb-6">
              <Play className="w-8 h-8 text-primary ml-1" />
            </div>
            <h2 className="text-white text-2xl font-bold mb-2">Ready to begin?</h2>
            <p className="text-white/50 text-sm mb-8">Your interviewers are prepared. Tap below to start — this also enables audio on your device.</p>
            <Button
              onClick={handleBeginInterview}
              size="lg"
              className="w-full gap-2 text-base font-semibold"
            >
              <Play className="w-5 h-5 ml-0.5" />
              Begin Interview
            </Button>
          </div>
        </div>
      )}

      {/* Floating timer — mobile only, always visible */}
      <div className={`fixed top-4 right-4 z-50 sm:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-full border backdrop-blur-md shadow-lg ${
        timeExpired
          ? "bg-amber-950/80 border-amber-500/50 text-amber-400"
          : "bg-black/70 border-white/10 text-primary"
      }`}>
        <span className="font-mono text-sm font-semibold" data-testid="text-timer-float">{formatTime(timeLeft)}</span>
      </div>

      {/* Header */}
      <header className="relative z-10 h-16 border-b border-white/10 flex items-center justify-between px-6 bg-black/50 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Activity className="w-5 h-5 text-primary" />
          <h1 className="font-semibold text-lg">{sessionData?.session.jobRole} Interview</h1>
        </div>
        <div className="flex items-center gap-6">
          <div className={`font-mono text-xl ${timeExpired ? 'text-amber-400' : 'text-primary'}`} data-testid="text-timer">
            {formatTime(timeLeft)}
          </div>
        </div>
      </header>

      {/* Main Area: Video Grid + Transcript Panel */}
      <main className="relative z-10 flex-1 flex overflow-hidden">
        {/* Video Grid */}
        <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 content-start overflow-y-auto">
          {/* Interviewers */}
          {sessionData?.interviewers.map(inv => {
            const isActive = inv.id === activeInterviewerId;
            const cardRef = getOrCreateCardRef(inv.id);
            return (
              <InterviewerCard
                key={inv.id}
                ref={cardRef}
                interviewer={inv}
                isActive={isActive}
                sessionId={sessionId}
                onSpeakingChange={(speaking) => {
                  if (inv.id === activeInterviewerId) {
                    setIsHeyGenSpeaking(speaking);
                    if (!speaking && !isFinalThankYouRef.current && !isEndingManuallyRef.current) {
                      setStatusMessage("Your turn — click the mic to answer");
                    }
                  }
                }}
              />
            );
          })}

          {/* User Webcam */}
          <div className="relative rounded-xl overflow-hidden bg-zinc-900 border border-white/10 min-h-48">
            {webcamEnabled ? (
              <video 
                ref={videoRef}
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover transform -scale-x-100"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-800 min-h-48">
                <VideoOff className="w-12 h-12 text-zinc-600" />
              </div>
            )}
            <div className="absolute bottom-4 left-4 bg-black/80 px-3 py-1 rounded-md backdrop-blur-sm border border-white/10 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="font-medium text-sm">You</span>
            </div>
          </div>
        </div>

        {/* Transcript Panel — rolling view: last answered pair + current question */}
        <div className="hidden xl:flex flex-col w-80 border-l border-white/10 bg-black/30">
          <div className="p-4 border-b border-white/10 flex items-center gap-2">
            <MessagesSquare className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm uppercase tracking-wider text-white/70">Live Transcript</h2>
          </div>
          <div className="p-4 space-y-4 flex-1 overflow-hidden" data-testid="transcript-panel">
            {(() => {
              const questions = sessionData?.questions ?? [];
              if (questions.length === 0) {
                return (
                  <p className="text-sm text-zinc-600 italic text-center mt-8">
                    The conversation will appear here...
                  </p>
                );
              }
              const current = questions[questions.length - 1];
              const currentInterviewer = sessionData?.interviewers.find(i => i.id === current.interviewerId);
              const prevAnswered = current.answerText == null && questions.length >= 2
                ? questions[questions.length - 2]
                : null;
              const prevInterviewer = prevAnswered
                ? sessionData?.interviewers.find(i => i.id === prevAnswered.interviewerId)
                : null;
              return (
                <>
                  {prevAnswered && (
                    <div className="space-y-2 opacity-50">
                      <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                        <div className="text-xs text-primary font-semibold mb-1">
                          {prevInterviewer?.name || "Interviewer"} · Q{questions.length - 1}
                        </div>
                        <p className="text-sm text-white/80 line-clamp-3">{prevAnswered.questionText}</p>
                      </div>
                      {prevAnswered.answerText && (
                        <div className="bg-white/5 border border-white/10 rounded-lg p-3 ml-4">
                          <div className="text-xs text-zinc-500 font-semibold mb-1">You</div>
                          <p className="text-sm text-zinc-300 line-clamp-4">{prevAnswered.answerText}</p>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                      <div className="text-xs text-primary font-semibold mb-1">
                        {currentInterviewer?.name || "Interviewer"} · Q{questions.length}
                      </div>
                      <p className="text-sm text-white/80">{current.questionText}</p>
                    </div>
                    {current.answerText && (
                      <div className="bg-white/5 border border-white/10 rounded-lg p-3 ml-4">
                        <div className="text-xs text-zinc-500 font-semibold mb-1">You</div>
                        <p className="text-sm text-zinc-300">{current.answerText}</p>
                      </div>
                    )}
                  </div>
                  {questions.length > 1 && (
                    <p className="text-xs text-zinc-600 text-center italic">
                      {questions.length - (prevAnswered ? 2 : 1)} earlier exchange{questions.length - (prevAnswered ? 2 : 1) !== 1 ? "s" : ""} — full history in report
                    </p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </main>

      {/* Bottom Control Bar */}
      <footer className="relative z-10 border-t border-white/10 bg-black/80 backdrop-blur-xl px-4 py-4 sm:px-6 sm:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 shrink-0 overflow-x-hidden">
        {/* Question text */}
        <div className="flex-1 max-w-3xl w-full">
          <div className="text-xs text-primary mb-1 font-mono uppercase tracking-wider">Current Question</div>
          <div className={`text-sm sm:text-lg font-medium text-white/90 min-h-[2.5rem] sm:min-h-[4.5rem] ${!questionExpanded ? "line-clamp-2 sm:line-clamp-3" : ""}`}>
            {currentQuestion?.questionText || "Starting interview — please wait..."}
          </div>
          {currentQuestion?.questionText && (
            <button
              className="mt-1.5 text-xs text-primary font-semibold tracking-wide"
              onClick={() => setQuestionExpanded(v => !v)}
            >
              {questionExpanded ? "Show less ▲" : "Show more ▼"}
            </button>
          )}

          {/* Last answer transcript — only visible on mobile (xl sidebar shows it on large screens) */}
          {lastTranscript && (
            <div className="xl:hidden mt-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <div className="text-xs text-zinc-500 font-semibold mb-0.5">Your answer</div>
              <p className={`text-xs text-zinc-400 ${!transcriptExpanded ? "line-clamp-3" : ""}`}>
                {lastTranscript}
              </p>
              {lastTranscript.length > 120 && (
                <button
                  className="mt-1 text-xs text-primary/70 font-semibold tracking-wide"
                  onClick={() => setTranscriptExpanded(v => !v)}
                >
                  {transcriptExpanded ? "Show less ▲" : "Show more ▼"}
                </button>
              )}
            </div>
          )}

          <div className="mt-1 text-xs text-zinc-500">{statusMessage}</div>

          {/* Processing step indicator */}
          {(isProcessing || transcribeAnswer.isPending || getNextQuestion.isPending) && !isEndingManually && (
            <div className="mt-2 flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-lg px-3 py-2 w-fit">
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
              <span className="text-xs font-medium text-primary">
                {getNextQuestion.isPending
                  ? "Evaluating your answer…"
                  : transcribeAnswer.isPending
                    ? "Transcribing your answer…"
                    : "Processing…"}
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
          {/* Row 1: secondary actions */}
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className={`border-primary/40 text-primary hover:bg-primary/10 gap-1.5 transition-opacity duration-300 text-xs sm:text-sm ${
                isAnySpeaking ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              onClick={() => {
                if (activeInterviewerId) {
                  const ref = cardRefsMap.current.get(activeInterviewerId);
                  ref?.current?.stop();
                }
                setIsHeyGenSpeaking(false);
              }}
              data-testid="button-skip-tts"
              title="Skip to answering"
            >
              Skip
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="border-white/20 text-zinc-400 hover:text-red-400 hover:border-red-400/40 hover:bg-red-950/20 gap-1.5 text-xs sm:text-sm"
              onClick={() => setShowCancelDialog(true)}
              data-testid="button-cancel"
              disabled={isCancelling}
              title="Cancel and discard this session"
            >
              <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Cancel</span>
              <span className="inline xs:hidden">Cancel</span>
            </Button>

            <Button variant="destructive" size="sm" onClick={handleEndWithThankYou} data-testid="button-end"
              className="text-xs sm:text-sm"
              disabled={completeSession.isPending || isEndingManually || isFinalThankYou}>
              {(completeSession.isPending || isEndingManually) ? <Loader2 className="w-4 h-4 animate-spin" /> : "End & Get Report"}
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="w-9 h-9 sm:w-12 sm:h-12 rounded-full border-white/20 hover:bg-white/10 shrink-0"
              onClick={() => setWebcamEnabled(!webcamEnabled)}
              data-testid="button-toggle-video"
              title={webcamEnabled ? "Turn off camera" : "Turn on camera"}
            >
              {webcamEnabled ? <Video className="w-4 h-4 sm:w-5 sm:h-5" /> : <VideoOff className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />}
            </Button>
          </div>

          {/* Row 2: mic button — centered and prominent */}
          {!isFinalThankYou && !isEndingManually && (
            <div className="flex justify-center sm:hidden">
              <Button
                variant={isRecording ? "destructive" : "default"}
                className={`w-16 h-16 rounded-full transition-all ${isRecording ? 'animate-pulse ring-4 ring-red-500/50' : 'hover:scale-105'}`}
                onClick={handleToggleRecord}
                data-testid="button-toggle-audio"
                disabled={isProcessing || isAnySpeaking || transcribeAnswer.isPending || getNextQuestion.isPending}
                title={isRecording ? "Stop recording" : "Start recording your answer"}
              >
                {isProcessing || transcribeAnswer.isPending || getNextQuestion.isPending
                  ? <Loader2 className="w-6 h-6 animate-spin" />
                  : isRecording
                    ? <SquareSquare className="w-6 h-6" />
                    : <Mic className="w-6 h-6" />}
              </Button>
            </div>
          )}

          {/* Desktop mic — inline with controls */}
          {!isFinalThankYou && !isEndingManually && (
            <div className="hidden sm:flex">
              <Button
                variant={isRecording ? "destructive" : "default"}
                className={`w-16 h-16 rounded-full transition-all ${isRecording ? 'animate-pulse ring-4 ring-red-500/50' : 'hover:scale-105'}`}
                onClick={handleToggleRecord}
                data-testid="button-toggle-audio"
                disabled={isProcessing || isAnySpeaking || transcribeAnswer.isPending || getNextQuestion.isPending}
                title={isRecording ? "Stop recording" : "Start recording your answer"}
              >
                {isProcessing || transcribeAnswer.isPending || getNextQuestion.isPending
                  ? <Loader2 className="w-6 h-6 animate-spin" />
                  : isRecording
                    ? <SquareSquare className="w-6 h-6" />
                    : <Mic className="w-6 h-6" />}
              </Button>
            </div>
          )}
        </div>
      </footer>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Interview?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This session will be discarded and your progress will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Keep going</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Yes, discard session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Post-session upgrade modal — Starter users who just used their last session */}
      {showUpsellModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">

            {/* Top gradient strip */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 pt-7 pb-6 text-center">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-white text-xl font-bold">Session complete!</h2>
              <p className="text-white/80 text-sm mt-1">You've used your last session this month.</p>
            </div>

            {/* Body */}
            <div className="bg-white px-6 py-6 space-y-5">
              <p className="text-slate-600 text-sm text-center leading-relaxed">
                Consistent practice is what gets offers. Upgrade to <span className="font-semibold text-indigo-700">Pro</span> for unlimited sessions every month — no more running out right before your next interview.
              </p>

              {/* Pro perks */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-2.5">
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Pro — $24 / month</p>
                {[
                  "Unlimited interview sessions",
                  "3 AI resume tailors per month",
                  "All AI interviewers & question types",
                  "Detailed performance reports",
                ].map((perk) => (
                  <div key={perk} className="flex items-center gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                    {perk}
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex flex-col gap-2.5">
                <a
                  href="/pricing"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-md hover:from-blue-700 hover:to-indigo-700 transition-all"
                >
                  <Zap className="w-4 h-4" /> Upgrade to Pro
                </a>
                <button
                  onClick={() => setLocation(`/report/${sessionId}`)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  View my report first
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

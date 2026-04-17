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
import { Mic, Video, VideoOff, SquareSquare, Activity, Loader2, MessagesSquare, XCircle } from "lucide-react";
import InterviewerCard, { type InterviewerCardHandle } from "@/components/InterviewerCard";
import { AuthPrompt } from "@/components/AuthPrompt";

export default function Interview() {
  const params = useParams();
  const sessionId = parseInt(params.sessionId || "0");
  const [, setLocation] = useLocation();
  const { data: sessionData, isLoading, error, refetch } = useGetSession(sessionId, {
    query: { enabled: !!sessionId, queryKey: getGetSessionQueryKey(sessionId) }
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
  const [lastPlayedQuestionId, setLastPlayedQuestionId] = useState<number | null>(null);
  const [hasPlayedWelcome, setHasPlayedWelcome] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Waiting...");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isHeyGenSpeaking, setIsHeyGenSpeaking] = useState(false);
  const [isFinalThankYou, setIsFinalThankYou] = useState(false);
  const [isEndingManually, setIsEndingManually] = useState(false);

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

  // Interviewer card refs — keyed by interviewer ID
  const cardRefsMap = useRef<Map<number, React.RefObject<InterviewerCardHandle | null>>>(new Map());

  const getOrCreateCardRef = useCallback((id: number) => {
    if (!cardRefsMap.current.has(id)) {
      cardRefsMap.current.set(id, createRef<InterviewerCardHandle>());
    }
    return cardRefsMap.current.get(id)!;
  }, []);

  const isAnySpeaking = isHeyGenSpeaking;

  // Setup timer
  useEffect(() => {
    if (sessionData?.session.durationMinutes && !timerStartedRef.current) {
      timerStartedRef.current = true;
      setTimeLeft(sessionData.session.durationMinutes * 60);
    }
  }, [sessionData]);

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
  }, [sessionData?.questions?.length]);

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
    try {
      await completeSession.mutateAsync({ id: sessionId });
      setLocation(`/report/${sessionId}`);
    } catch (e) {
      console.error(e);
      setLocation(`/report/${sessionId}`);
    }
  };

  const CLOSING_LINE = "Thank you for interviewing with PrepInterv AI. Please review your performance report!";

  const handleEndWithThankYou = () => {
    // Mark as ending FIRST so any in-flight TTS chains bail out
    isEndingManuallyRef.current = true;
    setIsEndingManually(true);
    // Stop any active recording gracefully
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    // Stop ALL cards immediately so nothing overlaps
    for (const ref of cardRefsMap.current.values()) {
      ref.current?.stop();
    }
    setLocation("/");
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

  const handleToggleRecord = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      setIsProcessing(true);
      setStatusMessage("Processing your answer...");
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
        // If the user clicked "End & Get Report" while recording, skip transcription
        if (isEndingManuallyRef.current) {
          setIsProcessing(false);
          return;
        }
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
              setStatusMessage("Interviewer speaking...");
              const activeCard = activeInterviewerId ? cardRefsMap.current.get(activeInterviewerId)?.current : null;
              if (activeCard) {
                await activeCard.speak("I didn't quite catch that. Could you please go ahead and answer the question?").catch(() => {});
              }
              setStatusMessage("Please answer the question above, then click the mic.");
              return;
            }
            const transcript = transcribeRes.text.trim();

            if (currentQuestion) {
              const nextQ = await getNextQuestion.mutateAsync({
                id: sessionId,
                data: {
                  questionId: currentQuestion.id,
                  answerText: transcript
                }
              });
              
              if (nextQ.done) {
                handleComplete();
              } else if (nextQ.isFinalThankYou) {
                isFinalThankYouRef.current = true;
                setIsFinalThankYou(true);
                await refetch();
              } else {
                await refetch();
              }
            }
          } catch (e) {
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
          <div className="text-sm sm:text-lg font-medium text-white/90 line-clamp-2 sm:line-clamp-3 min-h-[2.5rem] sm:min-h-[4.5rem]">
            {currentQuestion?.questionText || "Starting interview — please wait..."}
          </div>
          <div className="mt-1 text-xs text-zinc-500">{statusMessage}</div>
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
    </div>
  );
}

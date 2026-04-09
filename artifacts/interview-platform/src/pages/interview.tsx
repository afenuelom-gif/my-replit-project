import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { 
  useGetSession, 
  getGetSessionQueryKey,
  useCompleteSession,
  useGetNextQuestion,
  useTranscribeAnswer,
  useAnalyzePosture
} from "@workspace/api-client-react";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { Button } from "@/components/ui/button";
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

export default function Interview() {
  const params = useParams();
  const sessionId = parseInt(params.sessionId || "0");
  const [, setLocation] = useLocation();
  const { data: sessionData, isLoading, refetch } = useGetSession(sessionId, {
    query: { enabled: !!sessionId, queryKey: getGetSessionQueryKey(sessionId) }
  });

  const completeSession = useCompleteSession();
  const getNextQuestion = useGetNextQuestion();
  const transcribeAnswer = useTranscribeAnswer();
  const analyzePosture = useAnalyzePosture();
  const { speak: speechSpeak, stop: speechStop, isSpeaking, isSupported: isTTSSupported } = useSpeechSynthesis();

  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [webcamEnabled, setWebcamEnabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastPlayedQuestionId, setLastPlayedQuestionId] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState("Waiting...");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const postureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStartedRef = useRef(false);
  const hasTTSStartedRef = useRef(false);

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
          handleComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft > 0]);

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

  // Auto-play TTS for new questions via Web Speech API
  useEffect(() => {
    const currentQ = sessionData?.questions[sessionData.questions.length - 1];
    if (!currentQ || currentQ.id === lastPlayedQuestionId) return;
    const activeInterviewer = sessionData?.interviewers.find(i => i.id === currentQ.interviewerId);
    if (!activeInterviewer) return;

    setLastPlayedQuestionId(currentQ.id);

    if (isTTSSupported) {
      setStatusMessage("Interviewer speaking...");
      hasTTSStartedRef.current = true;
      speechSpeak(currentQ.questionText, activeInterviewer.voiceId);
    } else {
      setStatusMessage("Read the question above, then click the mic to answer");
    }
  }, [sessionData?.questions?.length]);

  // Update status when speech ends
  useEffect(() => {
    if (!isSpeaking && hasTTSStartedRef.current) {
      setStatusMessage("Your turn — click the mic to answer");
    }
  }, [isSpeaking]);

  const handleComplete = async () => {
    speechStop();
    try {
      await completeSession.mutateAsync({ id: sessionId });
      setLocation(`/report/${sessionId}`);
    } catch (e) {
      console.error(e);
      setLocation(`/report/${sessionId}`);
    }
  };

  const handleCancel = async () => {
    speechStop();
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
            
            if (currentQuestion) {
              const nextQ = await getNextQuestion.mutateAsync({
                id: sessionId,
                data: {
                  questionId: currentQuestion.id,
                  answerText: transcribeRes.text
                }
              });
              
              if (nextQ.done) {
                handleComplete();
              } else {
                await refetch();
              }
            }
          } catch (e) {
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

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Header */}
      <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-black/50 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Activity className="w-5 h-5 text-primary" />
          <h1 className="font-semibold text-lg">{sessionData?.session.jobRole} Interview</h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="font-mono text-xl text-primary" data-testid="text-timer">
            {formatTime(timeLeft)}
          </div>
        </div>
      </header>

      {/* Main Area: Video Grid + Transcript Panel */}
      <main className="flex-1 flex overflow-hidden">
        {/* Video Grid */}
        <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 content-start overflow-y-auto">
          {/* Interviewers */}
          {sessionData?.interviewers.map(inv => {
            const isActive = inv.id === activeInterviewerId;
            const isTalking = isActive && isSpeaking;
            return (
              <div
                key={inv.id}
                className={`relative rounded-xl overflow-hidden bg-zinc-900 border-2 transition-all duration-300 min-h-48 ${
                  isTalking
                    ? 'border-primary animate-ring-pulse scale-[1.03] shadow-[0_0_50px_rgba(0,195,255,0.55)]'
                    : isActive
                    ? 'border-primary shadow-[0_0_30px_rgba(0,195,255,0.2)]'
                    : 'border-white/5'
                }`}
              >
                <div className="animate-avatar-breathe w-full h-full">
                  {inv.avatarUrl ? (
                    <img src={inv.avatarUrl} alt={inv.name} className="w-full h-full object-cover min-h-48" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-7xl font-bold text-white/20 min-h-48">
                      {inv.name.charAt(0)}
                    </div>
                  )}
                </div>

                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pt-6 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-primary animate-pulse' : 'bg-zinc-600'}`} />
                    <span className="font-semibold text-sm text-white">{inv.name}</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-tight">{inv.title}</p>

                  {isTalking ? (
                    <div className="flex items-end gap-1 mt-2 h-8" aria-label="Speaking">
                      {[0, 1, 2, 3, 4, 5, 6].map(i => (
                        <div
                          key={i}
                          className="w-1.5 bg-primary rounded-full animate-sound-bar origin-bottom"
                          style={{
                            height: `${14 + (i % 4) * 6}px`,
                            animationDelay: `${i * 0.08}s`,
                          }}
                        />
                      ))}
                      <span className="text-xs text-primary ml-2 font-semibold tracking-wide">Speaking…</span>
                    </div>
                  ) : isActive ? (
                    <p className="text-xs text-primary/60 mt-2">Active</p>
                  ) : (
                    <p className="text-xs text-zinc-700 mt-2">Waiting</p>
                  )}
                </div>
              </div>
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
      <footer className="border-t border-white/10 bg-black/80 backdrop-blur-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1 max-w-3xl">
          <div className="text-xs text-primary mb-1 font-mono uppercase tracking-wider">Current Question</div>
          <div className="text-base sm:text-lg font-medium text-white/90 line-clamp-3">
            {currentQuestion?.questionText || "Starting interview — please wait..."}
          </div>
          <div className="mt-2 text-xs text-zinc-500">{statusMessage}</div>
        </div>

        <div className="flex items-center gap-4">
          {isSpeaking && (
            <Button
              variant="outline"
              size="sm"
              className="border-primary/40 text-primary hover:bg-primary/10 gap-2"
              onClick={() => speechStop()}
              data-testid="button-skip-tts"
              title="Skip to answering"
            >
              Skip
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="border-white/20 text-zinc-400 hover:text-red-400 hover:border-red-400/40 hover:bg-red-950/20 gap-2"
            onClick={() => setShowCancelDialog(true)}
            data-testid="button-cancel"
            disabled={isCancelling}
            title="Cancel and discard this session"
          >
            <XCircle className="w-4 h-4" />
            Cancel Interview
          </Button>

          <Button variant="destructive" size="sm" onClick={handleComplete} data-testid="button-end"
            disabled={completeSession.isPending}>
            {completeSession.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "End & Get Report"}
          </Button>

          <Button 
            variant="outline" 
            size="icon" 
            className="w-12 h-12 rounded-full border-white/20 hover:bg-white/10"
            onClick={() => setWebcamEnabled(!webcamEnabled)}
            data-testid="button-toggle-video"
            title={webcamEnabled ? "Turn off camera" : "Turn on camera"}
          >
            {webcamEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5 text-red-500" />}
          </Button>

          <Button 
            variant={isRecording ? "destructive" : "default"}
            className={`w-16 h-16 rounded-full transition-all ${isRecording ? 'animate-pulse ring-4 ring-red-500/50' : 'hover:scale-105'}`}
            onClick={handleToggleRecord}
            data-testid="button-toggle-audio"
            disabled={isProcessing || isSpeaking || transcribeAnswer.isPending || getNextQuestion.isPending}
            title={isRecording ? "Stop recording" : "Start recording your answer"}
          >
            {isProcessing || transcribeAnswer.isPending || getNextQuestion.isPending 
              ? <Loader2 className="w-6 h-6 animate-spin" /> 
              : isRecording 
                ? <SquareSquare className="w-6 h-6" /> 
                : <Mic className="w-6 h-6" />}
          </Button>
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

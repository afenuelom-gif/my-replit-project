import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetSession, 
  getGetSessionQueryKey,
  useCompleteSession,
  useGetNextQuestion,
  useTranscribeAnswer,
  useTextToSpeech,
  useAnalyzePosture
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Mic, Video, VideoOff, SquareSquare, Activity, Loader2, Volume2 } from "lucide-react";

export default function Interview() {
  const params = useParams();
  const sessionId = parseInt(params.sessionId || "0");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: sessionData, isLoading, refetch } = useGetSession(sessionId, {
    query: { enabled: !!sessionId, queryKey: getGetSessionQueryKey(sessionId) }
  });

  const completeSession = useCompleteSession();
  const getNextQuestion = useGetNextQuestion();
  const transcribeAnswer = useTranscribeAnswer();
  const textToSpeech = useTextToSpeech();
  const analyzePosture = useAnalyzePosture();

  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [webcamEnabled, setWebcamEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastPlayedQuestionId, setLastPlayedQuestionId] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState("Waiting...");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const postureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStartedRef = useRef(false);

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
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
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
    }
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
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

  // Auto-play TTS for new questions
  useEffect(() => {
    const currentQ = sessionData?.questions[sessionData.questions.length - 1];
    if (!currentQ || currentQ.id === lastPlayedQuestionId) return;
    
    const activeInterviewer = sessionData?.interviewers.find(i => i.id === currentQ.interviewerId);
    if (!activeInterviewer) return;

    setLastPlayedQuestionId(currentQ.id);
    setStatusMessage("Interviewer speaking...");
    playTTS(currentQ.questionText, activeInterviewer.id);
  }, [sessionData?.questions?.length]);

  const playTTS = async (text: string, interviewerId: number) => {
    setIsSpeaking(true);
    try {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      const res = await textToSpeech.mutateAsync({ id: sessionId, data: { text, interviewerId } });
      const audioBlob = base64ToBlob(res.audioBase64, 'audio/mpeg');
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      audio.onended = () => {
        setIsSpeaking(false);
        setStatusMessage("Your turn — click the mic to answer");
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (e) {
      console.error("TTS error:", e);
      setIsSpeaking(false);
      setStatusMessage("Your turn — click the mic to answer");
    }
  };

  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const bytes = atob(base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mimeType });
  };

  const handleComplete = async () => {
    try {
      await completeSession.mutateAsync({ id: sessionId });
      setLocation(`/report/${sessionId}`);
    } catch (e) {
      console.error(e);
      setLocation(`/report/${sessionId}`);
    }
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
      if (!mediaStreamRef.current) {
        setStatusMessage("No microphone detected. Please enable webcam/mic first.");
        return;
      }
      audioChunksRef.current = [];
      
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
      }
      
      const recorder = new MediaRecorder(mediaStreamRef.current, { mimeType });
      
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
          <Button variant="destructive" size="sm" onClick={handleComplete} data-testid="button-end"
            disabled={completeSession.isPending}>
            {completeSession.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "End Session"}
          </Button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Interviewers */}
        {sessionData?.interviewers.map(inv => {
          const isActive = inv.id === activeInterviewerId;
          return (
            <div 
              key={inv.id} 
              className={`relative rounded-xl overflow-hidden bg-zinc-900 border-2 transition-all duration-300 min-h-48 ${
                isActive ? 'border-primary shadow-[0_0_30px_rgba(0,195,255,0.2)]' : 'border-white/5'
              }`}
            >
              {inv.avatarUrl ? (
                <img src={inv.avatarUrl} alt={inv.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-7xl font-bold text-white/20 min-h-48">
                  {inv.name.charAt(0)}
                </div>
              )}
              
              {isActive && isSpeaking && (
                <div className="absolute top-4 right-4 bg-primary/20 border border-primary/40 backdrop-blur-sm rounded-full p-2 flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-primary animate-pulse" />
                  <div className="flex gap-0.5">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="w-0.5 bg-primary rounded-full animate-pulse" 
                        style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 0.1}s` }} />
                    ))}
                  </div>
                </div>
              )}

              <div className="absolute bottom-4 left-4 bg-black/80 px-3 py-1 rounded-md backdrop-blur-sm border border-white/10 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-primary animate-pulse' : 'bg-zinc-600'}`} />
                <span className="font-medium text-sm">{inv.name}</span>
                <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">{inv.title}</span>
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
    </div>
  );
}

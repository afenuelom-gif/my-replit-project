import React, { useEffect, useRef, useState, useCallback } from "react";
import { useElevenLabsTTS } from "@/hooks/useElevenLabsTTS";
import { Square, CheckCircle2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Interviewer {
  id: number;
  name: string;
  title: string;
  avatarUrl?: string | null;
}

interface AnswerFeedback {
  questionText: string;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

interface ReportData {
  answerFeedback: AnswerFeedback[];
  suggestions?: string[];
}

interface NarrationItem {
  label: string;
  text: string;
}

function buildScript(report: ReportData): NarrationItem[] {
  const items: NarrationItem[] = [];

  items.push({
    label: "Introduction",
    text: "Let's review this together.",
  });

  report.answerFeedback.forEach((fb, i) => {
    items.push({
      label: `Question ${i + 1} of ${report.answerFeedback.length}`,
      text: `For Question ${i + 1}, you were asked: ${fb.questionText}. Here is the feedback I have for you. ${fb.feedback}`,
    });
  });

  const allStrengths = report.answerFeedback
    .flatMap((fb) => fb.strengths)
    .filter(Boolean);
  if (allStrengths.length > 0) {
    items.push({
      label: "Strengths",
      text: `Here are your key strengths. ${allStrengths.slice(0, 4).join(". ")}.`,
    });
  }

  const allImprovements = [
    ...new Set(report.answerFeedback.flatMap((fb) => fb.improvements)),
  ].filter(Boolean);
  const suggestions = report.suggestions ?? [];
  const combined = [...allImprovements, ...suggestions].filter(Boolean);
  if (combined.length > 0) {
    items.push({
      label: "Areas to Improve",
      text: `Here are the areas you can improve. ${combined.slice(0, 3).join(". ")}.`,
    });
  }

  items.push({
    label: "Closing",
    text: "This ends the review. Keep practicing, and all the best with your interview preparations.",
  });

  return items;
}

const WAVEFORM_HEIGHTS = [40, 70, 55, 85, 45, 75, 60, 90, 50, 65, 80, 48, 72];
const WAVEFORM_DELAYS = [0, 0.15, 0.3, 0.1, 0.4, 0.25, 0.05, 0.35, 0.2, 0.45, 0.08, 0.28, 0.18];

function SpeakingWaveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-[2px] h-5">
      {WAVEFORM_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="w-[2px] rounded-full bg-blue-500 transition-all duration-100"
          style={{
            height: active ? `${h}%` : "15%",
            animation: active
              ? `waveform 0.8s ease-in-out ${WAVEFORM_DELAYS[i]}s infinite alternate`
              : "none",
            opacity: active ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
}

interface VoiceReviewPanelProps {
  sessionId: number;
  interviewer: Interviewer;
  report: ReportData;
}

export default function VoiceReviewPanel({
  sessionId,
  interviewer,
  report,
}: VoiceReviewPanelProps) {
  const { speak, stop, pause, resume, isSpeaking, isPaused } = useElevenLabsTTS(sessionId);

  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [stopped, setStopped] = useState(false);
  const [done, setDone] = useState(false);
  const [paused, setPaused] = useState(false);

  const scriptRef = useRef<NarrationItem[]>([]);
  const stoppedRef = useRef(false);
  const runningRef = useRef(false);
  const pausedRef = useRef(false);
  const resumeResolveRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    scriptRef.current = buildScript(report);
  }, [report]);

  const waitUntilResumed = useCallback((): Promise<void> => {
    if (!pausedRef.current) return Promise.resolve();
    return new Promise<void>((resolve) => {
      resumeResolveRef.current = resolve;
    });
  }, []);

  const runScript = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    stoppedRef.current = false;

    const script = scriptRef.current;
    for (let i = 0; i < script.length; i++) {
      await waitUntilResumed();
      if (stoppedRef.current) break;
      setCurrentIndex(i);
      await speak(script[i].text, interviewer.id);
      if (stoppedRef.current) break;
      await waitUntilResumed();
      if (stoppedRef.current) break;
      await new Promise<void>((res) => setTimeout(res, 500));
    }

    runningRef.current = false;
    if (!stoppedRef.current) {
      setDone(true);
      setCurrentIndex(-1);
    }
  }, [speak, interviewer.id, waitUntilResumed]);

  useEffect(() => {
    const timer = setTimeout(() => {
      runScript();
    }, 800);
    return () => {
      clearTimeout(timer);
      stoppedRef.current = true;
      stop();
    };
  }, []);

  const handlePause = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
    pause();
  }, [pause]);

  const handleResume = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);
    resume();
    resumeResolveRef.current?.();
    resumeResolveRef.current = null;
  }, [resume]);

  const handleStop = useCallback(() => {
    stoppedRef.current = true;
    runningRef.current = false;
    pausedRef.current = false;
    resumeResolveRef.current?.();
    resumeResolveRef.current = null;
    setStopped(true);
    setPaused(false);
    stop();
    setCurrentIndex(-1);
  }, [stop]);

  const script = scriptRef.current;
  const currentItem = currentIndex >= 0 ? script[currentIndex] : null;
  const progress =
    script.length > 0 && currentIndex >= 0
      ? Math.round(((currentIndex + 1) / script.length) * 100)
      : done
      ? 100
      : 0;

  const isActivelyPlaying = isSpeaking && !isPaused && !paused;

  return (
    <div className="print:hidden sticky top-[65px] z-20 bg-white border border-blue-200 rounded-2xl shadow-md overflow-hidden">
      <div className="flex items-center gap-4 px-5 py-4">

        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-blue-200 bg-slate-100">
            {interviewer.avatarUrl ? (
              <img
                src={interviewer.avatarUrl}
                alt={interviewer.name}
                className="w-full h-full object-cover object-top"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-lg font-bold text-slate-400">
                {interviewer.name.charAt(0)}
              </div>
            )}
          </div>
          {isActivelyPlaying && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white animate-pulse" />
          )}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-slate-900">{interviewer.name}</span>
            {done ? (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Review complete
              </span>
            ) : stopped ? (
              <span className="text-xs text-slate-400 font-medium">Stopped</span>
            ) : paused ? (
              <span className="text-xs text-amber-600 font-medium">Paused</span>
            ) : (
              <span className="text-xs text-blue-600 font-medium">
                {currentItem ? currentItem.label : "Preparing review…"}
              </span>
            )}
          </div>

          {/* Waveform + progress bar */}
          {done || stopped ? (
            <p className="text-xs text-slate-400">
              {done ? "The voice walkthrough has finished." : "Narration stopped."}
            </p>
          ) : (
            <div className="flex items-center gap-3">
              <SpeakingWaveform active={isActivelyPlaying} />
              <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-slate-400 shrink-0 tabular-nums">
                {progress}%
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        {!done && !stopped && (
          <div className="flex items-center gap-1 shrink-0">
            {paused ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResume}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span className="text-xs">Resume</span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePause}
                className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 gap-1.5"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span className="text-xs">Pause</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStop}
              className="text-slate-400 hover:text-red-600 hover:bg-red-50 gap-1.5"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span className="text-xs">Stop</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

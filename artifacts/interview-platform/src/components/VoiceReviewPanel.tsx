import React, { useEffect, useRef, useState, useCallback } from "react";
import { useElevenLabsTTS } from "@/hooks/useElevenLabsTTS";
import { Square, CheckCircle2, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";

function ScrollingText({ children, className }: { children: React.ReactNode; className?: string }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLSpanElement>(null);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const outer = outerRef.current;
    const first = firstRef.current;
    if (!outer || !first) return;
    const measure = () => {
      const overflow = first.scrollWidth - outer.clientWidth;
      // speed ~25 px/s; min 4 s so it never feels frantic
      setDuration(overflow > 4 ? Math.max(4, first.scrollWidth / 25) : 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [children]);

  const active = duration > 0;

  return (
    <div ref={outerRef} className={`overflow-hidden min-w-0 ${className ?? ""}`}>
      {/* inline-flex lets the row expand to its full content width (not clamped
          by the parent), so translateX(-50%) = exactly one copy-width, making
          the loop seamless as the second copy slides in right behind the first. */}
      <div
        className="inline-flex whitespace-nowrap"
        style={active ? { animation: `text-scroll ${duration.toFixed(1)}s linear infinite` } : undefined}
      >
        <span ref={firstRef} className={active ? "pr-16" : ""}>{children}</span>
        {active && <span aria-hidden className="pr-16">{children}</span>}
      </div>
    </div>
  );
}

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
  if (!report.answerFeedback || report.answerFeedback.length === 0) {
    return [{ label: "No Interview Data", text: "It looks like no questions were answered in this session. Complete an interview to receive a voice review." }];
  }
  const items: NarrationItem[] = [];
  items.push({ label: "Introduction", text: "Let's review this together." });
  report.answerFeedback.forEach((fb, i) => {
    items.push({
      label: `Question ${i + 1} of ${report.answerFeedback.length}`,
      text: `For Question ${i + 1}, you were asked: ${fb.questionText}. Here is the feedback I have for you. ${fb.feedback}`,
    });
  });
  const allStrengths = report.answerFeedback.flatMap((fb) => fb.strengths).filter(Boolean);
  if (allStrengths.length > 0) {
    items.push({
      label: "Strengths",
      text: `Here are your key strengths. ${allStrengths.slice(0, 4).join(". ")}.`,
    });
  }
  const combined = [
    ...new Set(report.answerFeedback.flatMap((fb) => fb.improvements)),
    ...(report.suggestions ?? []),
  ].filter(Boolean);
  if (combined.length > 0) {
    items.push({
      label: "Areas to Improve",
      text: `Here are the areas you can improve. ${combined.slice(0, 3).join(". ")}.`,
    });
  }
  const closingText = "This ends the review. We would appreciate your feedback on this interview to help us improve the service. Keep practicing, and all the best with your interview preparations.";
  items.push({ label: "Closing", text: closingText });
  return items;
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const WAVEFORM_HEIGHTS = [40, 70, 55, 85, 45, 75, 60, 90, 50, 65, 80, 48, 72];
const WAVEFORM_DELAYS  = [0, 0.15, 0.3, 0.1, 0.4, 0.25, 0.05, 0.35, 0.2, 0.45, 0.08, 0.28, 0.18];

function SpeakingWaveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-[2px] h-5 shrink-0">
      {WAVEFORM_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="w-[2px] rounded-full bg-blue-500 transition-all duration-100"
          style={{
            height: active ? `${h}%` : "15%",
            animation: active ? `waveform 0.8s ease-in-out ${WAVEFORM_DELAYS[i]}s infinite alternate` : "none",
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
  onReviewComplete?: () => void;
}

// iOS requires a user gesture before AudioContext can play audio.
// Detect iPad/iPhone/iPod and iPad-as-Mac (iOS 13+ reports MacIntel).
function detectsIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export default function VoiceReviewPanel({ sessionId, interviewer, report, onReviewComplete }: VoiceReviewPanelProps) {
  const {
    speak, stop, pause, resume, seekTime, unlockAudio,
    isSpeaking, isPaused, audioCurrentTime, audioDuration,
  } = useElevenLabsTTS(sessionId);

  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [stopped, setStopped]           = useState(false);
  const [done, setDone]                 = useState(false);
  const [paused, setPaused]             = useState(false);
  // waitingForGesture: true on iOS until the user taps Play for the first time.
  const [waitingForGesture, setWaitingForGesture] = useState(detectsIOS);
  // dragTime: non-null while user is dragging the scrubber (visual-only, no seek yet)
  const [dragTime, setDragTime]         = useState<number | null>(null);

  const scriptRef        = useRef<NarrationItem[]>([]);
  const stoppedRef       = useRef(false);
  const runningRef       = useRef(false);
  const pausedRef        = useRef(false);
  const resumeResolveRef = useRef<(() => void) | null>(null);
  const seekRef          = useRef<number | null>(null);

  useEffect(() => { scriptRef.current = buildScript(report); }, [report]);

  useEffect(() => { if (done) onReviewComplete?.(); }, [done]);

  const waitUntilResumed = useCallback((): Promise<void> => {
    if (!pausedRef.current) return Promise.resolve();
    return new Promise<void>((resolve) => { resumeResolveRef.current = resolve; });
  }, []);

  const runScript = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    stoppedRef.current = false;
    const script = scriptRef.current;
    let i = 0;
    while (i < script.length) {
      if (seekRef.current !== null) { i = seekRef.current; seekRef.current = null; }
      await waitUntilResumed();
      if (stoppedRef.current) break;
      if (seekRef.current !== null) { i = seekRef.current; seekRef.current = null; continue; }
      setCurrentIndex(i);
      await speak(script[i].text, interviewer.id);
      if (seekRef.current !== null) { i = seekRef.current; seekRef.current = null; continue; }
      if (stoppedRef.current) break;
      await waitUntilResumed();
      if (stoppedRef.current) break;
      if (seekRef.current !== null) { i = seekRef.current; seekRef.current = null; continue; }
      await new Promise<void>((res) => setTimeout(res, 500));
      i++;
    }
    runningRef.current = false;
    if (!stoppedRef.current) { setDone(true); setCurrentIndex(-1); }
  }, [speak, interviewer.id, waitUntilResumed]);

  useEffect(() => {
    // On iOS, skip auto-start — user must tap Play to provide the gesture
    // that unlocks the AudioContext. On all other platforms, auto-start.
    if (detectsIOS()) return;
    const timer = setTimeout(() => { runScript(); }, 800);
    return () => { clearTimeout(timer); stoppedRef.current = true; stop(); };
  }, []);

  // ── Controls ──────────────────────────────────────────────────────────────

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
    pausedRef.current  = false;
    resumeResolveRef.current?.();
    resumeResolveRef.current = null;
    setStopped(true);
    setPaused(false);
    stop();
    setCurrentIndex(-1);
  }, [stop]);

  // handleStart: called by the Play button when the user hasn't started yet (iOS).
  // Must be called directly from a click handler so iOS treats it as a user gesture.
  const handleStart = useCallback(async () => {
    setWaitingForGesture(false);
    await unlockAudio();
    runScript();
  }, [unlockAudio, runScript]);

  const handleRestart = useCallback(async () => {
    setStopped(false);
    setPaused(false);
    setDone(false);
    setCurrentIndex(-1);
    await unlockAudio(); // Re-unlock in case AudioContext was suspended since last play
    runScript();
  }, [runScript, unlockAudio]);

  // Jump to a different section
  const seekToSection = useCallback((targetIndex: number) => {
    const script = scriptRef.current;
    if (targetIndex < 0 || targetIndex >= script.length) return;
    seekRef.current = targetIndex;
    setCurrentIndex(targetIndex);
    pausedRef.current = false;
    setPaused(false);
    resumeResolveRef.current?.();
    resumeResolveRef.current = null;
    stop();
  }, [stop]);

  const handleBack    = useCallback(() => seekToSection(Math.max(0, currentIndex - 1)), [seekToSection, currentIndex]);
  const handleForward = useCallback(() => {
    const s = scriptRef.current;
    if (currentIndex + 1 < s.length) seekToSection(currentIndex + 1);
  }, [seekToSection, currentIndex]);

  // ── Scrubber helpers ──────────────────────────────────────────────────────

  const displayTime  = dragTime !== null ? dragTime : audioCurrentTime;
  const maxTime      = audioDuration > 0 ? audioDuration : 1; // avoid div-by-zero
  const fillPct      = Math.min(100, (displayTime / maxTime) * 100);

  // ── Derived state ─────────────────────────────────────────────────────────

  const script            = scriptRef.current;
  const currentItem       = currentIndex >= 0 ? script[currentIndex] : null;
  const isActivelyPlaying = isSpeaking && !isPaused && !paused;

  return (
    <div className="print:hidden sticky top-[65px] z-20 bg-white border border-blue-200 rounded-2xl shadow-md overflow-hidden">
      <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4">

        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-blue-200 bg-slate-100">
            {interviewer.avatarUrl ? (
              <img src={interviewer.avatarUrl} alt={interviewer.name}
                className="w-full h-full object-cover object-top" />
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

        {/* Centre: section label + time scrubber */}
        <div className="flex-1 min-w-0">

          {/* Section label + status */}
          <div className="flex items-center gap-2 mb-1.5 min-w-0">
            <span className="text-sm font-semibold text-slate-900 shrink-0">{interviewer.name}</span>
            {done ? (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" /> Review complete
              </span>
            ) : stopped ? (
              <span className="text-xs text-slate-400 font-medium shrink-0">Stopped</span>
            ) : waitingForGesture ? (
              <span className="text-xs text-blue-500 font-medium shrink-0">Tap Play to hear your review</span>
            ) : paused ? (
              <ScrollingText className="text-xs text-amber-600 font-medium">Paused — {currentItem?.label}</ScrollingText>
            ) : (
              <ScrollingText className="text-xs text-blue-600 font-medium">
                {currentItem ? currentItem.label : "Preparing review…"}
              </ScrollingText>
            )}
          </div>

          {/* Scrubber */}
          {done ? (
            <p className="text-xs text-slate-400">Voice walkthrough complete — press Play again to replay.</p>
          ) : (
            <div className="flex items-center gap-2">
              <SpeakingWaveform active={isActivelyPlaying && dragTime === null} />

              {/* Time scrubber — drags freely within the current clip */}
              <input
                type="range"
                min={0}
                max={maxTime}
                step={0.05}
                value={displayTime}
                onChange={(e) => setDragTime(Number(e.target.value))}
                onPointerDown={(e) => setDragTime(Number((e.target as HTMLInputElement).value))}
                onPointerUp={(e) => {
                  const v = Number((e.target as HTMLInputElement).value);
                  setDragTime(null);
                  seekTime(v);
                }}
                className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer accent-blue-500"
                style={{
                  background: `linear-gradient(to right, #3b82f6 ${fillPct}%, #e2e8f0 ${fillPct}%)`,
                }}
              />

              {/* Time counter */}
              <span className="text-xs text-slate-400 shrink-0 tabular-nums">
                {formatTime(displayTime)}{audioDuration > 0 ? ` / ${formatTime(audioDuration)}` : ""}
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-0.5 shrink-0">
            <Button variant="ghost" size="icon"
              onClick={handleBack}
              disabled={stopped || done || waitingForGesture || currentIndex <= 0}
              className="cursor-pointer h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30"
              title="Previous section"
            >
              <SkipBack className="w-4 h-4" />
            </Button>

            {waitingForGesture ? (
              <Button variant="ghost" size="sm" onClick={handleStart}
                className="cursor-pointer text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1.5 px-1.5 sm:px-2">
                <Play className="w-3.5 h-3.5 fill-current" />
                <span className="text-xs hidden sm:inline">Play</span>
              </Button>
            ) : (stopped || done) ? (
              <Button variant="ghost" size="sm" onClick={handleRestart}
                className="cursor-pointer text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1.5 px-1.5 sm:px-2">
                <Play className="w-3.5 h-3.5 fill-current" />
                <span className="text-xs hidden sm:inline">Play again</span>
              </Button>
            ) : paused ? (
              <Button variant="ghost" size="sm" onClick={handleResume}
                className="cursor-pointer text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1.5 px-1.5 sm:px-2">
                <Play className="w-3.5 h-3.5 fill-current" />
                <span className="text-xs hidden sm:inline">Resume</span>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={handlePause}
                className="cursor-pointer text-slate-500 hover:text-slate-700 hover:bg-slate-100 gap-1.5 px-1.5 sm:px-2">
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span className="text-xs hidden sm:inline">Pause</span>
              </Button>
            )}

            <Button variant="ghost" size="icon"
              onClick={handleForward}
              disabled={stopped || done || waitingForGesture || currentIndex >= script.length - 1}
              className="cursor-pointer h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30"
              title="Next section"
            >
              <SkipForward className="w-4 h-4" />
            </Button>

            <Button variant="ghost" size="icon"
              onClick={handleStop}
              disabled={stopped || done || waitingForGesture}
              className="cursor-pointer h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30"
              title="Stop narration"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </Button>
          </div>
      </div>
    </div>
  );
}

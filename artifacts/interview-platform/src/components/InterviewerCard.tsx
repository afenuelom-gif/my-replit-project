import React, {
  forwardRef, useImperativeHandle, useCallback,
  useEffect,
} from "react";
import { Volume2 } from "lucide-react";
import { useElevenLabsTTS } from "@/hooks/useElevenLabsTTS";

export interface InterviewerCardHandle {
  speak: (text: string, gender?: "male" | "female") => Promise<void>;
  stop: () => void;
  destroy: () => void;
}

interface Interviewer {
  id: number;
  name: string;
  title: string;
  avatarUrl?: string | null;
  voiceId?: string;
}

interface InterviewerCardProps {
  interviewer: Interviewer;
  isActive: boolean;
  sessionId: number;
  onSpeakingChange?: (speaking: boolean) => void;
}

const WAVEFORM_HEIGHTS = [40, 70, 55, 85, 45, 75, 60, 90, 50, 65, 80, 48, 72];
const WAVEFORM_DELAYS  = [0, 0.15, 0.3, 0.1, 0.4, 0.25, 0.05, 0.35, 0.2, 0.45, 0.08, 0.28, 0.18];

function SpeakingWaveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-[3px] h-8 px-1">
      {WAVEFORM_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-primary/80 transition-all duration-100"
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

const InterviewerCard = forwardRef<InterviewerCardHandle, InterviewerCardProps>(
  ({ interviewer, isActive, sessionId, onSpeakingChange }, ref) => {
    const { speak: ttsSpeak, stop: ttsStop, isSpeaking: ttsSpeaking } = useElevenLabsTTS(sessionId);

    const isSpeakingNow = isActive && ttsSpeaking;

    useEffect(() => {
      onSpeakingChange?.(isSpeakingNow);
    }, [isSpeakingNow]);

    const speak = useCallback(async (text: string) => {
      await ttsSpeak(text, interviewer.id);
    }, [interviewer.id, ttsSpeak]);

    const stop = useCallback(() => {
      ttsStop();
    }, [ttsStop]);

    const destroy = useCallback(() => {
      ttsStop();
    }, [ttsStop]);

    useImperativeHandle(ref, () => ({ speak, stop, destroy }), [speak, stop, destroy]);

    return (
      <div
        className={`relative rounded-xl overflow-hidden bg-zinc-900 border-2 transition-all duration-300 min-h-48 ${
          isSpeakingNow
            ? "border-primary shadow-[0_0_18px_2px_rgba(99,102,241,0.35)]"
            : isActive
            ? "border-primary/40"
            : "border-white/5"
        }`}
      >
        <div className="relative w-full h-full min-h-48">
          {interviewer.avatarUrl ? (
            <img
              src={interviewer.avatarUrl}
              alt={interviewer.name}
              className={`w-full h-full object-cover min-h-48 absolute inset-0 transition-all duration-500 ${
                isActive ? "opacity-95" : "opacity-35"
              } ${isSpeakingNow ? "scale-[1.02]" : "scale-100"}`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950 min-h-48">
              <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-3xl font-bold text-white/30 border border-white/10">
                {interviewer.name.charAt(0)}
              </div>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

          {isSpeakingNow && (
            <div className="absolute bottom-14 left-0 right-0 flex justify-center pointer-events-none">
              <div className="bg-black/60 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-3 border border-white/10">
                <Volume2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <SpeakingWaveform active={ttsSpeaking} />
              </div>
            </div>
          )}
        </div>

        {isSpeakingNow && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 border border-primary/40 rounded-md px-2 py-1 backdrop-blur-sm">
            <Volume2 className="w-3 h-3 text-primary" />
            <span className="text-xs text-primary">Speaking…</span>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pt-6 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-300 ${
                isSpeakingNow ? "bg-primary animate-pulse" : isActive ? "bg-primary/60" : "bg-zinc-600"
              }`}
            />
            <span className="font-semibold text-sm text-white">{interviewer.name}</span>
          </div>
          <p className="text-xs text-zinc-400 leading-tight">{interviewer.title}</p>
          {isActive ? (
            <p className="text-xs text-primary/50 mt-2">Active</p>
          ) : (
            <p className="text-xs text-zinc-700 mt-2">Waiting</p>
          )}
        </div>
      </div>
    );
  }
);

InterviewerCard.displayName = "InterviewerCard";

export default InterviewerCard;

import React, { forwardRef, useImperativeHandle, useCallback, useEffect } from "react";
import { useHeyGenAvatar } from "@/hooks/useHeyGenAvatar";

export interface InterviewerCardHandle {
  speak: (text: string) => Promise<void>;
  stop: () => Promise<void>;
  destroy: () => Promise<void>;
}

interface Interviewer {
  id: number;
  name: string;
  title: string;
  avatarUrl?: string | null;
  heygenAvatarId?: string | null;
}

interface InterviewerCardProps {
  interviewer: Interviewer;
  isActive: boolean;
  isTalkingTTS: boolean;
  onSpeakingChange?: (speaking: boolean) => void;
}

const InterviewerCard = forwardRef<InterviewerCardHandle, InterviewerCardProps>(
  ({ interviewer, isActive, isTalkingTTS, onSpeakingChange }, ref) => {
    const heygen = useHeyGenAvatar(interviewer.heygenAvatarId ?? null);

    const heygenActive = heygen.status === "connected" || heygen.status === "connecting";
    const isTalking = isTalkingTTS || (heygenActive && heygen.isSpeaking);

    // Propagate HeyGen speaking state changes to parent
    useEffect(() => {
      onSpeakingChange?.(heygen.isSpeaking);
    }, [heygen.isSpeaking]);

    const speak = useCallback(async (text: string) => {
      await heygen.speak(text);
    }, [heygen]);

    const stop = useCallback(async () => {
      await heygen.stop();
    }, [heygen]);

    const destroy = useCallback(async () => {
      await heygen.destroy();
    }, [heygen]);

    useImperativeHandle(ref, () => ({ speak, stop, destroy }), [speak, stop, destroy]);

    const showVideo = heygenActive && !!interviewer.heygenAvatarId;

    return (
      <div
        className={`relative rounded-xl overflow-hidden bg-zinc-900 border-2 transition-all duration-300 min-h-48 ${
          isTalking
            ? "border-primary scale-[1.03] shadow-[0_0_50px_rgba(0,195,255,0.55)]"
            : isActive
            ? "border-primary shadow-[0_0_30px_rgba(0,195,255,0.2)]"
            : "border-white/5"
        }`}
      >
        {/* HeyGen video stream */}
        <video
          ref={heygen.videoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover min-h-48 ${showVideo ? "block" : "hidden"}`}
        />

        {/* Static avatar fallback */}
        {!showVideo && (
          <>
            {interviewer.avatarUrl ? (
              <img
                src={interviewer.avatarUrl}
                alt={interviewer.name}
                className="w-full h-full object-cover min-h-48"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-7xl font-bold text-white/20 min-h-48">
                {interviewer.name.charAt(0)}
              </div>
            )}
          </>
        )}

        {/* HeyGen connecting indicator */}
        {heygen.status === "connecting" && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/70 px-2 py-1 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-xs text-yellow-300">Connecting</span>
          </div>
        )}

        {/* Name / info overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pt-6 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                isActive ? "bg-primary animate-pulse" : "bg-zinc-600"
              }`}
            />
            <span className="font-semibold text-sm text-white">{interviewer.name}</span>
          </div>
          <p className="text-xs text-zinc-400 leading-tight">{interviewer.title}</p>

          {isTalking ? (
            <div className="flex items-end gap-1 mt-2 h-8" aria-label="Speaking">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="w-1.5 bg-primary rounded-full animate-sound-bar origin-bottom"
                  style={{ height: `${14 + (i % 4) * 6}px`, animationDelay: `${i * 0.08}s` }}
                />
              ))}
              <span className="text-xs text-primary ml-2 font-semibold tracking-wide">
                Speaking…
              </span>
            </div>
          ) : isActive ? (
            <p className="text-xs text-primary/60 mt-2">Active</p>
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

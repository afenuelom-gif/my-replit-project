import React, { forwardRef, useImperativeHandle, useCallback, useEffect } from "react";
import { useHeyGenAvatar } from "@/hooks/useHeyGenAvatar";
import { AlertTriangle } from "lucide-react";

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
  onSpeakingChange?: (speaking: boolean) => void;
}

const InterviewerCard = forwardRef<InterviewerCardHandle, InterviewerCardProps>(
  ({ interviewer, isActive, onSpeakingChange }, ref) => {
    const heygen = useHeyGenAvatar(interviewer.heygenAvatarId ?? null);

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

    const isConnected = heygen.status === "connected";
    const isConnecting = heygen.status === "connecting";
    const isError = heygen.status === "error";
    const isSpeaking = heygen.isSpeaking;

    return (
      <div
        className={`relative rounded-xl overflow-hidden bg-zinc-900 border-2 transition-colors duration-300 min-h-48 ${
          isConnected && isSpeaking
            ? "border-primary shadow-[0_0_30px_rgba(0,195,255,0.35)]"
            : isActive
            ? "border-primary/60"
            : "border-white/5"
        }`}
      >
        {/* HeyGen video stream */}
        <video
          ref={heygen.videoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover min-h-48 ${isConnected ? "block" : "hidden"}`}
        />

        {/* Dark placeholder while idle / connecting / error (no static photo) */}
        {!isConnected && (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950 min-h-48 gap-3">
            <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-3xl font-bold text-white/30 border border-white/10">
              {interviewer.name.charAt(0)}
            </div>

            {isConnecting && (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-xs text-yellow-300/80">Connecting avatar…</span>
              </div>
            )}

            {isError && (
              <div className="flex items-center gap-1.5 text-xs text-red-400/80">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Avatar unavailable</span>
              </div>
            )}

            {!isConnecting && !isError && (
              <span className="text-xs text-zinc-600">Initializing…</span>
            )}
          </div>
        )}

        {/* Name / info overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pt-6 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-300 ${
                isConnected && isSpeaking
                  ? "bg-primary"
                  : isActive
                  ? "bg-primary/60"
                  : "bg-zinc-600"
              }`}
            />
            <span className="font-semibold text-sm text-white">{interviewer.name}</span>
          </div>
          <p className="text-xs text-zinc-400 leading-tight">{interviewer.title}</p>

          {isConnected && isSpeaking ? (
            <p className="text-xs text-primary mt-2 font-medium">Speaking</p>
          ) : isActive ? (
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

import React, { forwardRef, useImperativeHandle, useCallback, useEffect, useRef } from "react";
import { AlertTriangle, Clapperboard, Loader2, Play } from "lucide-react";
import { useHeyGenVideo } from "@/hooks/useHeyGenVideo";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";

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
  heygenAvatarId?: string | null;
  voiceId?: string;
}

interface InterviewerCardProps {
  interviewer: Interviewer;
  isActive: boolean;
  onSpeakingChange?: (speaking: boolean) => void;
}

const FEMALE_VOICES = new Set(["nova", "shimmer"]);

const InterviewerCard = forwardRef<InterviewerCardHandle, InterviewerCardProps>(
  ({ interviewer, isActive, onSpeakingChange }, ref) => {
    const heygenVideo = useHeyGenVideo();
    const { speak: ttsSpeak, stop: ttsStop, isSpeaking: ttsSpeaking } = useSpeechSynthesis();
    const videoElRef = useRef<HTMLVideoElement | null>(null);
    const activeTextRef = useRef<string | null>(null);

    const gender: "male" | "female" = FEMALE_VOICES.has(interviewer.voiceId ?? "") ? "female" : "male";

    // Auto-play video when it becomes ready, only if this question is still active
    useEffect(() => {
      if (heygenVideo.status === "ready" && heygenVideo.videoUrl && videoElRef.current) {
        videoElRef.current.src = heygenVideo.videoUrl;
        videoElRef.current.play().catch(() => {});
      }
    }, [heygenVideo.status, heygenVideo.videoUrl]);

    // Propagate speaking state (TTS speaking as proxy since video fires its own events)
    useEffect(() => {
      onSpeakingChange?.(ttsSpeaking);
    }, [ttsSpeaking]);

    const speak = useCallback(async (text: string) => {
      // Always play TTS immediately for instant audio
      ttsSpeak(text, interviewer.voiceId);
      // Fire off background video generation if HeyGen is configured (non-blocking)
      if (interviewer.heygenAvatarId) {
        activeTextRef.current = text;
        heygenVideo.generate(interviewer.id, text, gender);
      }
    }, [interviewer.id, interviewer.heygenAvatarId, interviewer.voiceId, gender, heygenVideo, ttsSpeak]);

    const stop = useCallback(() => {
      ttsStop();
      if (videoElRef.current) {
        videoElRef.current.pause();
      }
    }, [ttsStop]);

    const destroy = useCallback(() => {
      ttsStop();
      heygenVideo.reset();
      if (videoElRef.current) {
        videoElRef.current.pause();
        videoElRef.current.src = "";
      }
      activeTextRef.current = null;
    }, [ttsStop, heygenVideo]);

    useImperativeHandle(ref, () => ({ speak, stop, destroy }), [speak, stop, destroy]);

    const hasVideo = heygenVideo.status === "ready" && !!heygenVideo.videoUrl;
    const isGenerating = heygenVideo.status === "generating";

    return (
      <div
        className={`relative rounded-xl overflow-hidden bg-zinc-900 border-2 transition-colors duration-300 min-h-48 ${
          isActive
            ? "border-primary/60"
            : "border-white/5"
        }`}
      >
        {/* Pre-generated HeyGen video */}
        <video
          ref={videoElRef}
          playsInline
          controls={hasVideo}
          className={`w-full h-full object-cover min-h-48 ${hasVideo ? "block" : "hidden"}`}
        />

        {/* Dark placeholder while video is not yet ready */}
        {!hasVideo && (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950 min-h-48 gap-3">
            <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-3xl font-bold text-white/30 border border-white/10">
              {interviewer.name.charAt(0)}
            </div>

            {isGenerating && (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                <span className="text-xs text-primary/80">Generating video…</span>
              </div>
            )}

            {heygenVideo.status === "error" && (
              <div className="flex items-center gap-1.5 text-xs text-red-400/80">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Video unavailable</span>
              </div>
            )}

            {heygenVideo.status === "idle" && (
              <span className="text-xs text-zinc-600">Waiting…</span>
            )}
          </div>
        )}

        {/* "Video ready" badge shown briefly over the video */}
        {hasVideo && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 border border-primary/30 rounded-md px-2 py-1 backdrop-blur-sm">
            <Play className="w-3 h-3 text-primary" />
            <span className="text-xs text-primary">Video ready</span>
          </div>
        )}

        {/* Generating badge shown in top-right while generating */}
        {isGenerating && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 border border-yellow-700/40 rounded-md px-2 py-1 backdrop-blur-sm">
            <Clapperboard className="w-3 h-3 text-yellow-400 animate-pulse" />
            <span className="text-xs text-yellow-300">Generating…</span>
          </div>
        )}

        {/* Name / info overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pt-6 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-300 ${
                isActive ? "bg-primary/60" : "bg-zinc-600"
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

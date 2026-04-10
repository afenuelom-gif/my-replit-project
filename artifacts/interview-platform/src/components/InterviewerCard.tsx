import React, { forwardRef, useImperativeHandle, useCallback, useEffect, useRef } from "react";
import { Clapperboard, Loader2, Play, Radio } from "lucide-react";
import { useHeyGenVideo } from "@/hooks/useHeyGenVideo";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import type { DIDStreamStatus } from "@/hooks/useDIDStream";

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
  didMediaStream?: MediaStream | null;
  didStatus?: DIDStreamStatus;
}

const FEMALE_VOICES = new Set(["nova", "shimmer"]);
const DID_ENABLED = import.meta.env.VITE_DID_ENABLED === "true";

const InterviewerCard = forwardRef<InterviewerCardHandle, InterviewerCardProps>(
  ({ interviewer, isActive, onSpeakingChange, didMediaStream, didStatus }, ref) => {
    const gender: "male" | "female" = FEMALE_VOICES.has(interviewer.voiceId ?? "") ? "female" : "male";

    const heygenVideo = useHeyGenVideo();
    const { speak: ttsSpeak, stop: ttsStop, isSpeaking: ttsSpeaking } = useSpeechSynthesis();

    const heygenVideoRef = useRef<HTMLVideoElement | null>(null);
    const didVideoRef = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
      onSpeakingChange?.(ttsSpeaking);
    }, [ttsSpeaking]);

    useEffect(() => {
      if (!DID_ENABLED || !didVideoRef.current) return;
      if (isActive && didMediaStream) {
        didVideoRef.current.srcObject = didMediaStream;
        didVideoRef.current.play().catch(() => {});
      } else {
        didVideoRef.current.srcObject = null;
      }
    }, [isActive, didMediaStream]);

    useEffect(() => {
      if (!DID_ENABLED && heygenVideo.status === "ready" && heygenVideo.videoUrl && heygenVideoRef.current) {
        heygenVideoRef.current.src = heygenVideo.videoUrl;
        heygenVideoRef.current.play().catch(() => {});
      }
    }, [heygenVideo.status, heygenVideo.videoUrl]);

    const speak = useCallback(async (text: string) => {
      ttsSpeak(text, interviewer.voiceId);

      if (!DID_ENABLED && interviewer.heygenAvatarId) {
        heygenVideo.generate(interviewer.id, text, gender);
      }
    }, [
      interviewer.id,
      interviewer.heygenAvatarId,
      interviewer.voiceId,
      gender,
      heygenVideo,
      ttsSpeak,
    ]);

    const stop = useCallback(() => {
      ttsStop();
      if (heygenVideoRef.current) heygenVideoRef.current.pause();
      if (didVideoRef.current) didVideoRef.current.pause();
    }, [ttsStop]);

    const destroy = useCallback(() => {
      ttsStop();
      heygenVideo.reset();
      if (heygenVideoRef.current) {
        heygenVideoRef.current.pause();
        heygenVideoRef.current.src = "";
      }
      if (didVideoRef.current) {
        didVideoRef.current.pause();
        didVideoRef.current.srcObject = null;
      }
    }, [ttsStop, heygenVideo]);

    useImperativeHandle(ref, () => ({ speak, stop, destroy }), [speak, stop, destroy]);

    // Only show the live video once ICE is fully connected (markReady set status to "ready"/"speaking")
    const didReady = DID_ENABLED && isActive && !!didMediaStream &&
      (didStatus === "ready" || didStatus === "speaking");
    // Show connecting spinner while ICE is still negotiating
    const didConnecting = DID_ENABLED && isActive && !didReady &&
      (didStatus === "connecting" || didStatus === "connected");

    const heygenHasVideo = !DID_ENABLED && heygenVideo.status === "ready" && !!heygenVideo.videoUrl;
    const heygenGenerating = !DID_ENABLED && heygenVideo.status === "generating";

    const showVideoArea = didReady || heygenHasVideo;

    return (
      <div
        className={`relative rounded-xl overflow-hidden bg-zinc-900 border-2 transition-colors duration-300 min-h-48 ${
          isActive ? "border-primary/60" : "border-white/5"
        }`}
      >
        {DID_ENABLED && (
          <video
            ref={didVideoRef}
            playsInline
            muted
            autoPlay
            className={`w-full h-full object-cover min-h-48 ${didReady ? "block" : "hidden"}`}
          />
        )}

        {!DID_ENABLED && (
          <video
            ref={heygenVideoRef}
            playsInline
            controls={heygenHasVideo}
            className={`w-full h-full object-cover min-h-48 ${heygenHasVideo ? "block" : "hidden"}`}
          />
        )}

        {!showVideoArea && (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950 min-h-48 gap-3">
            <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-3xl font-bold text-white/30 border border-white/10">
              {interviewer.name.charAt(0)}
            </div>

            {didConnecting && isActive && (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                <span className="text-xs text-primary/80">Connecting stream…</span>
              </div>
            )}

            {DID_ENABLED && !(didConnecting && isActive) && (
              <span className="text-xs text-zinc-600">Waiting…</span>
            )}

            {heygenGenerating && (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                <span className="text-xs text-primary/80">Generating video…</span>
              </div>
            )}

            {!DID_ENABLED && !heygenGenerating && (
              <span className="text-xs text-zinc-600">Waiting…</span>
            )}
          </div>
        )}

        {didReady && isActive && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 border border-green-700/40 rounded-md px-2 py-1 backdrop-blur-sm">
            <Radio className="w-3 h-3 text-green-400 animate-pulse" />
            <span className="text-xs text-green-300">Live</span>
          </div>
        )}

        {didConnecting && isActive && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 border border-primary/30 rounded-md px-2 py-1 backdrop-blur-sm">
            <Loader2 className="w-3 h-3 text-primary animate-spin" />
            <span className="text-xs text-primary">Connecting…</span>
          </div>
        )}

        {heygenHasVideo && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 border border-primary/30 rounded-md px-2 py-1 backdrop-blur-sm">
            <Play className="w-3 h-3 text-primary" />
            <span className="text-xs text-primary">Video ready</span>
          </div>
        )}

        {heygenGenerating && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 border border-yellow-700/40 rounded-md px-2 py-1 backdrop-blur-sm">
            <Clapperboard className="w-3 h-3 text-yellow-400 animate-pulse" />
            <span className="text-xs text-yellow-300">Generating…</span>
          </div>
        )}

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

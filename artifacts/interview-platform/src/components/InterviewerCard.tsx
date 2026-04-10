import React, { forwardRef, useImperativeHandle, useCallback, useEffect, useRef } from "react";
import { Clapperboard, Loader2, Play, Radio, Volume2 } from "lucide-react";
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
            animationDelay: `${WAVEFORM_DELAYS[i]}s`,
            animation: active ? `waveform 0.8s ease-in-out ${WAVEFORM_DELAYS[i]}s infinite alternate` : "none",
            opacity: active ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
}

const InterviewerCard = forwardRef<InterviewerCardHandle, InterviewerCardProps>(
  ({ interviewer, isActive, onSpeakingChange, didMediaStream, didStatus }, ref) => {
    const gender: "male" | "female" = FEMALE_VOICES.has(interviewer.voiceId ?? "") ? "female" : "male";

    const heygenVideo = useHeyGenVideo();
    const { speak: ttsSpeak, stop: ttsStop, isSpeaking: ttsSpeaking } = useSpeechSynthesis();

    const heygenVideoRef = useRef<HTMLVideoElement | null>(null);
    const didVideoRef = useRef<HTMLVideoElement | null>(null);

    useEffect(() => { onSpeakingChange?.(ttsSpeaking); }, [ttsSpeaking]);

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
    }, [interviewer.id, interviewer.heygenAvatarId, interviewer.voiceId, gender, heygenVideo, ttsSpeak]);

    const stop = useCallback(() => {
      ttsStop();
      if (heygenVideoRef.current) heygenVideoRef.current.pause();
      if (didVideoRef.current) didVideoRef.current.pause();
    }, [ttsStop]);

    const destroy = useCallback(() => {
      ttsStop();
      heygenVideo.reset();
      if (heygenVideoRef.current) { heygenVideoRef.current.pause(); heygenVideoRef.current.src = ""; }
      if (didVideoRef.current) { didVideoRef.current.pause(); didVideoRef.current.srcObject = null; }
    }, [ttsStop, heygenVideo]);

    useImperativeHandle(ref, () => ({ speak, stop, destroy }), [speak, stop, destroy]);

    const didReady = DID_ENABLED && isActive && !!didMediaStream &&
      (didStatus === "ready" || didStatus === "speaking");
    const didConnecting = DID_ENABLED && isActive && !didReady &&
      (didStatus === "connecting" || didStatus === "connected");
    const didFailed = DID_ENABLED && didStatus === "error";

    const heygenHasVideo = !DID_ENABLED && heygenVideo.status === "ready" && !!heygenVideo.videoUrl;
    const heygenGenerating = !DID_ENABLED && heygenVideo.status === "generating";

    const showVideoArea = didReady || heygenHasVideo;

    const isSpeakingNow = isActive && ttsSpeaking;

    return (
      <div
        className={`relative rounded-xl overflow-hidden bg-zinc-900 border-2 transition-all duration-300 min-h-48 ${
          isSpeakingNow
            ? "border-primary shadow-[0_0_18px_2px_rgba(var(--primary-rgb,99,102,241),0.35)]"
            : isActive
            ? "border-primary/40"
            : "border-white/5"
        }`}
      >
        {/* D-ID live WebRTC video */}
        {DID_ENABLED && (
          <video
            ref={didVideoRef}
            playsInline
            muted
            autoPlay
            className={`w-full h-full object-cover min-h-48 ${didReady ? "block" : "hidden"}`}
          />
        )}

        {/* HeyGen pre-generated video */}
        {!DID_ENABLED && (
          <video
            ref={heygenVideoRef}
            playsInline
            controls={heygenHasVideo}
            className={`w-full h-full object-cover min-h-48 ${heygenHasVideo ? "block" : "hidden"}`}
          />
        )}

        {/* Photo + animation fallback */}
        {!showVideoArea && (
          <div className="relative w-full h-full min-h-48">
            {interviewer.avatarUrl ? (
              <img
                src={interviewer.avatarUrl}
                alt={interviewer.name}
                className={`w-full h-full object-cover min-h-48 absolute inset-0 transition-all duration-500 ${
                  isActive ? "opacity-95" : "opacity-35"
                } ${isSpeakingNow ? "scale-[1.02]" : "scale-100"}`}
                style={{ transition: "opacity 0.4s, transform 0.4s" }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950 min-h-48">
                <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-3xl font-bold text-white/30 border border-white/10">
                  {interviewer.name.charAt(0)}
                </div>
              </div>
            )}

            {/* Subtle dark vignette overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

            {/* Speaking waveform at bottom when TTS is active */}
            {isSpeakingNow && (
              <div className="absolute bottom-14 left-0 right-0 flex justify-center pointer-events-none">
                <div className="bg-black/60 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-3 border border-white/10">
                  <Volume2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <SpeakingWaveform active={isSpeakingNow} />
                </div>
              </div>
            )}

            {/* Connecting overlay */}
            {didConnecting && isActive && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex items-center gap-2 bg-black/70 rounded-full px-4 py-2 backdrop-blur-sm border border-white/10">
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                  <span className="text-xs text-primary/90">Connecting stream…</span>
                </div>
              </div>
            )}

            {heygenGenerating && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex items-center gap-2 bg-black/70 rounded-full px-4 py-2 backdrop-blur-sm border border-white/10">
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                  <span className="text-xs text-primary/90">Generating video…</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status badges — top right */}
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

        {didFailed && isActive && !isSpeakingNow && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 border border-amber-700/40 rounded-md px-2 py-1 backdrop-blur-sm">
            <Radio className="w-3 h-3 text-amber-400" />
            <span className="text-xs text-amber-300">Voice only</span>
          </div>
        )}

        {isSpeakingNow && !didReady && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 border border-primary/40 rounded-md px-2 py-1 backdrop-blur-sm">
            <Volume2 className="w-3 h-3 text-primary" />
            <span className="text-xs text-primary">Speaking…</span>
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

        {/* Name / title bar */}
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

import React, {
  forwardRef, useImperativeHandle, useCallback,
  useEffect, useRef, useState,
} from "react";
import { Clapperboard, Loader2, Play, Radio, Volume2 } from "lucide-react";
import { useHeyGenVideo } from "@/hooks/useHeyGenVideo";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { useDIDTalks } from "@/hooks/useDIDTalks";
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
  /** @deprecated D-ID Talk Streams WebRTC (kept for future use) */
  didMediaStream?: MediaStream | null;
  /** @deprecated D-ID Talk Streams WebRTC (kept for future use) */
  didStatus?: DIDStreamStatus;
}

const FEMALE_VOICES = new Set(["nova", "shimmer"]);
const DID_ENABLED = import.meta.env.VITE_DID_ENABLED === "true";

/** Staggered animated waveform bars driven by CSS keyframes */
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
  ({ interviewer, isActive, onSpeakingChange }, ref) => {
    const gender: "male" | "female" = FEMALE_VOICES.has(interviewer.voiceId ?? "") ? "female" : "male";

    const heygenVideo = useHeyGenVideo();
    const { speak: ttsSpeak, stop: ttsStop, isSpeaking: ttsSpeaking } = useSpeechSynthesis();
    const didTalks = useDIDTalks();

    const heygenVideoRef  = useRef<HTMLVideoElement | null>(null);
    const didTalksVideoRef = useRef<HTMLVideoElement | null>(null);

    const [didVideoPlaying, setDidVideoPlaying] = useState(false);

    // Aggregate speaking state: TTS is playing OR D-ID video is generating/playing
    const didBusy = DID_ENABLED && (
      didTalks.status === "generating" ||
      didTalks.status === "ready" ||
      didVideoPlaying
    );
    const isSpeakingNow = isActive && (ttsSpeaking || didBusy);

    useEffect(() => {
      onSpeakingChange?.(isSpeakingNow);
    }, [isSpeakingNow]);

    // Auto-play D-ID Talks video when URL becomes available
    useEffect(() => {
      if (!DID_ENABLED || !didTalks.videoUrl || !didTalksVideoRef.current) return;
      const vid = didTalksVideoRef.current;
      vid.src = didTalks.videoUrl;

      // Stop TTS so only the D-ID audio plays (prevents double audio)
      ttsStop();

      vid.load();
      vid.play().catch(err => {
        console.error("[D-ID Talks] Video play error:", err);
        // If autoplay blocked, TTS already covered the audio — just reset
        didTalks.reset();
        setDidVideoPlaying(false);
      });
    }, [didTalks.videoUrl]);

    // HeyGen video auto-play
    useEffect(() => {
      if (!DID_ENABLED && heygenVideo.status === "ready" && heygenVideo.videoUrl && heygenVideoRef.current) {
        heygenVideoRef.current.src = heygenVideo.videoUrl;
        heygenVideoRef.current.play().catch(() => {});
      }
    }, [heygenVideo.status, heygenVideo.videoUrl]);

    const speak = useCallback(async (text: string) => {
      if (DID_ENABLED) {
        // Start TTS immediately for instant audio while D-ID video generates
        ttsSpeak(text, interviewer.voiceId);
        // Kick off D-ID Talks generation in parallel
        didTalks.generate(text, gender);
      } else {
        // Legacy: TTS + optional HeyGen clip
        ttsSpeak(text, interviewer.voiceId);
        if (interviewer.heygenAvatarId) {
          heygenVideo.generate(interviewer.id, text, gender);
        }
      }
    }, [
      interviewer.id, interviewer.heygenAvatarId, interviewer.voiceId,
      gender, heygenVideo, ttsSpeak, didTalks,
    ]);

    const stop = useCallback(() => {
      ttsStop();
      didTalks.reset();
      setDidVideoPlaying(false);
      if (heygenVideoRef.current) heygenVideoRef.current.pause();
      if (didTalksVideoRef.current) {
        didTalksVideoRef.current.pause();
        didTalksVideoRef.current.src = "";
      }
    }, [ttsStop, didTalks]);

    const destroy = useCallback(() => {
      ttsStop();
      didTalks.reset();
      setDidVideoPlaying(false);
      heygenVideo.reset();
      if (heygenVideoRef.current) { heygenVideoRef.current.pause(); heygenVideoRef.current.src = ""; }
      if (didTalksVideoRef.current) { didTalksVideoRef.current.pause(); didTalksVideoRef.current.src = ""; }
    }, [ttsStop, didTalks, heygenVideo]);

    useImperativeHandle(ref, () => ({ speak, stop, destroy }), [speak, stop, destroy]);

    const heygenHasVideo  = !DID_ENABLED && heygenVideo.status === "ready" && !!heygenVideo.videoUrl;
    const heygenGenerating = !DID_ENABLED && heygenVideo.status === "generating";

    const didVideoVisible  = DID_ENABLED && didTalks.status === "ready" && !!didTalks.videoUrl;
    const didGenerating    = DID_ENABLED && didTalks.status === "generating";

    const showPhotoFallback = !didVideoVisible && !heygenHasVideo;

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
        {/* ── D-ID Talks generated video ───────────────────────────── */}
        {DID_ENABLED && (
          <video
            ref={didTalksVideoRef}
            playsInline
            className={`w-full h-full object-cover min-h-48 ${didVideoVisible ? "block" : "hidden"}`}
            onPlay={() => setDidVideoPlaying(true)}
            onEnded={() => {
              setDidVideoPlaying(false);
              didTalks.reset();
            }}
            onError={() => {
              setDidVideoPlaying(false);
              didTalks.reset();
            }}
          />
        )}

        {/* ── HeyGen legacy video ───────────────────────────────────── */}
        {!DID_ENABLED && (
          <video
            ref={heygenVideoRef}
            playsInline
            controls={heygenHasVideo}
            className={`w-full h-full object-cover min-h-48 ${heygenHasVideo ? "block" : "hidden"}`}
          />
        )}

        {/* ── Photo + animated fallback ─────────────────────────────── */}
        {showPhotoFallback && (
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

            {/* Dark vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

            {/* Waveform overlay while TTS is playing */}
            {isSpeakingNow && !didGenerating && (
              <div className="absolute bottom-14 left-0 right-0 flex justify-center pointer-events-none">
                <div className="bg-black/60 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-3 border border-white/10">
                  <Volume2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <SpeakingWaveform active={ttsSpeaking} />
                </div>
              </div>
            )}

            {/* D-ID video generating spinner */}
            {didGenerating && isActive && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <span className="text-xs text-primary/80 font-medium">Rendering avatar…</span>
                </div>
              </div>
            )}

            {/* HeyGen generating */}
            {heygenGenerating && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <span className="text-xs text-primary/80 font-medium">Generating video…</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Status badges ─────────────────────────────────────────── */}
        {didVideoVisible && didVideoPlaying && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 border border-green-700/40 rounded-md px-2 py-1 backdrop-blur-sm">
            <Radio className="w-3 h-3 text-green-400 animate-pulse" />
            <span className="text-xs text-green-300">Live avatar</span>
          </div>
        )}

        {didGenerating && isActive && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 border border-primary/30 rounded-md px-2 py-1 backdrop-blur-sm">
            <Loader2 className="w-3 h-3 text-primary animate-spin" />
            <span className="text-xs text-primary">Rendering…</span>
          </div>
        )}

        {isSpeakingNow && !didVideoVisible && !didGenerating && (
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

        {/* ── Name / title bar ──────────────────────────────────────── */}
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

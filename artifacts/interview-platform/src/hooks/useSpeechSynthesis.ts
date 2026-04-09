import { useEffect, useRef, useState, useCallback } from "react";

const VOICE_PROFILES: Record<string, { pitch: number; rate: number }> = {
  nova:    { pitch: 1.1,  rate: 1.0  },
  onyx:    { pitch: 0.8,  rate: 0.95 },
  alloy:   { pitch: 1.0,  rate: 1.05 },
  echo:    { pitch: 0.9,  rate: 1.0  },
  shimmer: { pitch: 1.2,  rate: 1.1  },
  fable:   { pitch: 0.85, rate: 0.9  },
};

const VOICE_ORDER = ["nova", "onyx", "alloy", "echo", "shimmer", "fable"] as const;

export function useSpeechSynthesis() {
  const isSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!isSupported) return;
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, [isSupported]);

  useEffect(() => {
    return () => {
      if (isSupported) window.speechSynthesis.cancel();
    };
  }, [isSupported]);

  const speak = useCallback(
    (text: string, voiceId?: string) => {
      if (!isSupported) return;

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const profile = VOICE_PROFILES[voiceId ?? "alloy"] ?? VOICE_PROFILES.alloy;
      utterance.pitch = profile.pitch;
      utterance.rate = profile.rate;
      utterance.volume = 1;

      const voices = voicesRef.current;
      const englishVoices = voices.filter((v) => v.lang.startsWith("en"));
      if (englishVoices.length > 0) {
        const idx = VOICE_ORDER.indexOf(voiceId as (typeof VOICE_ORDER)[number]);
        const voiceIndex = idx >= 0 ? idx : 0;
        utterance.voice = englishVoices[voiceIndex % englishVoices.length];
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [isSupported]
  );

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  return { speak, stop, isSpeaking, isSupported };
}

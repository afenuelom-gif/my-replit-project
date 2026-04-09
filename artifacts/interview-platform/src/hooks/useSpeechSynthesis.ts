import { useEffect, useRef, useState, useCallback } from "react";

const VOICE_PROFILES: Record<string, { pitch: number; rate: number }> = {
  nova:    { pitch: 1.15, rate: 1.0  },
  onyx:    { pitch: 0.8,  rate: 0.95 },
  alloy:   { pitch: 0.95, rate: 1.0  },
  echo:    { pitch: 0.88, rate: 1.0  },
  shimmer: { pitch: 1.25, rate: 1.05 },
  fable:   { pitch: 0.85, rate: 0.9  },
};

const FEMALE_VOICE_IDS = new Set(["nova", "shimmer"]);

const FEMALE_NAME_RE = /\b(samantha|karen|victoria|moira|fiona|tessa|allison|ava|susan|zira|evelyn|jessica|lisa|kate|emily|sarah|alice|google us english female|microsoft zira|siri\s*female)\b/i;
const MALE_NAME_RE   = /\b(alex|daniel|oliver|tom|fred|david|mark|james|ralph|bruce|junior|google us english male|microsoft david|microsoft mark|microsoft james)\b/i;

function pickBrowserVoice(englishVoices: SpeechSynthesisVoice[], wantFemale: boolean): SpeechSynthesisVoice | null {
  if (englishVoices.length === 0) return null;

  const preferredRe = wantFemale ? FEMALE_NAME_RE : MALE_NAME_RE;
  const avoidRe     = wantFemale ? MALE_NAME_RE   : FEMALE_NAME_RE;

  const match = englishVoices.find(v => preferredRe.test(v.name));
  if (match) return match;

  const notOpposite = englishVoices.find(v => !avoidRe.test(v.name));
  if (notOpposite) return notOpposite;

  return englishVoices[0];
}

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
        const wantFemale = FEMALE_VOICE_IDS.has(voiceId ?? "");
        const chosen = pickBrowserVoice(englishVoices, wantFemale);
        if (chosen) utterance.voice = chosen;
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

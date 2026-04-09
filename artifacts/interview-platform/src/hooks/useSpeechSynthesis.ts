import { useEffect, useRef, useState, useCallback } from "react";

const VOICE_PROFILES: Record<string, { pitch: number; rate: number }> = {
  nova:    { pitch: 1.2,  rate: 1.0  },
  onyx:    { pitch: 0.78, rate: 0.95 },
  alloy:   { pitch: 0.95, rate: 1.0  },
  echo:    { pitch: 0.85, rate: 1.0  },
  shimmer: { pitch: 1.3,  rate: 1.05 },
  fable:   { pitch: 0.82, rate: 0.9  },
};

const FEMALE_VOICE_IDS = new Set(["nova", "shimmer"]);

const KNOWN_FEMALE_RE = /\b(samantha|karen|victoria|moira|fiona|tessa|allison|ava|susan|evelyn|jessica|lisa|kate|emily|sarah|alice|zira|siri)\b/i;
const KNOWN_MALE_RE   = /\b(alex|daniel|oliver|tom|fred|david|mark|james|ralph|bruce|junior)\b/i;

function pickBrowserVoice(
  englishVoices: SpeechSynthesisVoice[],
  wantFemale: boolean
): SpeechSynthesisVoice | null {
  if (englishVoices.length === 0) return null;

  if (wantFemale) {
    // 1. Explicit "female" keyword in voice name (e.g. "Google UK English Female")
    const explicit = englishVoices.find(v => /female/i.test(v.name));
    if (explicit) return explicit;
    // 2. Known female name
    const named = englishVoices.find(v => KNOWN_FEMALE_RE.test(v.name));
    if (named) return named;
    // 3. Avoid anything with "male" or a known male name
    const notMale = englishVoices.find(
      v => !/\bmale\b/i.test(v.name) && !KNOWN_MALE_RE.test(v.name)
    );
    return notMale ?? englishVoices[0];
  } else {
    // 1. Explicit "male" keyword (e.g. "Google UK English Male")
    const explicit = englishVoices.find(v => /\bmale\b/i.test(v.name));
    if (explicit) return explicit;
    // 2. Known male name
    const named = englishVoices.find(v => KNOWN_MALE_RE.test(v.name));
    if (named) return named;
    // 3. Avoid anything with "female" or a known female name
    const notFemale = englishVoices.find(
      v => !/female/i.test(v.name) && !KNOWN_FEMALE_RE.test(v.name)
    );
    return notFemale ?? englishVoices[0];
  }
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

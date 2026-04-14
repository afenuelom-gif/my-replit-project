import { useState, useRef, useCallback, useEffect, type MutableRefObject } from "react";

function browserFallbackSpeak(text: string): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!window.speechSynthesis) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

async function playWithNormalization(
  audio: HTMLAudioElement,
  audioCtxRef: MutableRefObject<AudioContext | null>
): Promise<() => void> {
  try {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
    }
    const audioCtx = audioCtxRef.current;
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }

    const source = audioCtx.createMediaElementSource(audio);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(1.15, audioCtx.currentTime);

    source.connect(gain);
    gain.connect(audioCtx.destination);

    await audio.play();

    const cleanup = () => {
      try { source.disconnect(); } catch { /* already disconnected */ }
      try { gain.disconnect(); } catch { /* already disconnected */ }
    };
    return cleanup;
  } catch (err) {
    console.warn("Web Audio API setup failed, falling back to plain play:", err);
    await audio.play();
    return () => {};
  }
}

export function useElevenLabsTTS(sessionId: number) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioCleanupRef = useRef<(() => void) | null>(null);
  const isBrowserTTSRef = useRef(false);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (audioCleanupRef.current) {
      audioCleanupRef.current();
      audioCleanupRef.current = null;
    }
    if (isBrowserTTSRef.current) {
      window.speechSynthesis?.cancel();
      isBrowserTTSRef.current = false;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string, interviewerId: number): Promise<void> => {
      stop();
      setIsSpeaking(true);
      isBrowserTTSRef.current = false;
      try {
        const res = await fetch(`/api/interview/sessions/${sessionId}/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, interviewerId }),
        });
        if (!res.ok) {
          console.warn(
            `ElevenLabs TTS unavailable (${res.status}), falling back to browser speech synthesis`
          );
          isBrowserTTSRef.current = true;
          await browserFallbackSpeak(text);
          isBrowserTTSRef.current = false;
          setIsSpeaking(false);
          return;
        }
        const { audioBase64, format } = (await res.json()) as {
          audioBase64: string;
          format: string;
        };
        const audio = new Audio(
          `data:audio/${format ?? "mpeg"};base64,${audioBase64}`
        );
        audioRef.current = audio;
        audio.onended = () => {
          audioCleanupRef.current?.();
          audioCleanupRef.current = null;
          audioRef.current = null;
          setIsSpeaking(false);
        };
        audio.onerror = () => {
          audioCleanupRef.current?.();
          audioCleanupRef.current = null;
          audioRef.current = null;
          setIsSpeaking(false);
        };
        audioCleanupRef.current = await playWithNormalization(audio, audioCtxRef);
      } catch (e) {
        console.warn("ElevenLabs TTS error, falling back to browser speech:", e);
        isBrowserTTSRef.current = true;
        await browserFallbackSpeak(text).catch(() => {});
        isBrowserTTSRef.current = false;
        setIsSpeaking(false);
      }
    },
    [sessionId, stop]
  );

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      audioCleanupRef.current?.();
      audioCleanupRef.current = null;
      if (isBrowserTTSRef.current) {
        window.speechSynthesis?.cancel();
      }
    };
  }, []);

  return { speak, stop, isSpeaking };
}

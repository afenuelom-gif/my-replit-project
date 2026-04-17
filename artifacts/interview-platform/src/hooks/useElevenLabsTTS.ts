import { useState, useRef, useCallback, useEffect } from "react";

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

export function useElevenLabsTTS(sessionId: number) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isBrowserTTSRef = useRef(false);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (isBrowserTTSRef.current) {
      window.speechSynthesis?.cancel();
      isBrowserTTSRef.current = false;
    }
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (isBrowserTTSRef.current) {
      window.speechSynthesis?.pause();
    }
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
    if (isBrowserTTSRef.current) {
      window.speechSynthesis?.resume();
    }
    setIsPaused(false);
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
        await new Promise<void>((resolve) => {
          const finish = () => {
            audioRef.current = null;
            setIsSpeaking(false);
            setIsPaused(false);
            resolve();
          };
          audio.onended = finish;
          audio.onerror = finish;

          const startPlay = () => audio.play().catch(finish);

          if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
            startPlay();
          } else {
            audio.addEventListener("canplaythrough", startPlay, { once: true });
          }
        });
      } catch (e) {
        console.warn("ElevenLabs TTS error, falling back to browser speech:", e);
        isBrowserTTSRef.current = true;
        await browserFallbackSpeak(text).catch(() => {});
        isBrowserTTSRef.current = false;
        setIsSpeaking(false);
        setIsPaused(false);
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
      if (isBrowserTTSRef.current) {
        window.speechSynthesis?.cancel();
      }
    };
  }, []);

  return { speak, stop, pause, resume, isSpeaking, isPaused };
}

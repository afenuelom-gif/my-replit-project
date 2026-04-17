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
  const [isSpeaking, setIsSpeaking]         = useState(false);
  const [isPaused, setIsPaused]             = useState(false);
  const [audioCurrentTime, setCurrentTime]  = useState(0);
  const [audioDuration, setDuration]        = useState(0);

  const audioRef                = useRef<HTMLAudioElement | null>(null);
  const isBrowserTTSRef         = useRef(false);
  const resolveCurrentSpeakRef  = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    resolveCurrentSpeakRef.current?.();
    resolveCurrentSpeakRef.current = null;

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
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    if (isBrowserTTSRef.current) window.speechSynthesis?.pause();
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current) audioRef.current.play().catch(() => {});
    if (isBrowserTTSRef.current) window.speechSynthesis?.resume();
    setIsPaused(false);
  }, []);

  // Seek within the currently playing audio clip
  const seekTime = useCallback((seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(seconds, audioRef.current.duration || 0));
    }
  }, []);

  const speak = useCallback(
    async (text: string, interviewerId: number): Promise<void> => {
      stop();
      setIsSpeaking(true);
      setCurrentTime(0);
      setDuration(0);
      isBrowserTTSRef.current = false;
      try {
        const res = await fetch(`/api/interview/sessions/${sessionId}/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, interviewerId }),
        });
        if (!res.ok) {
          console.warn(`ElevenLabs TTS unavailable (${res.status}), falling back to browser TTS`);
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
        const audio = new Audio(`data:audio/${format ?? "mpeg"};base64,${audioBase64}`);
        audioRef.current = audio;

        audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
        audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime));

        await new Promise<void>((resolve) => {
          resolveCurrentSpeakRef.current = resolve;
          const finish = () => {
            resolveCurrentSpeakRef.current = null;
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
      resolveCurrentSpeakRef.current?.();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (isBrowserTTSRef.current) window.speechSynthesis?.cancel();
    };
  }, []);

  return { speak, stop, pause, resume, seekTime, isSpeaking, isPaused, audioCurrentTime, audioDuration };
}

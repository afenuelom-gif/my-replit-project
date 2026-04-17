import { useState, useRef, useCallback, useEffect } from "react";

function browserFallbackSpeak(text: string, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!window.speechSynthesis) { resolve(); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    signal.addEventListener("abort", () => {
      window.speechSynthesis?.cancel();
      resolve();
    }, { once: true });
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
  const fetchAbortRef           = useRef<AbortController | null>(null);
  const destroyedRef            = useRef(false);

  const stop = useCallback(() => {
    // Abort any in-flight TTS fetch
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = null;

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

  const seekTime = useCallback((seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(seconds, audioRef.current.duration || 0));
    }
  }, []);

  const speak = useCallback(
    async (text: string, interviewerId: number): Promise<void> => {
      stop();
      if (destroyedRef.current) return;

      setIsSpeaking(true);
      setCurrentTime(0);
      setDuration(0);
      isBrowserTTSRef.current = false;

      const controller = new AbortController();
      fetchAbortRef.current = controller;

      try {
        const res = await fetch(`/api/interview/sessions/${sessionId}/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, interviewerId }),
          signal: controller.signal,
        });

        // Guard: component may have unmounted while fetch was in-flight
        if (destroyedRef.current) return;
        fetchAbortRef.current = null;

        if (!res.ok) {
          console.warn(`ElevenLabs TTS unavailable (${res.status}), falling back to browser TTS`);
          isBrowserTTSRef.current = true;
          await browserFallbackSpeak(text, controller.signal);
          if (destroyedRef.current) return;
          isBrowserTTSRef.current = false;
          setIsSpeaking(false);
          return;
        }

        const { audioBase64, format } = (await res.json()) as {
          audioBase64: string;
          format: string;
        };

        if (destroyedRef.current) return;

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
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return; // clean stop
        console.warn("ElevenLabs TTS error, falling back to browser speech:", e);
        if (destroyedRef.current) return;
        isBrowserTTSRef.current = true;
        await browserFallbackSpeak(text, new AbortController().signal).catch(() => {});
        if (destroyedRef.current) return;
        isBrowserTTSRef.current = false;
        setIsSpeaking(false);
        setIsPaused(false);
      }
    },
    [sessionId, stop]
  );

  useEffect(() => {
    return () => {
      destroyedRef.current = true;
      fetchAbortRef.current?.abort();
      fetchAbortRef.current = null;
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
    };
  }, []);

  return { speak, stop, pause, resume, seekTime, isSpeaking, isPaused, audioCurrentTime, audioDuration };
}

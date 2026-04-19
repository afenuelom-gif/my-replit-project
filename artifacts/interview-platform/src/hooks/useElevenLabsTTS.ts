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
  const audioCtxRef             = useRef<AudioContext | null>(null);
  const isBrowserTTSRef         = useRef(false);
  const resolveCurrentSpeakRef  = useRef<(() => void) | null>(null);
  const fetchAbortRef           = useRef<AbortController | null>(null);
  const destroyedRef            = useRef(false);

  // Shared AudioContext — bypasses the iOS hardware mute/silent switch.
  // HTMLAudioElement honours the ringer volume; AudioContext uses the media
  // channel and plays regardless of whether the silent switch is engaged.
  const getAudioContext = useCallback((): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AC();
    }
    return audioCtxRef.current;
  }, []);

  const stop = useCallback(() => {
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

      // Resume AudioContext NOW — must happen synchronously within the
      // user-gesture call stack before any await, otherwise iOS blocks it.
      try {
        const ctx = getAudioContext();
        if (ctx.state === "suspended") await ctx.resume();
      } catch { /* non-fatal — will fall back to direct playback */ }

      try {
        const res = await fetch(`/api/interview/sessions/${sessionId}/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, interviewerId }),
          signal: controller.signal,
        });

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

        // Build a Blob URL — more reliable than a data URI on iOS Safari.
        const mimeType = `audio/${format ?? "mpeg"}`;
        const bytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);

        const audio = new Audio(blobUrl);
        audioRef.current = audio;

        // Route through AudioContext so it bypasses the iOS mute switch.
        try {
          const ctx = getAudioContext();
          if (ctx.state === "suspended") await ctx.resume();
          const source = ctx.createMediaElementSource(audio);
          source.connect(ctx.destination);
        } catch { /* AudioContext unavailable — audio still plays via element */ }

        audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
        audio.addEventListener("timeupdate",     () => setCurrentTime(audio.currentTime));

        await new Promise<void>((resolve) => {
          resolveCurrentSpeakRef.current = resolve;
          const finish = () => {
            resolveCurrentSpeakRef.current = null;
            audioRef.current = null;
            URL.revokeObjectURL(blobUrl);
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
        if (e instanceof Error && e.name === "AbortError") return;
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
    [sessionId, stop, getAudioContext]
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
      // AudioContext is intentionally kept alive across renders for reuse.
    };
  }, []);

  // Call this synchronously inside a user-gesture handler to unlock the
  // AudioContext on iOS before any async work (fetch, etc.) begins.
  const unlockAudio = useCallback(async () => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === "suspended") await ctx.resume();
      // Play a 1-frame silent buffer — this fully commits the unlock on iOS.
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch { /* non-fatal */ }
  }, [getAudioContext]);

  return { speak, stop, pause, resume, seekTime, unlockAudio, isSpeaking, isPaused, audioCurrentTime, audioDuration };
}

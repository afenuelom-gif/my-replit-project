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

  const audioCtxRef         = useRef<AudioContext | null>(null);
  const isBrowserTTSRef     = useRef(false);
  const resolveCurrentRef   = useRef<(() => void) | null>(null);
  const fetchAbortRef       = useRef<AbortController | null>(null);
  const destroyedRef        = useRef(false);

  // AudioBufferSourceNode approach — bypasses iOS user-gesture requirement
  // for subsequent .play() calls. Once the AudioContext is unlocked by a
  // user gesture, AudioBufferSourceNode.start() works at any time.
  const bufferSourceRef     = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef      = useRef<AudioBuffer | null>(null);
  const playStartCtxTimeRef = useRef<number>(0);
  const playStartOffsetRef  = useRef<number>(0);
  const timeIntervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  const getAudioContext = useCallback((): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AC();
    }
    return audioCtxRef.current;
  }, []);

  const clearTimer = useCallback(() => {
    if (timeIntervalRef.current) {
      clearInterval(timeIntervalRef.current);
      timeIntervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback((ctx: AudioContext, buf: AudioBuffer, startCtxTime: number, startOffset: number) => {
    clearTimer();
    timeIntervalRef.current = setInterval(() => {
      if (ctx.state === "running") {
        const elapsed = (ctx.currentTime - startCtxTime) + startOffset;
        setCurrentTime(Math.min(Math.max(0, elapsed), buf.duration));
      }
    }, 100);
  }, [clearTimer]);

  const stop = useCallback(() => {
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = null;

    clearTimer();

    if (bufferSourceRef.current) {
      try { bufferSourceRef.current.onended = null; bufferSourceRef.current.stop(); } catch { /* already stopped */ }
      bufferSourceRef.current = null;
    }
    audioBufferRef.current = null;

    if (isBrowserTTSRef.current) {
      window.speechSynthesis?.cancel();
      isBrowserTTSRef.current = false;
    }

    resolveCurrentRef.current?.();
    resolveCurrentRef.current = null;

    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentTime(0);
    setDuration(0);
  }, [clearTimer]);

  const pause = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === "running") ctx.suspend().catch(() => {});
    if (isBrowserTTSRef.current) window.speechSynthesis?.pause();
    clearTimer();
    setIsPaused(true);
  }, [clearTimer]);

  const resume = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
      const buf = audioBufferRef.current;
      if (buf) startTimer(ctx, buf, playStartCtxTimeRef.current, playStartOffsetRef.current);
    }
    if (isBrowserTTSRef.current) window.speechSynthesis?.resume();
    setIsPaused(false);
  }, [startTimer]);

  const seekTime = useCallback((seconds: number) => {
    const ctx = audioCtxRef.current;
    const buf = audioBufferRef.current;
    if (!ctx || !buf) return;

    // Stop current source
    if (bufferSourceRef.current) {
      try { bufferSourceRef.current.onended = null; bufferSourceRef.current.stop(); } catch { /* already stopped */ }
      bufferSourceRef.current = null;
    }
    clearTimer();

    const clamped = Math.max(0, Math.min(seconds, buf.duration));
    setCurrentTime(clamped);

    // Start a new source from the seek position
    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.connect(ctx.destination);
    bufferSourceRef.current = source;

    const startCtxTime = ctx.currentTime;
    playStartCtxTimeRef.current = startCtxTime;
    playStartOffsetRef.current = clamped;

    source.onended = () => {
      if (bufferSourceRef.current !== source) return;
      clearTimer();
      bufferSourceRef.current = null;
      audioBufferRef.current = null;
      resolveCurrentRef.current?.();
      resolveCurrentRef.current = null;
      setIsSpeaking(false);
      setIsPaused(false);
    };

    source.start(0, clamped);
    startTimer(ctx, buf, startCtxTime, clamped);
  }, [clearTimer, startTimer]);

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

      // Ensure AudioContext is running (may be suspended on iOS after inactivity)
      try {
        const ctx = getAudioContext();
        if (ctx.state === "suspended") await ctx.resume();
      } catch { /* non-fatal */ }

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

        const { audioBase64 } = (await res.json()) as { audioBase64: string; format: string };
        if (destroyedRef.current) return;

        // Decode via AudioContext — AudioBufferSourceNode.start() works without a
        // user gesture as long as the AudioContext was previously unlocked. This
        // is the key fix for iOS Safari which blocks HTMLAudioElement.play() on
        // every newly-created Audio() element unless called in a gesture handler.
        const ctx = getAudioContext();
        const bytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
        const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
        if (destroyedRef.current) return;

        audioBufferRef.current = audioBuffer;
        setDuration(audioBuffer.duration);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        bufferSourceRef.current = source;

        const startCtxTime = ctx.currentTime;
        playStartCtxTimeRef.current = startCtxTime;
        playStartOffsetRef.current = 0;

        await new Promise<void>((resolve) => {
          resolveCurrentRef.current = resolve;

          source.onended = () => {
            if (bufferSourceRef.current !== source) return;
            clearTimer();
            bufferSourceRef.current = null;
            audioBufferRef.current = null;
            resolveCurrentRef.current = null;
            setIsSpeaking(false);
            setIsPaused(false);
            resolve();
          };

          source.start(0);
          startTimer(ctx, audioBuffer, startCtxTime, 0);
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
    [sessionId, stop, getAudioContext, clearTimer, startTimer]
  );

  useEffect(() => {
    return () => {
      destroyedRef.current = true;
      fetchAbortRef.current?.abort();
      fetchAbortRef.current = null;
      if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
      if (bufferSourceRef.current) {
        try { bufferSourceRef.current.onended = null; bufferSourceRef.current.stop(); } catch { /* already stopped */ }
        bufferSourceRef.current = null;
      }
      resolveCurrentRef.current?.();
      resolveCurrentRef.current = null;
      if (isBrowserTTSRef.current) window.speechSynthesis?.cancel();
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []);

  // Call synchronously inside a user-gesture handler to unlock the
  // AudioContext on iOS before any async work begins.
  const unlockAudio = useCallback(async () => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === "suspended") await ctx.resume();
      // Play a 1-frame silent buffer — fully commits the AudioContext unlock on iOS.
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch { /* non-fatal */ }
  }, [getAudioContext]);

  return { speak, stop, pause, resume, seekTime, unlockAudio, isSpeaking, isPaused, audioCurrentTime, audioDuration };
}

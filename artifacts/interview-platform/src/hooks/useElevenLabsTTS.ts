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

// Build a tiny silent WAV blob URL used as the keepalive audio element source.
// This must be a real audio file (not empty) so iOS actually "plays" it.
function buildSilentWavUrl(): string {
  const sr = 44100;
  const numSamples = sr; // 1 second of silence
  const buf = new ArrayBuffer(44 + numSamples * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + numSamples * 2, true);
  w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);  // PCM
  v.setUint16(22, 1, true);  // mono
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, numSamples * 2, true);
  // silence — all zero samples (already zero-initialised)
  const blob = new Blob([buf], { type: "audio/wav" });
  return URL.createObjectURL(blob);
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

  // AudioBufferSourceNode for actual speech — bypasses iOS user-gesture
  // requirement for subsequent plays (gesture only needed to unlock the ctx).
  const bufferSourceRef     = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef      = useRef<AudioBuffer | null>(null);
  const playStartCtxTimeRef = useRef<number>(0);
  const playStartOffsetRef  = useRef<number>(0);
  const timeIntervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keepalive: a looping silent HTMLAudioElement connected to the AudioContext.
  //
  // iOS suspends an AudioContext that has been silent for ~1 s, which means
  // any AudioBufferSourceNode started after a long fetch (2-3 s) will produce
  // no output even though ctx.state === "running" and the timer still ticks.
  //
  // Connecting an HTMLAudioElement via createMediaElementSource also promotes
  // the AudioContext to AVAudioSessionCategoryPlayback, which bypasses the
  // hardware silent/mute switch (plain AudioContext uses Ambient category).
  const keepaliveAudioRef   = useRef<HTMLAudioElement | null>(null);
  const keepaliveUrlRef     = useRef<string | null>(null);

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

    if (bufferSourceRef.current) {
      try { bufferSourceRef.current.onended = null; bufferSourceRef.current.stop(); } catch { /* already stopped */ }
      bufferSourceRef.current = null;
    }
    clearTimer();

    const clamped = Math.max(0, Math.min(seconds, buf.duration));
    setCurrentTime(clamped);

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

      // Ensure context is running before the fetch (it may have been suspended
      // briefly; the keepalive loop will prevent future suspensions).
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

        const ctx = getAudioContext();

        // Re-resume before decode+play in case iOS suspended between the fetch
        // completing and this line (unlikely with keepalive, but defensive).
        if (ctx.state === "suspended") {
          try { await ctx.resume(); } catch { /* non-fatal */ }
        }

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
      // Stop keepalive
      if (keepaliveAudioRef.current) {
        keepaliveAudioRef.current.pause();
        keepaliveAudioRef.current.src = "";
        keepaliveAudioRef.current = null;
      }
      if (keepaliveUrlRef.current) {
        URL.revokeObjectURL(keepaliveUrlRef.current);
        keepaliveUrlRef.current = null;
      }
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

      // Commit the gesture unlock with a 1-frame silent buffer.
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);

      // Start the keepalive HTMLAudioElement if not already running.
      //
      // Two purposes:
      // 1. Promotes the AudioContext from AVAudioSessionCategoryAmbient
      //    (muted by silent switch) to AVAudioSessionCategoryPlayback
      //    (always audible) by connecting it via createMediaElementSource.
      // 2. Keeps the AudioContext "warm" so iOS does not suspend it during
      //    long network fetches between speak() calls, which would cause
      //    subsequent AudioBufferSourceNode playback to be inaudible.
      if (!keepaliveAudioRef.current) {
        const url = buildSilentWavUrl();
        keepaliveUrlRef.current = url;

        const audio = new Audio(url);
        audio.loop = true;
        audio.volume = 0;
        keepaliveAudioRef.current = audio;

        try {
          const mediaSource = ctx.createMediaElementSource(audio);
          mediaSource.connect(ctx.destination);
        } catch { /* if already connected or unavailable, ignore */ }

        // play() MUST be called within the user-gesture call stack.
        await audio.play().catch(() => {});
      }
    } catch { /* non-fatal */ }
  }, [getAudioContext]);

  return { speak, stop, pause, resume, seekTime, unlockAudio, isSpeaking, isPaused, audioCurrentTime, audioDuration };
}

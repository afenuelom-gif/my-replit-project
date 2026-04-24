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

// ─── Shared-element approach ──────────────────────────────────────────────────
//
// iOS Safari only allows HTMLAudioElement.play() within a user-gesture call
// stack for the VERY FIRST play on a given element. Once an element has been
// "activated" (played at least once in a gesture), subsequent .play() calls —
// even from async contexts like fetch callbacks — are permitted on THAT SAME
// element without another gesture.
//
// Previous approaches created a new Audio() inside each speak() call, which
// meant every call needed its own gesture. The fix: create ONE element during
// unlockAudio() (which always runs inside a gesture handler), activate it with
// a silent blob, and reuse it for all subsequent speak() calls by swapping src.
//
// AudioContext is still used for:
//  1. Routing the shared element through it via createMediaElementSource, which
//     promotes the iOS audio session to AVAudioSessionCategoryPlayback and
//     bypasses the hardware silent/mute switch.
//  2. pause/resume via ctx.suspend()/resume() — this pauses/resumes the
//     element in sync with the rest of the graph.
//  3. seekTime() — we seek via audio.currentTime on the shared element.
// ──────────────────────────────────────────────────────────────────────────────

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

  // The ONE shared audio element — created during unlockAudio() inside a
  // user-gesture handler so iOS allows .play() on it at any future time.
  const sharedAudioRef      = useRef<HTMLAudioElement | null>(null);
  const currentBlobUrlRef   = useRef<string | null>(null);

  const getAudioContext = useCallback((): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AC();
    }
    return audioCtxRef.current;
  }, []);

  const revokeCurrent = useCallback(() => {
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = null;

    if (sharedAudioRef.current) {
      sharedAudioRef.current.pause();
      // Remove the old event listeners by swapping to a blank src, then
      // restore it empty (keeps the element "activated" on iOS).
      sharedAudioRef.current.onended = null;
      sharedAudioRef.current.onerror = null;
      sharedAudioRef.current.onloadedmetadata = null;
      sharedAudioRef.current.ontimeupdate    = null;
    }

    revokeCurrent();

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
  }, [revokeCurrent]);

  const pause = useCallback(() => {
    // Pause the audio element directly — this works regardless of whether the
    // element is routed through an AudioContext (createMediaElementSource may
    // silently fail on some browsers, so we can't rely on ctx.suspend() alone).
    const audio = sharedAudioRef.current;
    if (audio && !audio.paused) audio.pause();
    // Also suspend the AudioContext so any connected nodes stop.
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === "running") ctx.suspend().catch(() => {});
    if (isBrowserTTSRef.current) window.speechSynthesis?.pause();
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    // Resume the audio element directly.
    const audio = sharedAudioRef.current;
    if (audio && audio.paused && audio.src && !audio.ended) {
      audio.play().catch(() => {});
    }
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    if (isBrowserTTSRef.current) window.speechSynthesis?.resume();
    setIsPaused(false);
  }, []);

  const seekTime = useCallback((seconds: number) => {
    const audio = sharedAudioRef.current;
    if (!audio) return;
    const clamped = Math.max(0, Math.min(seconds, audio.duration || seconds));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
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

        if (destroyedRef.current) return;
        fetchAbortRef.current = null;

        if (!res.ok) {
          console.warn(`ElevenLabs TTS unavailable (${res.status}), falling back`);
          isBrowserTTSRef.current = true;
          await browserFallbackSpeak(text, controller.signal);
          if (destroyedRef.current) return;
          isBrowserTTSRef.current = false;
          setIsSpeaking(false);
          return;
        }

        const { audioBase64, format } = (await res.json()) as { audioBase64: string; format: string };
        if (destroyedRef.current) return;

        const mimeType = `audio/${format ?? "mpeg"}`;
        const bytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        currentBlobUrlRef.current = blobUrl;

        // Use the shared element that was activated during unlockAudio().
        // If it was never created (non-iOS or unlockAudio skipped), fall back
        // to creating a new element — it will need a gesture but is a safe default.
        const audio = sharedAudioRef.current ?? new Audio();
        if (!sharedAudioRef.current) sharedAudioRef.current = audio;

        // Swap the src on the already-activated element.
        // Always restore volume to 1 — unlockAudio() sets it to 0 for the
        // silent activation blob, and the same element is reused here.
        audio.volume = 1;
        audio.src = blobUrl;
        audio.load();

        await new Promise<void>((resolve) => {
          resolveCurrentRef.current = resolve;

          const finish = () => {
            if (resolveCurrentRef.current !== resolve) return;
            resolveCurrentRef.current = null;
            // Don't null sharedAudioRef — keep it for the next speak() call.
            revokeCurrent();
            setIsSpeaking(false);
            setIsPaused(false);
            resolve();
          };

          audio.onended = finish;
          audio.onerror = finish;
          audio.onloadedmetadata = () => setDuration(audio.duration);
          audio.ontimeupdate    = () => setCurrentTime(audio.currentTime);

          const startPlay = () => {
            audio.play().catch((err) => {
              console.warn("[TTS] play() rejected:", err);
              finish();
            });
          };

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
    [sessionId, stop, revokeCurrent]
  );

  useEffect(() => {
    return () => {
      destroyedRef.current = true;
      fetchAbortRef.current?.abort();
      fetchAbortRef.current = null;
      if (sharedAudioRef.current) {
        sharedAudioRef.current.pause();
        sharedAudioRef.current.src = "";
        sharedAudioRef.current = null;
      }
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
        currentBlobUrlRef.current = null;
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

  // Call synchronously inside a user-gesture handler BEFORE any async work.
  //
  // This creates and activates the shared HTMLAudioElement by playing a silent
  // blob on it. Once activated, .play() on the same element works from async
  // contexts (fetch callbacks etc.) without a new gesture — iOS only requires
  // a gesture for the first .play() on any given element instance.
  //
  // The element is also routed through AudioContext via createMediaElementSource
  // which promotes the iOS audio session to AVAudioSessionCategoryPlayback,
  // bypassing the hardware silent/mute switch.
  const unlockAudio = useCallback(async () => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === "suspended") await ctx.resume();

      if (!sharedAudioRef.current) {
        // Build a minimal silent WAV blob (1 second mono 44100 Hz 16-bit PCM).
        const sr = 44100;
        const ns = sr; // 1 second
        const buf = new ArrayBuffer(44 + ns * 2);
        const v = new DataView(buf);
        const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
        ws(0, "RIFF"); v.setUint32(4, 36 + ns * 2, true);
        ws(8, "WAVE"); ws(12, "fmt "); v.setUint32(16, 16, true);
        v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
        v.setUint16(32, 2, true); v.setUint16(34, 16, true);
        ws(36, "data"); v.setUint32(40, ns * 2, true);
        // data bytes are zero-initialised (silence)

        const silentUrl = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));

        const audio = new Audio(silentUrl);
        audio.volume = 0;   // Truly silent — activates the element without sound
        audio.loop   = false;
        sharedAudioRef.current = audio;

        // Route through AudioContext → promotes iOS audio session to Playback
        // category so audio plays even when the hardware mute switch is on.
        try {
          const src = ctx.createMediaElementSource(audio);
          src.connect(ctx.destination);
        } catch { /* already connected or unavailable — audio still plays directly */ }

        // This .play() MUST succeed within the gesture call stack.
        // After it resolves, iOS considers the element "activated".
        await audio.play().catch((e) => { console.warn("[TTS unlock] silent play failed:", e); });

        // Clean up the silent blob URL; the element stays alive.
        URL.revokeObjectURL(silentUrl);
      }
    } catch (e) {
      console.warn("[TTS unlock] unlockAudio error:", e);
    }
  }, [getAudioContext]);

  return { speak, stop, pause, resume, seekTime, unlockAudio, isSpeaking, isPaused, audioCurrentTime, audioDuration };
}

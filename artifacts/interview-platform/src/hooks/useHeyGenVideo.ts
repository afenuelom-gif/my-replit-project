import { useState, useCallback, useRef, useEffect } from "react";

export type VideoGenStatus = "idle" | "generating" | "ready" | "error";

export interface HeyGenVideoState {
  videoUrl: string | null;
  status: VideoGenStatus;
  generate: (interviewerId: number, text: string, gender: "male" | "female") => void;
  reset: () => void;
}

const POLL_INTERVAL_MS = 5000;
const MAX_WAIT_MS = 180_000; // 3 minutes max

export function useHeyGenVideo(): HeyGenVideoState {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<VideoGenStatus>("idle");

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const unmountedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async (videoId: string) => {
    if (unmountedRef.current) return;
    if (Date.now() - startTimeRef.current > MAX_WAIT_MS) {
      stopPolling();
      setStatus("error");
      return;
    }
    try {
      const resp = await fetch(`/api/interview/heygen/video-status/${encodeURIComponent(videoId)}`);
      if (!resp.ok) return;
      const data = await resp.json() as { status: string; videoUrl?: string | null; error?: string | null };
      if (unmountedRef.current) return;
      if (data.status === "completed" && data.videoUrl) {
        stopPolling();
        setVideoUrl(data.videoUrl);
        setStatus("ready");
      } else if (data.status === "failed") {
        stopPolling();
        setStatus("error");
      }
      // "processing" / "pending" → keep polling
    } catch {
      // transient network error — keep polling
    }
  }, [stopPolling]);

  const generate = useCallback((interviewerId: number, text: string, gender: "male" | "female") => {
    stopPolling();
    setVideoUrl(null);
    setStatus("generating");
    startTimeRef.current = Date.now();

    fetch("/api/interview/heygen/generate-video", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ interviewerId, text, gender }),
    })
      .then(r => r.json())
      .then((data: { videoId?: string; error?: string }) => {
        if (unmountedRef.current) return;
        if (!data.videoId) {
          setStatus("error");
          return;
        }
        // start polling
        pollTimerRef.current = setInterval(() => pollStatus(data.videoId!), POLL_INTERVAL_MS);
        // immediate first poll
        pollStatus(data.videoId);
      })
      .catch(() => {
        if (!unmountedRef.current) setStatus("error");
      });
  }, [stopPolling, pollStatus]);

  const reset = useCallback(() => {
    stopPolling();
    setVideoUrl(null);
    setStatus("idle");
  }, [stopPolling]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      stopPolling();
    };
  }, [stopPolling]);

  return { videoUrl, status, generate, reset };
}

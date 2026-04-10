import { useState, useCallback, useRef, useEffect } from "react";

export type DIDTalksStatus = "idle" | "generating" | "ready" | "error";

export interface DIDTalksState {
  status: DIDTalksStatus;
  videoUrl: string | null;
  generate: (text: string, gender: "male" | "female") => void;
  reset: () => void;
}

const DID_ENABLED = import.meta.env.VITE_DID_ENABLED === "true";
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 20; // 40 seconds max before fallback

export function useDIDTalks(): DIDTalksState {
  const [status, setStatus] = useState<DIDTalksStatus>("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const unmountedRef       = useRef(false);
  const pollTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTalkIdRef   = useRef<string | null>(null);
  const pollCountRef       = useRef(0);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const poll = useCallback(async (talkId: string) => {
    if (unmountedRef.current || currentTalkIdRef.current !== talkId) return;

    pollCountRef.current++;
    if (pollCountRef.current > MAX_POLLS) {
      console.warn("[D-ID Talks] Timeout waiting for video");
      setStatus("error");
      return;
    }

    try {
      const resp = await fetch(`/api/interview/did/talks/${talkId}`);
      if (!resp.ok) { setStatus("error"); return; }

      const data = await resp.json() as {
        status?: string;
        result_url?: string;
      };

      if (unmountedRef.current || currentTalkIdRef.current !== talkId) return;

      console.log("[D-ID Talks] poll:", data.status, "url:", data.result_url?.substring(0, 60));

      if (data.status === "done" && data.result_url) {
        setVideoUrl(data.result_url);
        setStatus("ready");
      } else if (data.status === "error" || data.status === "rejected") {
        console.error("[D-ID Talks] Generation failed:", data.status);
        setStatus("error");
      } else {
        pollTimerRef.current = setTimeout(() => poll(talkId), POLL_INTERVAL_MS);
      }
    } catch (err) {
      console.error("[D-ID Talks] Poll error:", err);
      if (!unmountedRef.current && currentTalkIdRef.current === talkId) {
        setStatus("error");
      }
    }
  }, []);

  const generate = useCallback((text: string, gender: "male" | "female") => {
    if (!DID_ENABLED) return;

    clearPoll();
    currentTalkIdRef.current = null;
    pollCountRef.current = 0;
    setStatus("generating");
    setVideoUrl(null);

    console.log("[D-ID Talks] Generating video for:", text.substring(0, 50));

    fetch("/api/interview/did/talks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, gender }),
    })
      .then(r => r.json())
      .then((data: { id?: string; error?: string }) => {
        if (unmountedRef.current) return;
        if (!data.id) {
          console.error("[D-ID Talks] Create failed:", data.error);
          setStatus("error");
          return;
        }
        console.log("[D-ID Talks] Created talk:", data.id);
        currentTalkIdRef.current = data.id;
        pollTimerRef.current = setTimeout(() => poll(data.id!), POLL_INTERVAL_MS);
      })
      .catch(err => {
        console.error("[D-ID Talks] Create error:", err);
        if (!unmountedRef.current) setStatus("error");
      });
  }, [clearPoll, poll]);

  const reset = useCallback(() => {
    clearPoll();
    currentTalkIdRef.current = null;
    pollCountRef.current = 0;
    setStatus("idle");
    setVideoUrl(null);
  }, [clearPoll]);

  return { status, videoUrl, generate, reset };
}

import { useRef, useState, useCallback, useEffect } from "react";
import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
  TaskType,
} from "@heygen/streaming-avatar";

export type HeyGenStatus = "idle" | "connecting" | "connected" | "error";

export interface UseHeyGenAvatarReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: HeyGenStatus;
  isSpeaking: boolean;
  speak: (text: string) => Promise<void>;
  stop: () => Promise<void>;
  destroy: () => Promise<void>;
}

export function useHeyGenAvatar(avatarId: string | null | undefined): UseHeyGenAvatarReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<HeyGenStatus>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);

  const avatarRef = useRef<StreamingAvatar | null>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const destroyedRef = useRef(false);

  const fetchToken = useCallback(async (): Promise<string> => {
    const resp = await fetch("/api/interview/heygen/token", { method: "POST" });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({})) as { error?: string };
      throw new Error(data.error ?? `Token fetch failed: ${resp.status}`);
    }
    const data = await resp.json() as { token: string };
    return data.token;
  }, []);

  const init = useCallback(async () => {
    if (!avatarId || avatarRef.current || destroyedRef.current) return;

    setStatus("connecting");
    try {
      const token = await fetchToken();
      if (destroyedRef.current) return;

      const instance = new StreamingAvatar({ token });

      instance.on(StreamingEvents.STREAM_READY, (event: { detail: MediaStream }) => {
        if (videoRef.current) {
          videoRef.current.srcObject = event.detail;
          videoRef.current.play().catch(() => {});
        }
        setStatus("connected");
      });

      instance.on(StreamingEvents.AVATAR_START_TALKING, () => setIsSpeaking(true));
      instance.on(StreamingEvents.AVATAR_STOP_TALKING, () => setIsSpeaking(false));

      instance.on(StreamingEvents.STREAM_DISCONNECTED, () => {
        setStatus("idle");
        setIsSpeaking(false);
        avatarRef.current = null;
        initPromiseRef.current = null;
      });

      await instance.createStartAvatar({
        quality: AvatarQuality.Low,
        avatarName: avatarId,
        language: "en",
        activityIdleTimeout: 600,
      } as Parameters<typeof instance.createStartAvatar>[0]);

      if (destroyedRef.current) {
        await instance.stopAvatar();
        return;
      }

      avatarRef.current = instance;
    } catch (err) {
      console.error("[HeyGen] init failed:", err);
      setStatus("error");
      initPromiseRef.current = null;
      throw err; // propagate so callers can show the required error state
    }
  }, [avatarId, fetchToken]);

  const ensureConnected = useCallback(async () => {
    if (!avatarId) return;
    if (avatarRef.current && status === "connected") return;
    if (!initPromiseRef.current) {
      initPromiseRef.current = init();
    }
    await initPromiseRef.current;
  }, [avatarId, status, init]);

  const speak = useCallback(async (text: string) => {
    if (!avatarId) return;
    try {
      await ensureConnected();
      if (!avatarRef.current) throw new Error("HeyGen not connected");
      await avatarRef.current.speak({
        text,
        task_type: TaskType.REPEAT,
      } as Parameters<typeof avatarRef.current.speak>[0]);
    } catch (err) {
      console.error("[HeyGen] speak failed:", err);
      throw err; // propagate so interview.tsx .catch() fires
    }
  }, [avatarId, ensureConnected]);

  const stop = useCallback(async () => {
    if (!avatarRef.current) return;
    try {
      await avatarRef.current.interrupt();
    } catch {
    }
  }, []);

  const destroy = useCallback(async () => {
    destroyedRef.current = true;
    if (avatarRef.current) {
      try { await avatarRef.current.stopAvatar(); } catch {}
      avatarRef.current = null;
    }
    initPromiseRef.current = null;
    setStatus("idle");
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    destroyedRef.current = false;
    return () => {
      destroyedRef.current = true;
      if (avatarRef.current) {
        avatarRef.current.stopAvatar().catch(() => {});
        avatarRef.current = null;
      }
    };
  }, []);

  return { videoRef, status, isSpeaking, speak, stop, destroy };
}

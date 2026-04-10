import { useState, useCallback, useRef, useEffect } from "react";

export type DIDStreamStatus = "idle" | "connecting" | "ready" | "speaking" | "error";

export interface DIDStreamState {
  mediaStream: MediaStream | null;
  status: DIDStreamStatus;
  speak: (text: string, gender?: "male" | "female") => Promise<void>;
  destroy: () => Promise<void>;
}

const DID_ENABLED = import.meta.env.VITE_DID_ENABLED === "true";

interface DIDCreateResponse {
  id: string;
  session_id: string;
  offer: RTCSessionDescriptionInit;
  ice_servers: RTCIceServer[];
}

interface DIDDataChannelMessage {
  event?: string;
}

export function useDIDStream(gender: "male" | "female" = "female"): DIDStreamState {
  const [status, setStatus] = useState<DIDStreamStatus>("idle");
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const unmountedRef = useRef(false);
  const connectingRef = useRef(false);

  const closePeerConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.ondatachannel = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    setMediaStream(null);
  }, []);

  const destroy = useCallback(async () => {
    unmountedRef.current = true;
    const streamId = streamIdRef.current;
    const sessionId = sessionIdRef.current;

    closePeerConnection();
    streamIdRef.current = null;
    sessionIdRef.current = null;

    if (streamId) {
      try {
        await fetch(`/api/interview/did/streams/${streamId}`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ session_id: sessionId ?? "" }),
          keepalive: true,
        });
      } catch {
      }
    }
  }, [closePeerConnection]);

  const connect = useCallback(async () => {
    if (!DID_ENABLED || connectingRef.current || unmountedRef.current) return;
    connectingRef.current = true;

    try {
      setStatus("connecting");

      const createResp = await fetch("/api/interview/did/streams", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gender }),
      });

      if (!createResp.ok) {
        const err = await createResp.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `HTTP ${createResp.status}`);
      }

      const { id: streamId, session_id: sessionId, offer, ice_servers } =
        await createResp.json() as DIDCreateResponse;

      if (unmountedRef.current) return;

      streamIdRef.current = streamId;
      sessionIdRef.current = sessionId;

      const pc = new RTCPeerConnection({ iceServers: ice_servers });
      pcRef.current = pc;

      pc.ontrack = (event) => {
        if (event.streams[0]) {
          setMediaStream(event.streams[0]);
        }
      };

      pc.onicecandidate = async (event) => {
        if (!event.candidate || !streamIdRef.current || !sessionIdRef.current) return;
        try {
          await fetch(`/api/interview/did/streams/${streamIdRef.current}/ice`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              candidate: event.candidate.toJSON(),
              session_id: sessionIdRef.current,
            }),
          });
        } catch {
        }
      };

      pc.ondatachannel = (event) => {
        const dc = event.channel;
        dc.onmessage = (msg) => {
          if (unmountedRef.current) return;
          try {
            const data = JSON.parse(msg.data as string) as DIDDataChannelMessage;
            if (data.event === "stream/ready") setStatus("ready");
            else if (data.event === "stream/started") setStatus("speaking");
            else if (data.event === "stream/done") setStatus("ready");
            else if (data.event === "stream/error") setStatus("error");
          } catch {
          }
        };
      };

      pc.onconnectionstatechange = () => {
        if (unmountedRef.current) return;
        const state = pc.connectionState;
        if (state === "connected") setStatus(s => (s === "idle" || s === "connecting" ? "ready" : s));
        else if (state === "failed") setStatus("error");
      };

      pc.oniceconnectionstatechange = () => {
        if (unmountedRef.current) return;
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          setStatus(s => (s === "idle" || s === "connecting" ? "ready" : s));
        }
      };

      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const sdpResp = await fetch(`/api/interview/did/streams/${streamId}/sdp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer, session_id: sessionId }),
      });

      if (!sdpResp.ok) {
        const err = await sdpResp.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `SDP error ${sdpResp.status}`);
      }

    } catch (err) {
      console.error("[D-ID] Connection error:", err);
      if (!unmountedRef.current) setStatus("error");
      closePeerConnection();
    } finally {
      connectingRef.current = false;
    }
  }, [gender, closePeerConnection]);

  const speak = useCallback(async (text: string, speakGender?: "male" | "female") => {
    if (!DID_ENABLED) return;
    const streamId = streamIdRef.current;
    const sessionId = sessionIdRef.current;
    if (!streamId || !sessionId) return;

    const voiceGender = speakGender ?? gender;
    try {
      await fetch(`/api/interview/did/streams/${streamId}/talk`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          script: {
            type: "text",
            subtitles: "false",
            provider: {
              type: "microsoft",
              voice_id: voiceGender === "female" ? "en-US-JennyNeural" : "en-US-GuyNeural",
            },
            input: text,
          },
          config: {
            fluent: "false",
            pad_audio: "0.0",
            align_driver: "false",
          },
          session_id: sessionId,
        }),
      });
    } catch (err) {
      console.error("[D-ID] speak() error:", err);
    }
  }, [gender]);

  useEffect(() => {
    if (!DID_ENABLED) return;
    unmountedRef.current = false;
    connect();
    return () => {
      destroy();
    };
  }, []);

  return { mediaStream, status, speak, destroy };
}

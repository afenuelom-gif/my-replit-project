import { useState, useCallback, useRef, useEffect } from "react";

export type DIDStreamStatus = "idle" | "connecting" | "connected" | "ready" | "speaking" | "error";

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
  const pendingSpeakRef = useRef<{ text: string; gender: "male" | "female" } | null>(null);

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

  // Execute speak directly against D-ID (bypasses the streamId null check)
  const executeSpeakNow = useCallback(async (text: string, speakGender: "male" | "female") => {
    const streamId = streamIdRef.current;
    const sessionId = sessionIdRef.current;
    if (!streamId || !sessionId) return;

    console.log("[D-ID] Speaking:", text.substring(0, 50));
    try {
      const resp = await fetch(`/api/interview/did/streams/${streamId}/talk`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          script: {
            type: "text",
            subtitles: "false",
            provider: {
              type: "microsoft",
              voice_id: speakGender === "female" ? "en-US-JennyNeural" : "en-US-GuyNeural",
            },
            input: text,
          },
          config: { fluent: "false", pad_audio: "0.0", align_driver: "false" },
          session_id: sessionId,
        }),
      });
      if (!resp.ok) {
        console.warn("[D-ID] talk returned", resp.status);
      }
    } catch (err) {
      console.error("[D-ID] speak() error:", err);
    }
  }, []);

  const markReady = useCallback(() => {
    if (unmountedRef.current) return;
    setStatus(s => {
      if (s === "idle" || s === "connecting" || s === "connected") return "ready";
      return s;
    });
    // Execute any pending speak that was queued before the connection was ready
    if (pendingSpeakRef.current) {
      const { text, gender: g } = pendingSpeakRef.current;
      pendingSpeakRef.current = null;
      executeSpeakNow(text, g);
    }
  }, [executeSpeakNow]);

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
      console.log("[D-ID] Stream created:", streamId);

      const pc = new RTCPeerConnection({ iceServers: ice_servers });
      pcRef.current = pc;

      // Buffer ICE candidates until SDP answer is sent — avoids race where
      // candidates arrive at D-ID before they know our SDP answer
      const iceCandidateQueue: RTCIceCandidateInit[] = [];
      let sdpAnswerSent = false;

      const sendCandidate = async (candidate: RTCIceCandidateInit) => {
        if (!streamIdRef.current || !sessionIdRef.current) return;
        try {
          await fetch(`/api/interview/did/streams/${streamIdRef.current}/ice`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ candidate, session_id: sessionIdRef.current }),
          });
        } catch { /* ignore */ }
      };

      pc.ontrack = (event) => {
        console.log("[D-ID] ontrack fired, streams:", event.streams.length, "track:", event.track.kind);
        if (event.streams[0]) {
          setMediaStream(event.streams[0]);
          markReady();
        }
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          console.log("[D-ID] ICE gathering complete");
          return;
        }
        const c = event.candidate.toJSON();
        if (!sdpAnswerSent) {
          console.log("[D-ID] ICE candidate queued (SDP not yet sent)");
          iceCandidateQueue.push(c);
        } else {
          sendCandidate(c);
        }
      };

      pc.ondatachannel = (event) => {
        console.log("[D-ID] data channel:", event.channel.label);
        const dc = event.channel;
        dc.onmessage = (msg) => {
          if (unmountedRef.current) return;
          console.log("[D-ID] datachannel msg:", msg.data);
          try {
            const data = JSON.parse(msg.data as string) as DIDDataChannelMessage;
            if (data.event === "stream/ready") markReady();
            else if (data.event === "stream/started") setStatus("speaking");
            else if (data.event === "stream/done") markReady();
            else if (data.event === "stream/error") setStatus("error");
          } catch { /* ignore */ }
        };
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log("[D-ID] connectionState:", state);
        if (unmountedRef.current) return;
        if (state === "connected") markReady();
        else if (state === "failed") setStatus("error");
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        console.log("[D-ID] iceConnectionState:", state);
        if (unmountedRef.current) return;
        if (state === "connected" || state === "completed") markReady();
      };

      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log("[D-ID] Local description set, sending SDP answer");

      const sdpResp = await fetch(`/api/interview/did/streams/${streamId}/sdp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer, session_id: sessionId }),
      });

      if (!sdpResp.ok) {
        const err = await sdpResp.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `SDP error ${sdpResp.status}`);
      }

      // SDP sent — now flush any ICE candidates that were queued
      sdpAnswerSent = true;
      console.log("[D-ID] SDP sent. Flushing", iceCandidateQueue.length, "queued ICE candidates");
      for (const c of iceCandidateQueue) {
        sendCandidate(c);
      }
      iceCandidateQueue.length = 0;

    } catch (err) {
      console.error("[D-ID] Connection error:", err);
      if (!unmountedRef.current) setStatus("error");
      closePeerConnection();
    } finally {
      connectingRef.current = false;
    }
  }, [gender, closePeerConnection, markReady]);

  const speak = useCallback(async (text: string, speakGender?: "male" | "female") => {
    if (!DID_ENABLED) return;
    const resolvedGender = speakGender ?? gender;
    const streamId = streamIdRef.current;
    const sessionId = sessionIdRef.current;

    if (!streamId || !sessionId) {
      // Queue for when connection is ready
      console.log("[D-ID] speak() called but not connected yet — queuing");
      pendingSpeakRef.current = { text, gender: resolvedGender };
      return;
    }

    await executeSpeakNow(text, resolvedGender);
  }, [gender, executeSpeakNow]);

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

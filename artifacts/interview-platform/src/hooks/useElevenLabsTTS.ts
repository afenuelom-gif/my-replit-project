import { useState, useRef, useCallback, useEffect, type MutableRefObject } from "react";

function browserFallbackSpeak(text: string): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!window.speechSynthesis) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

async function playWithNormalization(
  audio: HTMLAudioElement,
  audioCtxRef: MutableRefObject<AudioContext | null>
): Promise<void> {
  try {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
    }
    const audioCtx = audioCtxRef.current;
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }

    const source = audioCtx.createMediaElementSource(audio);
    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-24, audioCtx.currentTime);
    compressor.knee.setValueAtTime(30, audioCtx.currentTime);
    compressor.ratio.setValueAtTime(12, audioCtx.currentTime);
    compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
    compressor.release.setValueAtTime(0.25, audioCtx.currentTime);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(1.4, audioCtx.currentTime);

    source.connect(compressor);
    compressor.connect(gain);
    gain.connect(audioCtx.destination);

    await audio.play();
  } catch (err) {
    console.warn("Web Audio API setup failed, falling back to plain play:", err);
    await audio.play();
  }
}

export function useElevenLabsTTS(sessionId: number) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const isBrowserTTSRef = useRef(false);

  const stop = useCallback(() => {
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
  }, []);

  const speak = useCallback(
    async (text: string, interviewerId: number): Promise<void> => {
      stop();
      setIsSpeaking(true);
      isBrowserTTSRef.current = false;
      try {
        const res = await fetch(`/api/interview/sessions/${sessionId}/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, interviewerId }),
        });
        if (!res.ok) {
          console.warn(
            `ElevenLabs TTS unavailable (${res.status}), falling back to browser speech synthesis`
          );
          isBrowserTTSRef.current = true;
          await browserFallbackSpeak(text);
          isBrowserTTSRef.current = false;
          setIsSpeaking(false);
          return;
        }
        const { audioBase64, format } = (await res.json()) as {
          audioBase64: string;
          format: string;
        };
        const audio = new Audio(
          `data:audio/${format ?? "mpeg"};base64,${audioBase64}`
        );
        audioRef.current = audio;
        audio.onended = () => {
          audioRef.current = null;
          setIsSpeaking(false);
        };
        audio.onerror = () => {
          audioRef.current = null;
          setIsSpeaking(false);
        };
        await playWithNormalization(audio, audioCtxRef);
      } catch (e) {
        console.warn("ElevenLabs TTS error, falling back to browser speech:", e);
        isBrowserTTSRef.current = true;
        await browserFallbackSpeak(text).catch(() => {});
        isBrowserTTSRef.current = false;
        setIsSpeaking(false);
      }
    },
    [sessionId, stop]
  );

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (isBrowserTTSRef.current) {
        window.speechSynthesis?.cancel();
      }
    };
  }, []);

  return { speak, stop, isSpeaking };
}

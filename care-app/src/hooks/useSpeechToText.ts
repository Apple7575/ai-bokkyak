import { useCallback, useRef, useState } from "react";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";

export type SpeechController = {
  transcript: string;
  listening: boolean;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
};

export function useSpeechToText(onFinal?: (text: string) => void): SpeechController {
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useSpeechRecognitionEvent("result", (e: any) => {
    const text: string = e.results?.[0]?.transcript ?? "";
    setTranscript(text);
    if (e.isFinal) {
      setListening(false);
      if (text.trim()) onFinalRef.current?.(text);
    }
  });
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("error", () => setListening(false));

  const start = useCallback(async () => {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) throw new Error("음성 인식 권한 거부");
    setTranscript("");
    setListening(true);
    ExpoSpeechRecognitionModule.start({ lang: "ko-KR", interimResults: true, continuous: false });
  }, []);

  const stop = useCallback(() => {
    try { ExpoSpeechRecognitionModule.stop(); } catch {}
    setListening(false);
  }, []);

  const reset = useCallback(() => setTranscript(""), []);

  return { transcript, listening, start, stop, reset };
}

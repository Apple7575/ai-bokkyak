import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
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

  const listeningRef = useRef(false);
  const transcriptRef = useRef("");
  const finalizedRef = useRef(true); // 세션 시작 전엔 true (stray 이벤트 무시)

  const finalize = useCallback(() => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    listeningRef.current = false;
    setListening(false);
    const t = transcriptRef.current.trim();
    if (t) onFinalRef.current?.(t);
  }, []);

  useSpeechRecognitionEvent("result", (e: any) => {
    if (!listeningRef.current) return;
    const text: string = e.results?.[0]?.transcript ?? "";
    transcriptRef.current = text;
    setTranscript(text);
    if (e.isFinal) finalize();
  });
  useSpeechRecognitionEvent("end", () => { finalize(); });
  useSpeechRecognitionEvent("error", () => {
    if (!finalizedRef.current) { finalizedRef.current = true; listeningRef.current = false; setListening(false); }
  });

  const start = useCallback(async () => {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) throw new Error("음성 인식 권한 거부");
    transcriptRef.current = "";
    finalizedRef.current = false;
    setTranscript("");
    listeningRef.current = true;
    setListening(true);
    ExpoSpeechRecognitionModule.start({ lang: "ko-KR", interimResults: true, continuous: false });
  }, []);

  const stop = useCallback(() => {
    try { ExpoSpeechRecognitionModule.stop(); } catch {}
    finalize(); // 사용자가 멈추면 지금까지 인식한 문장으로 진행
  }, [finalize]);

  const reset = useCallback(() => { transcriptRef.current = ""; setTranscript(""); }, []);

  // 화면 이탈 시: 등록 트리거 없이 조용히 종료(onFinal 안 부름)
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (listeningRef.current) {
          try { ExpoSpeechRecognitionModule.stop(); } catch {}
          finalizedRef.current = true;
          listeningRef.current = false;
          setListening(false);
        }
      };
    }, [])
  );

  return { transcript, listening, start, stop, reset };
}

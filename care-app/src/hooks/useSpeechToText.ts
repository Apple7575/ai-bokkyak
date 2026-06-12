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

  // `useSpeechRecognitionEvent` 구독은 전역이라, 여러 음성 화면이 동시에 마운트되면
  // 한 발화 결과가 백그라운드 화면의 onFinal까지 실행될 수 있다. 그래서 "지금 이 화면이
  // 실제로 듣고 있을 때만" 이벤트를 처리한다(listeningRef 게이트). state는 클로저에서
  // stale하므로 ref로 즉시값을 읽는다.
  const listeningRef = useRef(false);
  const setListeningBoth = useCallback((v: boolean) => {
    listeningRef.current = v;
    setListening(v);
  }, []);

  useSpeechRecognitionEvent("result", (e: any) => {
    if (!listeningRef.current) return; // 듣고 있지 않은 화면은 무시
    const text: string = e.results?.[0]?.transcript ?? "";
    setTranscript(text);
    if (e.isFinal) {
      setListeningBoth(false);
      if (text.trim()) onFinalRef.current?.(text);
    }
  });
  useSpeechRecognitionEvent("end", () => {
    if (listeningRef.current) setListeningBoth(false);
  });
  useSpeechRecognitionEvent("error", () => {
    if (listeningRef.current) setListeningBoth(false);
  });

  const start = useCallback(async () => {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) throw new Error("음성 인식 권한 거부");
    setTranscript("");
    setListeningBoth(true);
    ExpoSpeechRecognitionModule.start({ lang: "ko-KR", interimResults: true, continuous: false });
  }, [setListeningBoth]);

  const stop = useCallback(() => {
    try { ExpoSpeechRecognitionModule.stop(); } catch {}
    setListeningBoth(false);
  }, [setListeningBoth]);

  const reset = useCallback(() => setTranscript(""), []);

  // 화면이 포커스를 잃으면(다른 화면이 위로 푸시되거나 탭 전환) 인식을 멈춰
  // 백그라운드에서 결과를 가로채지 않도록 한다.
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (listeningRef.current) {
          try { ExpoSpeechRecognitionModule.stop(); } catch {}
          setListeningBoth(false);
        }
      };
    }, [setListeningBoth])
  );

  return { transcript, listening, start, stop, reset };
}

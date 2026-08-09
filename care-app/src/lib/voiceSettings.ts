import AsyncStorage from "@react-native-async-storage/async-storage";
import { SpeechRate, DEFAULT_SPEECH_RATE, normalizeSpeechRate, speedOf } from "./ttsSpeed";

// 음성 안내 속도 설정 저장소. 읽기 실패는 기본값으로 폴백한다 — 저장소 문제로
// 안내 음성이 안 나오는 일은 없어야 한다.
const KEY = "care.speechRate";

export async function getSpeechRate(): Promise<SpeechRate> {
  try {
    return normalizeSpeechRate(await AsyncStorage.getItem(KEY));
  } catch {
    return DEFAULT_SPEECH_RATE;
  }
}

export async function setSpeechRate(rate: SpeechRate): Promise<void> {
  await AsyncStorage.setItem(KEY, normalizeSpeechRate(rate));
}

// tts.speak()가 speed를 받지 않았을 때 쓸 기본 배속.
export async function currentSpeed(): Promise<number> {
  return speedOf(await getSpeechRate());
}

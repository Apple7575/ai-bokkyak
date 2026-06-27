// care-app/src/lib/alarmRinger.ts
import { Audio } from "expo-av";
import { Vibration, Platform } from "react-native";

const SOUNDS: Record<string, number> = {
  아침: require("../../assets/sounds/morning.mp3"),
  점심: require("../../assets/sounds/noon.mp3"),
  저녁: require("../../assets/sounds/evening.mp3"),
  취침: require("../../assets/sounds/night.mp3"),
};
const MAX_MS = 150_000; // ~2.5분 후 자동정지
const VIBRATION_PATTERN = [0, 800, 400, 800, 400]; // 강한 진동

let sound: Audio.Sound | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

export async function startRinging(timeOfDay: string, onAutoStop?: () => void): Promise<void> {
  await stopRinging();
  try {
    Vibration.vibrate(VIBRATION_PATTERN, true); // 두 번째 인자 true=반복
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: false });
    const asset = SOUNDS[timeOfDay] ?? SOUNDS["아침"];
    const created = await Audio.Sound.createAsync(asset, { isLooping: true, shouldPlay: true });
    sound = created.sound;
    timer = setTimeout(() => { stopRinging().finally(() => onAutoStop?.()); }, MAX_MS);
  } catch {
    // 오디오 설정/로드 실패 시 이미 시작된 진동·타이머를 정리(무한 진동 방지). 화면 흐름은 막지 않는다.
    await stopRinging();
  }
}

export async function stopRinging(): Promise<void> {
  if (timer) { clearTimeout(timer); timer = null; }
  Vibration.cancel();
  if (sound) {
    try { await sound.stopAsync(); await sound.unloadAsync(); } catch {}
    sound = null;
  }
}

// (Platform import는 추후 iOS 분기 확장 여지를 위해 유지)
void Platform;

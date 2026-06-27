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
const GAP_MS = 2500; // 멘트 한 번 끝나고 다음 재생까지 쉬는 간격(끊김 없이 이어붙지 않게)
const VIBRATION_PATTERN = [0, 800, 400, 800, 400]; // 강한 진동

let sound: Audio.Sound | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let gapTimer: ReturnType<typeof setTimeout> | null = null;
let active = false;

export async function startRinging(timeOfDay: string, onAutoStop?: () => void): Promise<void> {
  await stopRinging();
  active = true;
  try {
    Vibration.vibrate(VIBRATION_PATTERN, true); // 두 번째 인자 true=반복
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: false });
    const asset = SOUNDS[timeOfDay] ?? SOUNDS["아침"];
    // 루프 대신 1회 재생 후 GAP_MS 쉬었다가 다시 재생(멘트가 숨 없이 붙지 않게).
    const created = await Audio.Sound.createAsync(asset, { shouldPlay: true });
    sound = created.sound;
    sound.setOnPlaybackStatusUpdate((s) => {
      if (!active || !s.isLoaded || !s.didJustFinish) return;
      if (gapTimer) clearTimeout(gapTimer);
      gapTimer = setTimeout(() => {
        if (active && sound) { sound.replayAsync().catch(() => {}); }
      }, GAP_MS);
    });
    timer = setTimeout(() => { stopRinging().finally(() => onAutoStop?.()); }, MAX_MS);
  } catch {
    // 오디오 설정/로드 실패 시 이미 시작된 진동·타이머를 정리(무한 진동 방지). 화면 흐름은 막지 않는다.
    await stopRinging();
  }
}

export async function stopRinging(): Promise<void> {
  active = false;
  if (timer) { clearTimeout(timer); timer = null; }
  if (gapTimer) { clearTimeout(gapTimer); gapTimer = null; }
  Vibration.cancel();
  if (sound) {
    try { sound.setOnPlaybackStatusUpdate(null); await sound.stopAsync(); await sound.unloadAsync(); } catch {}
    sound = null;
  }
}

// (Platform import는 추후 iOS 분기 확장 여지를 위해 유지)
void Platform;

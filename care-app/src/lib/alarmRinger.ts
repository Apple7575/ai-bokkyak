// care-app/src/lib/alarmRinger.ts
import { Audio } from "expo-av";
import { Vibration, Platform } from "react-native";
import { getAlarmSoundSettings } from "./alarmSettings";

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
    // 설정에서 "진동만"을 고르셨으면 안내 음성은 재생하지 않는다(진동·자동정지는 유지).
    const { silent } = await getAlarmSoundSettings();
    if (silent) {
      timer = setTimeout(() => { stopRinging().finally(() => onAutoStop?.()); }, MAX_MS);
      return;
    }
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

// ── 설정 화면 미리 듣기 ────────────────────────────────────────────────
// 알람용 재생(startRinging)과 자원을 공유하지 않는 별도 1회 재생.
// 설정 화면에서만 쓰며, 무음 설정과 무관하게 항상 소리를 들려준다(어떤 소리인지 확인용).
let preview: Audio.Sound | null = null;

export async function playPreview(timeOfDay: string): Promise<void> {
  await stopPreview();
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: true });
    const asset = SOUNDS[timeOfDay] ?? SOUNDS["아침"];
    const { sound: s } = await Audio.Sound.createAsync(asset, { shouldPlay: true });
    preview = s;
    s.setOnPlaybackStatusUpdate((st) => {
      if (!st.isLoaded || !st.didJustFinish) return;
      if (preview === s) { preview = null; }
      s.unloadAsync().catch(() => {});
    });
  } catch {
    await stopPreview();
  }
}

export async function stopPreview(): Promise<void> {
  const s = preview;
  preview = null;
  if (!s) return;
  try { s.setOnPlaybackStatusUpdate(null); await s.stopAsync(); await s.unloadAsync(); } catch {}
}

// (Platform import는 추후 iOS 분기 확장 여지를 위해 유지)
void Platform;

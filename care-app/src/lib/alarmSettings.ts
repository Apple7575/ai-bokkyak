import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AlarmSoundSettings, DEFAULT_ALARM_SOUND, normalizeAlarmSound,
} from "./alarmSound";

// 알람 소리 설정의 저장소 래퍼. 읽기 실패는 기본값(소리 켜짐)으로 폴백해
// 저장소 문제로 알람이 조용해지는 일이 없게 한다.
const KEY = "care.alarmSound";

export async function getAlarmSoundSettings(): Promise<AlarmSoundSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_ALARM_SOUND;
    return normalizeAlarmSound(JSON.parse(raw));
  } catch {
    return DEFAULT_ALARM_SOUND;
  }
}

export async function setAlarmSoundSettings(s: AlarmSoundSettings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(normalizeAlarmSound(s)));
}

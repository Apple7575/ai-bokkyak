import AsyncStorage from "@react-native-async-storage/async-storage";
import notifee from "@notifee/react-native";
import { supabase } from "./supabase";
import { getPatientId } from "./storage";
import { rescheduleNext, scheduleIosWindow } from "./notifications";

// 활성 일정 전체의 "다음 1회(+iOS 윈도우)"를 재예약. 부팅/시간변경/앱 실행 시 호출(멱등).

// 구버전(반복/버스트) 트리거 잔재 정리는 설치본당 한 번이면 충분한데, 매 resync마다
// 일정 하나당 13번씩 네이티브 호출을 하고 있었다. 알림 소리 설정처럼 resync를
// 기다리는 화면에서 이게 눈에 띄는 지연으로 나타났다(QA 2026-08-20). 한 번 하고 표시한다.
const LEGACY_CLEANED_KEY = "care.alarmLegacyCleaned.v1";

async function cleanLegacyTriggers(ids: string[]): Promise<void> {
  try {
    if (await AsyncStorage.getItem(LEGACY_CLEANED_KEY)) return;
  } catch {
    return; // 저장소를 못 읽으면 굳이 느린 정리를 반복하지 않는다.
  }
  for (const id of ids) {
    for (let d = 0; d <= 6; d++) { try { await notifee.cancelTriggerNotification(`alarm-${id}-${d}`); } catch {} }
    for (let b = 1; b <= 6; b++) { try { await notifee.cancelTriggerNotification(`alarm-${id}-burst-${b}`); } catch {} }
  }
  try { await AsyncStorage.setItem(LEGACY_CLEANED_KEY, "1"); } catch {}
}

export async function resyncAllAlarms(): Promise<void> {
  const pid = await getPatientId();
  if (!pid) return;
  const { data } = await supabase.from("schedules").select("*").eq("patient_id", pid).eq("active", true);
  const rows = data ?? [];
  await cleanLegacyTriggers(rows.map((s) => s.id));
  for (const s of rows) {
    try {
      // 정시 알람 → iOS 윈도우 순서를 지킨다. 윈도우는 첫 도즈의 정시(b=0)를 비워 두므로
      // 둘은 항상 짝으로 예약돼야 한다(notifications.ts 주석 참고).
      await rescheduleNext(s.id, s.hour, s.minute, s.repeat_days ?? [], s.time_of_day, s.medicine_name ?? "");
      await scheduleIosWindow(s.id, s.time_of_day, s.hour, s.minute, s.repeat_days ?? [], s.medicine_name ?? "");
    } catch {}
  }
}

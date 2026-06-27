import notifee from "@notifee/react-native";
import { supabase } from "./supabase";
import { getPatientId } from "./storage";
import { rescheduleNext, scheduleIosWindow } from "./notifications";

// 활성 일정 전체의 "다음 1회(+iOS 윈도우)"를 재예약. 부팅/시간변경/앱 실행 시 호출(멱등).
export async function resyncAllAlarms(): Promise<void> {
  const pid = await getPatientId();
  if (!pid) return;
  const { data } = await supabase.from("schedules").select("*").eq("patient_id", pid).eq("active", true);
  for (const s of data ?? []) {
    try {
      // 구버전(반복/버스트) 트리거 잔재 정리 — 업그레이드 후 첫 resync에서 1회성으로 제거
      for (let d = 0; d <= 6; d++) { try { await notifee.cancelTriggerNotification(`alarm-${s.id}-${d}`); } catch {} }
      for (let b = 1; b <= 6; b++) { try { await notifee.cancelTriggerNotification(`alarm-${s.id}-burst-${b}`); } catch {} }
      await rescheduleNext(s.id, s.hour, s.minute, s.repeat_days ?? [], s.time_of_day);
      await scheduleIosWindow(s.id, s.time_of_day, s.hour, s.minute, s.repeat_days ?? []);
    } catch {}
  }
}

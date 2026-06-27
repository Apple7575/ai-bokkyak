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
      await rescheduleNext(s.id, s.hour, s.minute, s.repeat_days ?? [], s.time_of_day);
      await scheduleIosWindow(s.id, s.time_of_day, s.hour, s.minute, s.repeat_days ?? []);
    } catch {}
  }
}

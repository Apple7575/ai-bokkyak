import AsyncStorage from "@react-native-async-storage/async-storage";
import notifee from "@notifee/react-native";
import { supabase, hasStoredSession } from "./supabase";
import { getPatientId } from "./storage";
import { rescheduleNext, scheduleIosWindow } from "./notifications";
import {
  getLocalAlarmSchedule, listLocalAlarmSchedules,
  localAlarmSchedulesRevision, replaceLocalAlarmSchedulesIfUnchanged,
} from "./localAlarmSchedules";
import type { LocalAlarmSchedule } from "./localAlarmSchedules";

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
  // 로그인 세션 없이 환자 id만 있으면 로그인 전 옛 빌드의 흔적이다 — RootNavigator가 지우는
  // 중이므로 알람을 되살리지 않는다(지운 뒤에 다시 예약되면 로그아웃된 휴대폰에서 알람이 울린다).
  if (!pid || !(await hasStoredSession())) return;
  const snapshotRevision = localAlarmSchedulesRevision();
  const { data, error } = await supabase.from("schedules").select("*").eq("patient_id", pid).eq("active", true);
  let rows: LocalAlarmSchedule[];
  if (!error && data) {
    rows = data.map((s) => ({
      id: s.id, medicineName: s.medicine_name ?? "", timeOfDay: s.time_of_day,
      hour: s.hour, minute: s.minute, repeatDays: s.repeat_days ?? [],
    }));
    // 서버가 활성 일정 0건을 돌려준 경우도 그대로 저장해 삭제된 알람을 되살리지 않는다.
    const applied = await replaceLocalAlarmSchedulesIfUnchanged(pid, rows, snapshotRevision);
    if (!applied) rows = await listLocalAlarmSchedules(pid);
  } else {
    // 오프라인/서버 오류면 마지막으로 동기화한 이 계정의 일정만 사용한다.
    rows = await listLocalAlarmSchedules(pid);
  }
  await cleanLegacyTriggers(rows.map((s) => s.id));
  for (const s of rows) {
    try {
      // 정시 알람 → iOS 윈도우 순서를 지킨다. 윈도우는 첫 도즈의 정시(b=0)를 비워 두므로
      // 둘은 항상 짝으로 예약돼야 한다(notifications.ts 주석 참고).
      await rescheduleNext(s.id, s.hour, s.minute, s.repeatDays, s.timeOfDay, s.medicineName);
      await scheduleIosWindow(s.id, s.timeOfDay, s.hour, s.minute, s.repeatDays, s.medicineName);
    } catch {}
  }
}

// 알림 DELIVERED는 네트워크가 없는 잠금 화면/백그라운드에서도 온다. 마지막으로 서버와
// 동기화한 계정별 일정 사본으로 다음 정시 회차를 잡아 다음 날 알림이 RPC에 매달리지 않게 한다.
export async function rescheduleCachedAlarm(scheduleId: string): Promise<boolean> {
  const pid = await getPatientId();
  if (!pid || !(await hasStoredSession())) return false;
  const schedule = await getLocalAlarmSchedule(pid, scheduleId);
  if (!schedule) return false;
  await rescheduleNext(
    schedule.id, schedule.hour, schedule.minute, schedule.repeatDays,
    schedule.timeOfDay, schedule.medicineName,
  );
  // iOS 윈도우도 같은 로컬 사본으로 복구한다. Android에서는 즉시 return한다.
  await scheduleIosWindow(
    schedule.id, schedule.timeOfDay, schedule.hour, schedule.minute,
    schedule.repeatDays, schedule.medicineName,
  );
  return true;
}

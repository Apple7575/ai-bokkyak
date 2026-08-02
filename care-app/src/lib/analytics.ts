import { supabase } from "./supabase";

// 알파 테스트 지표용 알람 이벤트 로그.
// 'fired'  = 알람이 실제로 발생(알람 화면 진입)한 시각.
// 나머지    = 사용자 응답(완료/미루기/건너뛰기) 이벤트 — 발생과 대비해 반응 시간 산출.
export type AlarmEventType = "fired" | "completed" | "snoozed" | "skipped";

// 알람 이벤트를 alarm_events에 남긴다.
// 베스트에포트: 테이블 미생성/네트워크 실패 등 어떤 이유로도 예외를 던지지 않아,
// 복약 알람·기록 흐름을 절대 막지 않는다. (지표 수집은 부가 기능)
export async function logAlarmEvent(args: {
  patientId: string;
  scheduleId: string;
  scheduledFor: Date;
  type: AlarmEventType;
  method?: "음성" | "버튼" | null;
}): Promise<void> {
  try {
    await supabase.from("alarm_events").insert({
      patient_id: args.patientId,
      schedule_id: args.scheduleId,
      scheduled_for: args.scheduledFor.toISOString(),
      event_type: args.type,
      method: args.method ?? null,
    });
  } catch {
    // 무시 — 지표 로그 실패가 앱 동작에 영향 주지 않게.
  }
}

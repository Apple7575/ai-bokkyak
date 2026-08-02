import { supabase, IntakeStatus } from "./supabase";
import { logAlarmEvent } from "./analytics";

// Upsert on (schedule_id, scheduled_for) — pinned decision #2 (dedup).
export async function recordIntake(args: {
  patientId: string; scheduleId: string; scheduledFor: Date;
  status: IntakeStatus; method: "음성" | "버튼" | null;
}): Promise<void> {
  const { error } = await supabase.from("intake_records").upsert({
    patient_id: args.patientId, schedule_id: args.scheduleId,
    scheduled_for: args.scheduledFor.toISOString(), status: args.status,
    response_method: args.method,
    responded_at: new Date().toISOString(),
  }, { onConflict: "schedule_id,scheduled_for" });
  if (error) throw error;
  // 알파 지표 로그(베스트에포트) — 응답 시각·행동을 alarm_events에도 남겨,
  // 발생('fired') 이벤트와 대비해 반응 시간을 산출한다. 모든 응답 경로(알람/미루기/통화)를 포괄.
  void logAlarmEvent({
    patientId: args.patientId, scheduleId: args.scheduleId,
    scheduledFor: args.scheduledFor, type: args.status, method: args.method,
  });
}

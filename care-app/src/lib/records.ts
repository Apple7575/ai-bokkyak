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

// 되돌리기용 이전 슬롯 상태. 같은 (schedule, 시각) 행은 하나뿐이므로(설계 결정 #2)
// 재발화·재탭으로 이미 snoozed/skipped 행이 있을 수 있다 — 완료로 덮어쓰기 전에 읽어 둔다.
export type PriorIntake = {
  status: IntakeStatus; response_method: "음성" | "버튼" | null; responded_at: string | null;
} | null;

export async function readIntake(args: {
  patientId: string; scheduleId: string; scheduledFor: Date;
}): Promise<PriorIntake> {
  const { data, error } = await supabase
    .from("intake_records")
    .select("status,response_method,responded_at")
    .eq("patient_id", args.patientId)
    .eq("schedule_id", args.scheduleId)
    .eq("scheduled_for", args.scheduledFor.toISOString())
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

// 완료 직후 "잘못 눌렀어요"로 되돌릴 때만 사용한다. 완료 전에 이 슬롯에 있던 응답
// (snoozed/skipped 등)이 있었으면 그 상태로 되돌리고, 없었으면 행을 지운다.
// 범위는 해당 환자·일정·예정 시각 한 건으로 제한해 다른 복약 기록에 영향을 주지 않는다.
export async function undoIntake(args: {
  patientId: string; scheduleId: string; scheduledFor: Date; previous: PriorIntake;
}): Promise<void> {
  if (args.previous) {
    const { error } = await supabase.from("intake_records").upsert({
      patient_id: args.patientId, schedule_id: args.scheduleId,
      scheduled_for: args.scheduledFor.toISOString(),
      status: args.previous.status,
      response_method: args.previous.response_method,
      responded_at: args.previous.responded_at,
    }, { onConflict: "schedule_id,scheduled_for" });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("intake_records")
      .delete()
      .eq("patient_id", args.patientId)
      .eq("schedule_id", args.scheduleId)
      .eq("scheduled_for", args.scheduledFor.toISOString());
    if (error) throw error;
  }
  // recordIntake가 남긴 'completed' 이벤트를 상쇄하는 보정 이벤트(베스트에포트).
  // 지표 집계 시 undone이 뒤따르는 completed는 무효로 본다.
  void logAlarmEvent({
    patientId: args.patientId, scheduleId: args.scheduleId,
    scheduledFor: args.scheduledFor, type: "undone", method: "버튼",
  });
}

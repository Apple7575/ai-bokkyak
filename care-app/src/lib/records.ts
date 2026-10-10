import { supabase, IntakeStatus } from "./supabase";
import { logAlarmEvent } from "./analytics";
import {
  acknowledgeIntakeMutation, enqueueIntakeMutation, intakeOutboxKey,
  listIntakeOutbox,
} from "./intakeOutbox";
import type { IntakeOutboxEntry } from "./intakeOutbox";

let mutationChain: Promise<unknown> = Promise.resolve();

export class IntakeQueuedError extends Error {
  constructor() {
    super("복약 기록을 기기에 보관했고 인터넷 연결 후 다시 전송합니다.");
    this.name = "IntakeQueuedError";
  }
}

export function isIntakeQueuedError(error: unknown): error is IntakeQueuedError {
  return error instanceof IntakeQueuedError;
}

function serialized<T>(work: () => Promise<T>): Promise<T> {
  const next = mutationChain.then(work, work);
  mutationChain = next.then(() => undefined, () => undefined);
  return next;
}

function mutationToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function sendMutation(patientId: string, entry: IntakeOutboxEntry): Promise<void> {
  if (entry.operation === "upsert") {
    const { error } = await supabase.from("intake_records").upsert({
      patient_id: patientId,
      schedule_id: entry.scheduleId,
      scheduled_for: entry.scheduledFor,
      status: entry.status,
      response_method: entry.method,
      responded_at: entry.respondedAt,
    }, { onConflict: "schedule_id,scheduled_for" });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("intake_records").delete()
      .eq("patient_id", patientId)
      .eq("schedule_id", entry.scheduleId)
      .eq("scheduled_for", entry.scheduledFor);
    if (error) throw error;
  }
}

async function persistMutation(patientId: string, entry: IntakeOutboxEntry): Promise<void> {
  // 서버 호출 전에 저장한다. 앱이 중간에 종료돼도 다음 실행 때 같은 슬롯을 다시 upsert/delete한다.
  await enqueueIntakeMutation(patientId, entry);
  try {
    await serialized(async () => {
      await sendMutation(patientId, entry);
      // 같은 슬롯에 더 최근 버튼 입력이 들어왔으면 token이 달라 삭제되지 않는다.
      await acknowledgeIntakeMutation(patientId, entry.key, entry.token).catch(() => {});
    });
  } catch {
    throw new IntakeQueuedError();
  }
}

// Upsert on (schedule_id, scheduled_for) — pinned decision #2 (dedup).
export async function recordIntake(args: {
  patientId: string; scheduleId: string; scheduledFor: Date;
  status: IntakeStatus; method: "음성" | "버튼" | null;
}): Promise<void> {
  const scheduledFor = args.scheduledFor.toISOString();
  const entry: IntakeOutboxEntry = {
    key: intakeOutboxKey(args.scheduleId, scheduledFor), operation: "upsert",
    scheduleId: args.scheduleId, scheduledFor, status: args.status, method: args.method,
    respondedAt: new Date().toISOString(), token: mutationToken(),
  };
  await persistMutation(args.patientId, entry);
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
  const scheduledFor = args.scheduledFor.toISOString();
  const entry: IntakeOutboxEntry = {
    key: intakeOutboxKey(args.scheduleId, scheduledFor),
    operation: args.previous ? "upsert" : "delete",
    scheduleId: args.scheduleId,
    scheduledFor,
    status: args.previous?.status ?? null,
    method: args.previous?.response_method ?? null,
    respondedAt: args.previous?.responded_at ?? null,
    token: mutationToken(),
  };
  await persistMutation(args.patientId, entry);
  // recordIntake가 남긴 'completed' 이벤트를 상쇄하는 보정 이벤트(베스트에포트).
  // 지표 집계 시 undone이 뒤따르는 completed는 무효로 본다.
  void logAlarmEvent({
    patientId: args.patientId, scheduleId: args.scheduleId,
    scheduledFor: args.scheduledFor, type: "undone", method: "버튼",
  });
}

// 앱 시작·포그라운드 복귀·로그인 직후 호출. 슬롯별 최신 의도만 남아 있고 서버도
// (schedule_id, scheduled_for) unique + upsert를 쓰므로 행 중복은 막지만, 네트워크가
// 끊기는 임의 시점까지 포함한 분산 시스템의 "정확히 한 번" 전송을 주장하지 않는다.
export async function flushIntakeOutbox(patientId: string): Promise<number> {
  return serialized(async () => {
    const entries = await listIntakeOutbox(patientId);
    let sent = 0;
    for (const entry of entries) {
      try {
        await sendMutation(patientId, entry);
        await acknowledgeIntakeMutation(patientId, entry.key, entry.token);
        sent += 1;
      } catch {
        // 순서를 뒤집지 않는다. 연결이 돌아오면 다음 앱 활성화에서 다시 시도한다.
        break;
      }
    }
    return sent;
  });
}

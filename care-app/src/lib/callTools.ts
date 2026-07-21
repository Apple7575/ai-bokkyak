import type { IntakeStatus } from "./intakeStatus";

// AI 건강전화 도구 호출 처리 — 순수 로직 (RN/네트워크 의존 없음, jest 단위 테스트 대상).
//
// Realtime 세션이 record_medication 도구를 호출하면 모델이 만든 인자 JSON이
// 문자열로 넘어온다. 모델 출력은 신뢰할 수 없으므로 여기서 엄격히 검증하고,
// 화면의 스케줄 목록과 느슨하게(공백·대소문자 무시, 부분일치) 매칭한다.

export type RecordMedicationArgs = {
  medicine_name: string;
  time_of_day: "아침" | "점심" | "저녁" | "취침";
  status: "복용함" | "안먹음";
};

const TIME_OF_DAY_VALUES = ["아침", "점심", "저녁", "취침"] as const;
const STATUS_VALUES = ["복용함", "안먹음"] as const;

// 모델이 돌려준 record_medication 인자 JSON을 검증해 파싱한다.
// JSON.parse 실패 / 필드 누락 / 문자열 아님 / enum 밖 값 → null.
export function parseRecordMedicationArgs(json: string): RecordMedicationArgs | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const { medicine_name, time_of_day, status } = obj;
  // 공백뿐인 약명도 거부 — looseMatch에서 빈 문자열이 되어 엉뚱한 스케줄에 매칭될 수 있다.
  if (typeof medicine_name !== "string" || medicine_name.trim() === "") return null;
  if (
    typeof time_of_day !== "string" ||
    !(TIME_OF_DAY_VALUES as readonly string[]).includes(time_of_day)
  ) {
    return null;
  }
  if (typeof status !== "string" || !(STATUS_VALUES as readonly string[]).includes(status)) {
    return null;
  }
  return {
    medicine_name,
    time_of_day: time_of_day as RecordMedicationArgs["time_of_day"],
    status: status as RecordMedicationArgs["status"],
  };
}

// 도구 status(한국어) → intake_records에 저장하는 IntakeStatus 값 매핑.
// "안먹음"은 skipped — "missed"는 기록 없음에서 파생되는 표시 전용 값이고,
// 미복용 저장은 알람 화면·STT와 마찬가지로 skipped를 쓴다.
export function toolStatusToIntake(
  s: "복용함" | "안먹음"
): Extract<IntakeStatus, "completed" | "skipped"> {
  return s === "복용함" ? "completed" : "skipped";
}

// 비교용 정규화: 공백 전부 제거 + 소문자화. "혈압 약"과 "혈압약"을 같게 본다.
function norm(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

// 어느 한쪽이 다른 쪽을 포함하면 부분일치 ("혈압약" ↔ "아침 혈압약").
function looseMatch(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  // 빈 문자열은 "anything".includes("") === true 라서 아무 스케줄에나 매칭되므로 거부.
  if (na === "" || nb === "") return false;
  return na.includes(nb) || nb.includes(na);
}

// 모델이 말한 약명/시간대를 실제 스케줄과 매칭한다.
// 1순위: 약명 부분일치 && time_of_day 완전일치. 2순위: 약명 부분일치만.
// 같은 순위에 여러 개면 배열 앞쪽 우선. 없으면 null.
export function matchSchedule<T extends { medicine_name: string; time_of_day: string }>(
  schedules: T[],
  args: { medicine_name: string; time_of_day: string }
): T | null {
  let nameOnly: T | null = null;
  for (const s of schedules) {
    if (!looseMatch(s.medicine_name, args.medicine_name)) continue;
    if (s.time_of_day === args.time_of_day) return s; // 1순위 첫 발견 즉시 반환
    if (nameOnly === null) nameOnly = s; // 2순위 후보는 앞쪽 것만 기억
  }
  return nameOnly;
}

export type CallMed = { medicine_name: string; time_of_day: string; taken: boolean };

// 서버(realtime-token)로 보낼 오늘의 복약 컨텍스트를 만든다.
// id는 서버에 필요 없으므로 페이로드에 포함하지 않는다.
export function buildMedsContext<
  T extends { medicine_name: string; time_of_day: string; id: string }
>(schedules: T[], takenScheduleIds: Set<string>): CallMed[] {
  return schedules.map((s) => ({
    medicine_name: s.medicine_name,
    time_of_day: s.time_of_day,
    taken: takenScheduleIds.has(s.id),
  }));
}

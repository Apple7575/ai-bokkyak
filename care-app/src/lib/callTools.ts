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

// ── 가입 직후 setup 통화 도구 파싱 (순수 로직) ─────────────────────────────

// set_birth_date 인자(year/month/day) 검증 → "YYYY-MM-DD" 또는 null.
// 정수 아님 / 범위 밖 / 존재하지 않는 날짜(2월 30일 등)는 null.
export function parseBirthDateArgs(json: string): string | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const { year, month, day } = raw as Record<string, unknown>;
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const y = year as number, mo = month as number, d = day as number;
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const mm = String(mo).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  // 롤오버(존재하지 않는 날짜) 거부: 구성요소 라운드트립 확인.
  const dt = new Date(`${y}-${mm}-${dd}T00:00:00`);
  if (isNaN(dt.getTime()) || dt.getFullYear() !== y || dt.getMonth() + 1 !== mo || dt.getDate() !== d) {
    return null;
  }
  return `${y}-${mm}-${dd}`;
}

export type AddMedicationArgs = {
  medicine_name: string;
  time_of_day: "아침" | "점심" | "저녁" | "취침";
  hour: number;
  minute: number;
};

// add_medication 인자 검증 → 정규화된 값 또는 null.
// minute은 선택(도구 required 아님) — 없으면 0. hour는 0-23 정수 필수.
export function parseAddMedicationArgs(json: string): AddMedicationArgs | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const { medicine_name, time_of_day, hour, minute } = raw as Record<string, unknown>;
  if (typeof medicine_name !== "string" || medicine_name.trim() === "") return null;
  if (
    typeof time_of_day !== "string" ||
    !(TIME_OF_DAY_VALUES as readonly string[]).includes(time_of_day)
  ) {
    return null;
  }
  if (!Number.isInteger(hour) || (hour as number) < 0 || (hour as number) > 23) return null;
  const min = Number.isInteger(minute) ? (minute as number) : 0;
  if (min < 0 || min > 59) return null;
  return {
    medicine_name: medicine_name.trim(),
    time_of_day: time_of_day as AddMedicationArgs["time_of_day"],
    hour: hour as number,
    minute: min,
  };
}

export type UpdateMedicationArgs = {
  index: number;
  medicine_name?: string;
  time_of_day?: "아침" | "점심" | "저녁" | "취침";
  hour?: number;
  minute?: number;
};

// update_medication 인자 검증 → 바꿀 필드만 담은 부분 갱신 객체 또는 null.
// index는 통화 중 등록 순서(0부터). 바꿀 항목이 하나도 없으면 null —
// 빈 update로 "수정했어요"라고 말하는 상황을 막는다.
export function parseUpdateMedicationArgs(json: string): UpdateMedicationArgs | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const { index, medicine_name, time_of_day, hour, minute } = raw as Record<string, unknown>;
  if (!Number.isInteger(index) || (index as number) < 0) return null;
  const out: UpdateMedicationArgs = { index: index as number };

  if (medicine_name !== undefined && medicine_name !== null) {
    if (typeof medicine_name !== "string" || medicine_name.trim() === "") return null;
    out.medicine_name = medicine_name.trim();
  }
  if (time_of_day !== undefined && time_of_day !== null) {
    if (
      typeof time_of_day !== "string" ||
      !(TIME_OF_DAY_VALUES as readonly string[]).includes(time_of_day)
    ) {
      return null;
    }
    out.time_of_day = time_of_day as UpdateMedicationArgs["time_of_day"];
  }
  if (hour !== undefined && hour !== null) {
    if (!Number.isInteger(hour) || (hour as number) < 0 || (hour as number) > 23) return null;
    out.hour = hour as number;
  }
  if (minute !== undefined && minute !== null) {
    if (!Number.isInteger(minute) || (minute as number) < 0 || (minute as number) > 59) return null;
    out.minute = minute as number;
  }

  // index 말고 바꿀 게 하나도 없으면 무의미한 호출.
  if (
    out.medicine_name === undefined && out.time_of_day === undefined &&
    out.hour === undefined && out.minute === undefined
  ) {
    return null;
  }
  return out;
}

// remove_medication 인자 검증 → 0 이상 정수 index 또는 null.
export function parseRemoveMedicationArgs(json: string): number | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const { index } = raw as Record<string, unknown>;
  if (!Number.isInteger(index) || (index as number) < 0) return null;
  return index as number;
}

// 통화 중 등록된 약 목록을 모델에게 돌려줄 요약으로 만든다.
// remove 후 번호가 당겨지므로, 도구 결과에 현재 번호를 함께 실어 모델의 index를 재동기화한다.
export function summarizeMedList<
  T extends { medicine_name: string; time_of_day: string; hour: number; minute: number }
>(schedules: T[]): { index: number; medicine_name: string; time_of_day: string; time: string }[] {
  return schedules.map((s, i) => ({
    index: i,
    medicine_name: s.medicine_name,
    time_of_day: s.time_of_day,
    time: `${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`,
  }));
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

// 복용 알람 설정(한 화면) — 순수 로직 (RN/네트워크 의존 없음, jest 대상).
//
// 회의 2026-09-03·09-12: 4단계(횟수 → 시간 → 요약 확인 → 완료)를 한 화면으로 줄였다.
// 요약 확인은 시간 단계와 내용이 같았고, 시각 조정은 「시간 바꾸기」 시트로 들어갔다.
// 회의 2026-09-06·09-12: 1분 점검을 마치고 온 사람(Case A)은 방금 점검한 약마다 시간대를
// 고르고 그 이름 그대로 저장한다. 점검을 건너뛴 사람(Case C)은 하루 횟수만 고른다.
// 시각은 시간대마다 하나를 함께 쓴다 — 아침 약이 셋이어도 아침 알람 시각은 하나다.
// 파일 이름은 음성 안내 시절 그대로 둔다(이름만 바꾸는 변경을 늘리지 않으려고).

import { DoseTime, Slot, SLOTS, afterMealTimes, defaultSlotsFor } from "./voiceParse";
import { slotLabel } from "./timeOfDay";

export type SetupMode = "medicines" | "count";
export type ClockTime = { hour: number; minute: number };
export type SlotTimes = Record<Slot, ClockTime>;

export type AlarmSetup = {
  /** medicines: 점검한 약마다 시간대를 고른다(Case A) · count: 하루 횟수만 고른다(Case C) */
  mode: SetupMode;
  /** 방금 점검한 약 이름(정리된 것). count 모드에서는 비어 있다 */
  medicines: string[];
  /** 약 이름 → 고른 시간대(SLOTS 순서) */
  medSlots: Record<string, Slot[]>;
  /** count 모드에서 고른 하루 횟수(1~4, 4 = 4번 이상). 고르기 전에는 null */
  count: number | null;
  /** 시간대별 시각. 네 시간대를 늘 들고 있어 칩을 껐다 켜도 고친 시각이 남는다 */
  times: SlotTimes;
};

// 앞 화면이 넘긴 약 이름 정리 — 앞뒤 공백을 떼고 빈 이름·중복을 버린다(처음 나온 순서 유지).
// 이름이 곧 저장할 medicine_name이고 화면의 키라 겹치면 안 된다.
export function sanitizeMedicines(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const v of input) {
    if (typeof v !== "string") continue;
    const name = v.trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

// 시간대마다 식후 기본 시각(8:00 · 12:00 · 18:00 · 22:00)에서 시작한다.
export function initialTimes(): SlotTimes {
  const out = {} as SlotTimes;
  for (const t of afterMealTimes([...SLOTS])) out[t.slot] = { hour: t.hour, minute: t.minute };
  return out;
}

// 약 이름이 하나라도 오면 약별 모드, 없으면 횟수 모드(알람 물음 화면에서 온 경우).
// 어느 약에도 시간대를 미리 켜 두지 않는다 — 저녁 약을 아침으로 짐작해 넣으면 안 된다.
export function initialSetup(rawMedicines: unknown): AlarmSetup {
  const medicines = sanitizeMedicines(rawMedicines);
  // fromEntries — 직접 입력한 이름이 "__proto__"여도 제 칸으로 들어가게(대입은 프로토타입을 바꾼다).
  const medSlots: Record<string, Slot[]> = Object.fromEntries(medicines.map((m) => [m, [] as Slot[]]));
  return {
    mode: medicines.length > 0 ? "medicines" : "count",
    medicines, medSlots, count: null, times: initialTimes(),
  };
}

// 그 약에 고른 시간대. 자기 속성만 본다 — 「constructor」 같은 이름이 Object.prototype 것을 집지 않게.
export function medSlotsOf(s: AlarmSetup, medicine: string): Slot[] {
  return Object.prototype.hasOwnProperty.call(s.medSlots, medicine) ? s.medSlots[medicine] : [];
}

// 약 하나의 시간대 칩을 켜고 끈다(여러 개 가능). 저장·표시 순서가 흔들리지 않게 SLOTS 순서로 둔다.
export function toggleMedSlot(s: AlarmSetup, medicine: string, slot: Slot): AlarmSetup {
  if (!s.medicines.includes(medicine)) return s;
  const cur = medSlotsOf(s, medicine);
  const on = !cur.includes(slot);
  const next = SLOTS.filter((x) => (x === slot ? on : cur.includes(x)));
  // 펼치기({ ...a, [k]: v })는 "__proto__" 키를 잃는다 — fromEntries로 새로 만든다.
  const medSlots = Object.fromEntries(s.medicines.map((m) => [m, m === medicine ? next : medSlotsOf(s, m)]));
  return { ...s, medSlots };
}

// 횟수 버튼. 4 이상은 4(「4번 이상」)로 묶는다.
export function pickCount(s: AlarmSetup, count: number): AlarmSetup {
  if (!Number.isFinite(count) || count < 1) return s;
  return { ...s, count: Math.min(4, Math.trunc(count)) };
}

// 알람을 맞출 시간대 — 늘 SLOTS 순서(아침 → 자기 전). 배너·시트·저장·완료 요약이 이 순서를 따른다.
export function chosenSlots(s: AlarmSetup): Slot[] {
  if (s.mode === "count") return s.count === null ? [] : defaultSlotsFor(s.count);
  return SLOTS.filter((slot) => s.medicines.some((m) => medSlotsOf(s, m).includes(slot)));
}

export function chosenTimes(s: AlarmSetup): DoseTime[] {
  return chosenSlots(s).map((slot) => ({ slot, ...s.times[slot] }));
}

// 「설정 완료」를 열지 — 약별은 시간대를 하나라도 골랐을 때, 횟수는 횟수를 골랐을 때.
export function canFinish(s: AlarmSetup): boolean {
  return chosenSlots(s).length > 0;
}

// 시간대를 하나도 안 고른 약 — 진통제처럼 필요할 때만 먹는 약이 흔하다. 알람 없이 둔다.
export function unslottedMedicines(s: AlarmSetup): string[] {
  if (s.mode !== "medicines") return [];
  return s.medicines.filter((m) => medSlotsOf(s, m).length === 0);
}

// 「시간을 고르지 않은 약은 …」 안내를 띄울지 — 하나라도 골랐는데 빠진 약이 있을 때만.
// 아무것도 안 고른 처음 화면에서 띄우면 모든 약이 해당돼 잔소리가 된다.
export function showsUnslottedNote(s: AlarmSetup): boolean {
  return canFinish(s) && unslottedMedicines(s).length > 0;
}

// 그 시간대에 고른 약(점검한 순서) — 완료 화면에서 시간대 줄 아래에 보여 준다.
export function medicinesAt(s: AlarmSetup, slot: Slot): string[] {
  if (s.mode !== "medicines") return [];
  return s.medicines.filter((m) => medSlotsOf(s, m).includes(slot));
}

// 30분 단위로 옮긴다. 자정을 넘으면 하루 안으로 돌린다(23:30 + 30분 = 0:00).
export function bumpTime(t: ClockTime, deltaMin: number): ClockTime {
  const total = (((t.hour * 60 + t.minute + deltaMin) % 1440) + 1440) % 1440;
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

// 시간대 하나의 시각을 옮긴다 — 그 시간대의 약이 모두 같은 시각을 쓴다.
export function bumpSlotTime(s: AlarmSetup, slot: Slot, deltaMin: number): AlarmSetup {
  return { ...s, times: { ...s.times, [slot]: bumpTime(s.times[slot], deltaMin) } };
}

// 12시간제 「8:00」「6:00」「12:00」. 배너에선 시간대 이름이 오전·오후를 대신한다.
export function clock12(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")}`;
}

// 「오전 8:00」「오후 6:00」 — 시트와 완료 화면처럼 시각을 따로 크게 보일 때.
export function ampm(hour: number, minute: number): string {
  return `${hour < 12 ? "오전" : "오후"} ${clock12(hour, minute)}`;
}

// 배너 첫 줄 「아침 8:00 · 저녁 6:00에 알려드릴게요」. 고른 시간대가 없으면 빈 문자열.
export function bannerText(s: AlarmSetup): string {
  const items = chosenTimes(s).map((t) => `${slotLabel(t.slot)} ${clock12(t.hour, t.minute)}`);
  return items.length > 0 ? `${items.join(" · ")}에 알려드릴게요` : "";
}

// schedules 한 행 — patient_id는 화면이 붙인다. repeat_days [] 는 "매일"(AGENTS.md 설계 결정 1).
export type ScheduleRow = {
  medicine_name: string;
  time_of_day: Slot;
  hour: number;
  minute: number;
  repeat_days: number[];
  active: true;
};

// 저장할 행.
//   약별: 약 × 고른 시간대마다 한 행, 이름은 점검한 약 이름 그대로. 시간대를 안 고른 약은 행이 없다.
//   횟수: 시간대마다 한 행, 이름은 「아침 약」처럼 임시로(약장의 간편 등록에서 실제 이름으로 바꾼다).
export function scheduleRows(s: AlarmSetup): ScheduleRow[] {
  const row = (medicine_name: string, slot: Slot): ScheduleRow => ({
    medicine_name, time_of_day: slot, hour: s.times[slot].hour, minute: s.times[slot].minute,
    repeat_days: [], active: true,
  });
  if (s.mode === "count") return chosenSlots(s).map((slot) => row(`${slot} 약`, slot));
  const out: ScheduleRow[] = [];
  for (const m of s.medicines) {
    for (const slot of SLOTS) if (medSlotsOf(s, m).includes(slot)) out.push(row(m, slot));
  }
  return out;
}

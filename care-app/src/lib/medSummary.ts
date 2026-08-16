// 약장 카드에 쓸 복약 요약 — 순수 로직 (RN/네트워크 의존 없음, jest 대상).
//
// 같은 약이 시간대별로 여러 행(schedule)으로 저장된다(아침·저녁 = 2행).
// 화면에서는 약 한 장의 카드로 묶어 "1일 2회 · 아침 08:00, 저녁 20:00"처럼 보여준다.

import { TimeOfDay, TIME_OF_DAYS, slotLabel } from "./timeOfDay";

export type DoseLike = {
  id: string;
  medicine_name: string;
  time_of_day: string;
  hour: number;
  minute: number;
  repeat_days: number[];
  dose_amount?: string | null;
};

export type MedGroup<T extends DoseLike> = {
  name: string;
  doses: T[];          // 시간대 순(아침→점심→저녁→취침), 같은 시간대면 이른 시각 순
  timesPerDay: number; // 하루 몇 번
  everyDay: boolean;   // 매일인가 (하나라도 요일 반복이면 false)
  doseAmount: string | null;
};

function hhmm(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function todIndex(tod: string): number {
  const i = (TIME_OF_DAYS as readonly string[]).indexOf(tod);
  return i < 0 ? TIME_OF_DAYS.length : i; // 알 수 없는 값은 맨 뒤
}

// 같은 약 이름끼리 묶는다. 묶음 순서는 처음 등장한 순서를 유지한다.
export function groupByMedicine<T extends DoseLike>(items: T[]): MedGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const arr = map.get(it.medicine_name);
    if (arr) arr.push(it);
    else map.set(it.medicine_name, [it]);
  }
  return [...map.entries()].map(([name, doses]) => {
    const sorted = [...doses].sort((a, b) => {
      const t = todIndex(a.time_of_day) - todIndex(b.time_of_day);
      return t !== 0 ? t : a.hour * 60 + a.minute - (b.hour * 60 + b.minute);
    });
    const amount = sorted.find((d) => d.dose_amount)?.dose_amount ?? null;
    return {
      name,
      doses: sorted,
      timesPerDay: sorted.length,
      everyDay: sorted.every((d) => (d.repeat_days?.length ?? 0) === 0),
      doseAmount: amount,
    };
  });
}

// "1일 2회 · 아침 08:00, 저녁 20:00" — 카드 한 줄 요약.
// 시간대가 많으면 뒤를 줄여 "외 N개"로 접는다(카드가 두 줄 넘게 늘어나지 않게).
export function describeDoses<T extends DoseLike>(g: MedGroup<T>, maxShown = 2): string {
  const shown = g.doses.slice(0, maxShown)
    .map((d) => `${slotLabel(d.time_of_day)} ${hhmm(d.hour, d.minute)}`)
    .join(", ");
  const rest = g.doses.length - Math.min(maxShown, g.doses.length);
  const tail = rest > 0 ? ` 외 ${rest}개` : "";
  return `1일 ${g.timesPerDay}회 · ${shown}${tail}`;
}

// 반복 설명. 매일이면 "매일", 아니면 요일 나열.
const DAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

export function describeRepeat<T extends DoseLike>(g: MedGroup<T>): string {
  if (g.everyDay) return "매일";
  const days = new Set<number>();
  for (const d of g.doses) for (const x of d.repeat_days ?? []) days.add(x);
  const list = [...days].sort((a, b) => a - b).map((d) => DAY_LABEL[d] ?? "?").join("·");
  return list ? `${list}요일` : "매일";
}

// C-09에서 고른 시간대들을 저장 가능한 행 목록으로 바꾼다.
// 시간대마다 시각이 다를 수 있어 (시간대 → 시각) 표를 그대로 받는다.
export function buildDoseRows(
  selected: TimeOfDay[],
  hourBy: Record<TimeOfDay, { hour: number; minute: number }>
): { time_of_day: TimeOfDay; hour: number; minute: number }[] {
  // 화면 표시 순서와 저장 순서를 맞춘다.
  return TIME_OF_DAYS.filter((t) => selected.includes(t)).map((t) => ({
    time_of_day: t,
    hour: hourBy[t].hour,
    minute: hourBy[t].minute,
  }));
}

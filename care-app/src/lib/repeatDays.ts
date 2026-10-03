// 반복 요일을 문장으로 다루는 순수 로직 (RN/네트워크 의존 없음, jest 대상).
//
// QA 2026-10-03: 한 글자 요일 칩("일 월 화 …")이 "매일" 바로 옆에 있어 "일"을 매일로
// 읽고 고혈압약이 일요일에만 울리게 저장된 사례. 빈도를 먼저 문장(매일/평일만/주말만)으로
// 묻고, 요일 칩은 "직접 고르기"를 눌렀을 때만 전체 이름으로 보여주며, 고른 결과를
// 항상 한 문장으로 되읽어 준다.
//
// 설계 결정 #1: repeat_days = [] 는 "매일". 모든 함수는 normalizeRepeatDays로 정규화한다.

import { normalizeRepeatDays } from "./schedule";

export type RepeatPreset = "daily" | "weekdays" | "weekend" | "custom";

export const WEEKDAYS: number[] = [1, 2, 3, 4, 5];
export const WEEKEND: number[] = [0, 6];
export const DAY_FULL = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

function sameDays(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** [] → daily, [1..5] → weekdays, [0,6] → weekend, 그 외 → custom */
export function presetOf(days: number[]): RepeatPreset {
  const d = normalizeRepeatDays(days);
  if (d.length === 0) return "daily";
  if (sameDays(d, WEEKDAYS)) return "weekdays";
  if (sameDays(d, WEEKEND)) return "weekend";
  return "custom";
}

/** 프리셋 → 요일 배열. daily는 [] (설계 결정 #1). custom은 현재 값을 정규화해 유지. */
export function daysForPreset(p: RepeatPreset, current: number[]): number[] {
  switch (p) {
    case "daily": return [];
    case "weekdays": return [...WEEKDAYS];
    case "weekend": return [...WEEKEND];
    case "custom": return normalizeRepeatDays(current);
  }
}

/** 고른 요일을 한 문장으로. 예: "매일 알려 드려요" / "월요일·수요일에만 알려 드려요" */
export function repeatSummary(days: number[]): string {
  const d = normalizeRepeatDays(days);
  switch (presetOf(d)) {
    case "daily": return "매일 알려 드려요";
    case "weekdays": return "평일에만 알려 드려요";
    case "weekend": return "주말에만 알려 드려요";
    case "custom": {
      if (d.length === 0) return "요일을 골라 주세요";
      return `${d.map((x) => DAY_FULL[x]).join("·")}에만 알려 드려요`;
    }
  }
}

function startOfDay(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

/**
 * 시각에 붙일 날짜 맥락. 같은 날 → "오늘", 다음 날 → "내일",
 * 2~6일 뒤 → 요일 이름, 그 밖 → "M월 D일".
 * 홈의 "다음 복약 시간"이 내일 시각인데 날짜가 없어 오늘 일정과 모순돼 보였던 문제(QA 2026-10-03).
 */
export function relativeDay(at: Date, now: Date): string {
  const diffDays = Math.round(
    (startOfDay(at).getTime() - startOfDay(now).getTime()) / 86_400_000
  );
  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "내일";
  if (diffDays >= 2 && diffDays <= 6) return DAY_FULL[at.getDay()];
  return `${at.getMonth() + 1}월 ${at.getDate()}일`;
}

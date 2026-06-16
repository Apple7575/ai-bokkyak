import { colors } from "../theme/tokens";

export type DayMark = "complete" | "warn" | "danger" | "empty" | "future";

// slots: 그 날 예정 복약 수, completed: 완료 수, isPast: 그 날짜가 오늘 이전인지.
// 미래/오늘은 미완료여도 누락으로 penalize하지 않는다(future).
export function dayMark(slots: number, completed: number, isPast: boolean): DayMark {
  if (slots === 0) return "empty";
  if (completed >= slots) return "complete";
  if (!isPast) return "future";
  const missing = slots - completed;
  return missing >= 2 ? "danger" : "warn";
}

export function markColor(mark: DayMark): string | null {
  switch (mark) {
    case "complete": return colors.successGreen;
    case "warn": return colors.warningOrange;
    case "danger": return colors.dangerRed;
    case "empty":
    case "future": return null;
  }
}

export function monthlyAdherence(totalScheduled: number, totalCompleted: number): number {
  if (totalScheduled <= 0) return 0;
  return Math.round((totalCompleted / totalScheduled) * 100);
}

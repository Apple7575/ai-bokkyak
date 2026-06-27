// "지금 모두 먹기" 대상: 같은 시각(hour:minute)에 예정된 활성 일정들.
// repeat_days가 빈 배열이면 매일, 값이 있으면 해당 요일에만 해당.
type Slot = { id: string; hour: number; minute: number; repeat_days?: number[] | null; active?: boolean };
export function dueAtSlot(schedules: Slot[], hour: number, minute: number, now: Date): string[] {
  const day = now.getDay();
  return schedules
    .filter((s) => s.active !== false && s.hour === hour && s.minute === minute &&
      ((s.repeat_days ?? []).length === 0 || (s.repeat_days ?? []).includes(day)))
    .map((s) => s.id);
}

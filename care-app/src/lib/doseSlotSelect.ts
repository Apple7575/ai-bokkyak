// "지금 모두 먹기" 대상: 같은 시각(hour:minute)에 예정된 활성 일정들.
type Slot = { id: string; hour: number; minute: number; active?: boolean };
export function dueAtSlot(schedules: Slot[], hour: number, minute: number): string[] {
  return schedules
    .filter((s) => s.active !== false && s.hour === hour && s.minute === minute)
    .map((s) => s.id);
}

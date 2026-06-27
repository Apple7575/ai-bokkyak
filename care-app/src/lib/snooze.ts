export type SnoozeSpec =
  | { mode: "duration"; minutes: number }
  | { mode: "exact"; hour: number; minute: number };

// 미루기 다음 발사 시각. 기간이면 now+분, 정확시각이면 오늘 그 시각(지났으면 내일).
export function nextSnoozeFire(spec: SnoozeSpec, now: Date): Date {
  if (spec.mode === "duration") {
    return new Date(now.getTime() + spec.minutes * 60_000);
  }
  const d = new Date(now);
  d.setHours(spec.hour, spec.minute, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

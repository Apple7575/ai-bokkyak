export function normalizeRepeatDays(input: unknown): number[] {
  if (input === "매일" || input == null) return [];
  if (Array.isArray(input)) {
    return Array.from(
      new Set(input.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))
    ).sort((a, b) => a - b);
  }
  return [];
}

type TimeSpec = { hour: number; minute: number; repeat_days: number[] };

export function nextNotificationTime(spec: TimeSpec, now: Date): Date {
  const candidate = new Date(now);
  candidate.setSeconds(0, 0);
  candidate.setHours(spec.hour, spec.minute, 0, 0);
  const daily = spec.repeat_days.length === 0;
  for (let i = 0; i < 8; i++) {
    if (candidate.getTime() >= now.getTime() &&
        (daily || spec.repeat_days.includes(candidate.getDay()))) {
      return candidate;
    }
    candidate.setDate(candidate.getDate() + 1);
    candidate.setHours(spec.hour, spec.minute, 0, 0);
  }
  return candidate;
}

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

// The canonical dose-time slot for a schedule on the date of `now` (seconds/ms zeroed).
// Used as the dedup key for intake_records so re-taps within the same dose map to one row.
export function doseSlot(hour: number, minute: number, now: Date): Date {
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  // A response is to a dose that already fired: use the most recent occurrence
  // of hour:minute at or before `now`. If today's slot is still in the future,
  // the dose belongs to the previous day.
  if (d.getTime() > now.getTime()) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

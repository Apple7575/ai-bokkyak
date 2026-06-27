// 복약 발사 시각 계산(순수). repeat_days 빈 배열=매일, 아니면 0=일…6=토 요일 일치.
export type DoseSpec = { hour: number; minute: number; repeat_days: number[] };

function dueOnDay(spec: DoseSpec, day: Date): boolean {
  return spec.repeat_days.length === 0 || spec.repeat_days.includes(day.getDay());
}

export function nextDoseAt(spec: DoseSpec, now: Date): Date {
  const c = new Date(now);
  c.setSeconds(0, 0);
  c.setHours(spec.hour, spec.minute, 0, 0);
  for (let i = 0; i < 8; i++) {
    if (c.getTime() >= now.getTime() && dueOnDay(spec, c)) return c;
    c.setDate(c.getDate() + 1);
    c.setHours(spec.hour, spec.minute, 0, 0);
  }
  return c;
}

export function dosesWithin(spec: DoseSpec, now: Date, hours: number): Date[] {
  const end = now.getTime() + hours * 3_600_000;
  const out: Date[] = [];
  const c = new Date(now);
  c.setSeconds(0, 0);
  c.setHours(spec.hour, spec.minute, 0, 0);
  for (let i = 0; i < hours / 24 + 2; i++) {
    if (c.getTime() >= now.getTime() && c.getTime() <= end && dueOnDay(spec, c)) out.push(new Date(c));
    c.setDate(c.getDate() + 1);
    c.setHours(spec.hour, spec.minute, 0, 0);
  }
  return out;
}

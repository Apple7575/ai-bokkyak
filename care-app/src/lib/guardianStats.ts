// 보호자 대시보드용 순수 집계 로직 — RN/네트워크 의존 없음, jest로 단위 테스트.
// 설계 결정 #1(빈 repeat_days = 매일)과 달력의 due-slot 규칙(created_at ≤ slot ≤ now)을 따른다.

export type SlotStatus = "completed" | "snoozed" | "skipped" | "missed";

export type StatSchedule = {
  id: string;
  hour: number;
  minute: number;
  repeat_days: number[] | null;
  active?: boolean;
  created_at?: string | null;
  medicine_name?: string;
  time_of_day?: string;
};

export type StatRecord = {
  schedule_id: string;
  scheduled_for: string;
  status: string;
};

function dueOn(s: StatSchedule, day: Date): boolean {
  const days = s.repeat_days ?? [];
  return days.length === 0 || days.includes(day.getDay());
}

function slotOn(s: StatSchedule, day: Date): Date {
  const d = new Date(day);
  d.setHours(s.hour, s.minute, 0, 0);
  return d;
}

// 이미 시간이 지난(slot ≤ now) 오늘의 복약 슬롯과 그 상태(기록 없으면 missed).
export function todayStatus(
  schedules: StatSchedule[], records: StatRecord[], now: Date
): Array<{ schedule: StatSchedule; slot: Date; status: SlotStatus }> {
  const out: Array<{ schedule: StatSchedule; slot: Date; status: SlotStatus }> = [];
  for (const s of schedules) {
    if (s.active === false) continue;
    if (!dueOn(s, now)) continue;
    const slot = slotOn(s, now);
    if (slot.getTime() > now.getTime()) continue; // 아직 복약 시간 전
    if (s.created_at && new Date(s.created_at).getTime() > slot.getTime()) continue;
    const rec = records.find(
      (r) => r.schedule_id === s.id && new Date(r.scheduled_for).getTime() === slot.getTime()
    );
    const status: SlotStatus = (rec?.status as SlotStatus) ?? "missed";
    out.push({ schedule: s, slot, status });
  }
  return out.sort((a, b) => a.slot.getTime() - b.slot.getTime());
}

// 최근 7일 복약률 = 완료 슬롯 / 복약 예정 슬롯. 예정이 0이면 rate=null(표시 없음).
// 설계 결정: 슬롯은 active 일정만으로 계산한다(달력과 동일 규칙). 비활성(삭제/수정으로 보존된)
// 일정을 포함하면, 중단된 약이 중단 이후에도 계속 "예정"으로 잡혀 거짓 미복용이 누적된다.
// (비활성 시점 타임스탬프가 없는 스키마 한계상, 과거 슬롯을 정확히 귀속할 수 없어 active만 사용.)
export function weeklyRate(
  schedules: StatSchedule[], records: StatRecord[], now: Date
): { rate: number | null; completed: number; expected: number } {
  const completedSet = new Set(
    records
      .filter((r) => r.status === "completed")
      .map((r) => `${r.schedule_id}@${new Date(r.scheduled_for).getTime()}`)
  );
  let expected = 0, completed = 0;
  for (let i = 0; i < 7; i++) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    for (const s of schedules) {
      if (s.active === false) continue;
      if (!dueOn(s, day)) continue;
      const slot = slotOn(s, day);
      if (slot.getTime() > now.getTime()) continue;
      if (s.created_at && new Date(s.created_at).getTime() > slot.getTime()) continue;
      expected++;
      if (completedSet.has(`${s.id}@${slot.getTime()}`)) completed++;
    }
  }
  return { rate: expected === 0 ? null : Math.round((completed / expected) * 100), expected, completed };
}

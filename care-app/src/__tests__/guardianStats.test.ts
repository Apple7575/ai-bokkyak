import { todayStatus, weeklyRate, StatSchedule, StatRecord } from "../lib/guardianStats";

const OLD = "2020-01-01T00:00:00.000Z"; // 충분히 오래된 created_at

function sched(over: Partial<StatSchedule>): StatSchedule {
  return { id: "s1", hour: 8, minute: 0, repeat_days: [], active: true, created_at: OLD, ...over };
}
function slotISO(now: Date, h: number, m: number, dayOffset = 0): string {
  const d = new Date(now); d.setDate(now.getDate() + dayOffset); d.setHours(h, m, 0, 0);
  return d.toISOString();
}

describe("todayStatus", () => {
  const now = new Date("2026-06-19T12:00:00"); // 금요일 정오

  it("지난 슬롯에 완료 기록이 있으면 completed", () => {
    const s = sched({ id: "a", hour: 8, minute: 0 });
    const recs: StatRecord[] = [{ schedule_id: "a", scheduled_for: slotISO(now, 8, 0), status: "completed" }];
    const r = todayStatus([s], recs, now);
    expect(r).toHaveLength(1);
    expect(r[0].status).toBe("completed");
  });

  it("지난 슬롯에 기록이 없으면 missed", () => {
    const s = sched({ id: "a", hour: 8, minute: 0 });
    const r = todayStatus([s], [], now);
    expect(r[0].status).toBe("missed");
  });

  it("아직 시간이 안 된 슬롯은 제외", () => {
    const s = sched({ id: "a", hour: 20, minute: 0 }); // 저녁 8시 (정오 기준 미래)
    expect(todayStatus([s], [], now)).toHaveLength(0);
  });

  it("오늘 요일이 repeat_days에 없으면 제외", () => {
    // 금요일=5. 월(1)만 반복하는 일정은 오늘 안 뜸.
    const s = sched({ id: "a", hour: 8, minute: 0, repeat_days: [1] });
    expect(todayStatus([s], [], now)).toHaveLength(0);
  });

  it("created_at이 슬롯보다 늦으면 제외", () => {
    const s = sched({ id: "a", hour: 8, minute: 0, created_at: "2026-06-19T09:00:00" });
    expect(todayStatus([s], [], now)).toHaveLength(0);
  });

  it("비활성(active=false) 일정 제외", () => {
    const s = sched({ id: "a", hour: 8, minute: 0, active: false });
    expect(todayStatus([s], [], now)).toHaveLength(0);
  });

  it("시간순 정렬", () => {
    const a = sched({ id: "a", hour: 9, minute: 0 });
    const b = sched({ id: "b", hour: 7, minute: 30 });
    const r = todayStatus([a, b], [], now);
    expect(r.map((x) => x.schedule.id)).toEqual(["b", "a"]);
  });
});

describe("weeklyRate", () => {
  const now = new Date("2026-06-19T23:00:00"); // 모든 시간대 슬롯이 지난 늦은 밤

  it("예정 슬롯이 없으면 rate=null", () => {
    expect(weeklyRate([], [], now).rate).toBeNull();
  });

  it("매일 일정 + 일부 완료 → 비율 반올림", () => {
    const s = sched({ id: "a", hour: 8, minute: 0 }); // 7일간 매일 예정 = 7
    const recs: StatRecord[] = [0, 1, 2, 3, 4, 5].map((off) => ({
      schedule_id: "a", scheduled_for: slotISO(now, 8, 0, -off), status: "completed",
    })); // 6/7 완료
    const r = weeklyRate([s], recs, now);
    expect(r.expected).toBe(7);
    expect(r.completed).toBe(6);
    expect(r.rate).toBe(86); // round(6/7*100)=86
  });

  it("완료가 아닌 상태는 분자에 안 들어감", () => {
    const s = sched({ id: "a", hour: 8, minute: 0 });
    const recs: StatRecord[] = [{ schedule_id: "a", scheduled_for: slotISO(now, 8, 0), status: "skipped" }];
    const r = weeklyRate([s], recs, now);
    expect(r.completed).toBe(0);
    expect(r.rate).toBe(0);
  });
});

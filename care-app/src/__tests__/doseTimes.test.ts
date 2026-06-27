import { nextDoseAt, dosesWithin } from "../lib/doseTimes";

const now = new Date("2026-06-27T11:00:00"); // 토요일

describe("nextDoseAt", () => {
  it("매일(빈 배열): 오늘 미래 시각", () => {
    expect(nextDoseAt({ hour: 13, minute: 0, repeat_days: [] }, now).getTime())
      .toBe(new Date("2026-06-27T13:00:00").getTime());
  });
  it("매일: 이미 지난 시각이면 내일", () => {
    expect(nextDoseAt({ hour: 9, minute: 0, repeat_days: [] }, now).getTime())
      .toBe(new Date("2026-06-28T09:00:00").getTime());
  });
  it("요일(월,수,금=1,3,5): 다음 해당 요일", () => {
    // 토(6) 기준 다음은 월요일 6/29
    expect(nextDoseAt({ hour: 8, minute: 0, repeat_days: [1, 3, 5] }, now).getTime())
      .toBe(new Date("2026-06-29T08:00:00").getTime());
  });
});

describe("dosesWithin", () => {
  it("매일 08:00 — 48시간 내 2~3회", () => {
    const list = dosesWithin({ hour: 8, minute: 0, repeat_days: [] }, now, 48);
    // 6/28 08:00, 6/29 08:00 (6/27 08:00은 과거)
    expect(list.map((d) => d.toISOString())).toEqual([
      new Date("2026-06-28T08:00:00").toISOString(),
      new Date("2026-06-29T08:00:00").toISOString(),
    ]);
  });
  it("요일(토=6) 13:00 — 48시간 내 오늘 1회만", () => {
    const list = dosesWithin({ hour: 13, minute: 0, repeat_days: [6] }, now, 48);
    expect(list.map((d) => d.toISOString())).toEqual([new Date("2026-06-27T13:00:00").toISOString()]);
  });
});

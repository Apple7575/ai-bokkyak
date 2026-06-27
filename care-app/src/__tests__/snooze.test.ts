import { nextSnoozeFire } from "../lib/snooze";

describe("nextSnoozeFire", () => {
  const now = new Date("2026-06-27T11:00:00");
  it("기간: now + 분", () => {
    expect(nextSnoozeFire({ mode: "duration", minutes: 5 }, now).getTime())
      .toBe(new Date("2026-06-27T11:05:00").getTime());
  });
  it("정확시각: 오늘의 그 시각(미래면 오늘)", () => {
    expect(nextSnoozeFire({ mode: "exact", hour: 13, minute: 30 }, now).getTime())
      .toBe(new Date("2026-06-27T13:30:00").getTime());
  });
  it("정확시각이 이미 지났으면 내일", () => {
    expect(nextSnoozeFire({ mode: "exact", hour: 9, minute: 0 }, now).getTime())
      .toBe(new Date("2026-06-28T09:00:00").getTime());
  });
});

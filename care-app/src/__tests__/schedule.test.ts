import { normalizeRepeatDays, nextNotificationTime } from "../lib/schedule";

describe("normalizeRepeatDays", () => {
  it("매일 → []", () => {
    expect(normalizeRepeatDays("매일")).toEqual([]);
  });
  it("day list → sorted unique ints", () => {
    expect(normalizeRepeatDays([3, 1, 1])).toEqual([1, 3]);
  });
  it("nullish → []", () => {
    expect(normalizeRepeatDays(undefined)).toEqual([]);
  });
  it("filters out-of-domain and non-integer values, keeps 0..6 ints", () => {
    expect(normalizeRepeatDays([7, -1, 1.5, 3, 1, 1])).toEqual([1, 3]);
  });
});

describe("nextNotificationTime", () => {
  it("later today when time has not passed", () => {
    const now = new Date("2026-06-11T07:00:00");
    const next = nextNotificationTime({ hour: 8, minute: 0, repeat_days: [] }, now);
    expect(next.toISOString()).toBe(new Date("2026-06-11T08:00:00").toISOString());
  });
  it("tomorrow when time already passed (daily)", () => {
    const now = new Date("2026-06-11T09:00:00");
    const next = nextNotificationTime({ hour: 8, minute: 0, repeat_days: [] }, now);
    expect(next.toISOString()).toBe(new Date("2026-06-12T08:00:00").toISOString());
  });
});

import { normalizeRepeatDays, nextNotificationTime, doseSlot, todaySlot } from "../lib/schedule";

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

describe("doseSlot", () => {
  it("normalizes to the given hour:minute today with zero seconds/ms", () => {
    const now = new Date("2026-06-11T20:05:30.500");
    expect(doseSlot(20, 0, now).toISOString()).toBe(new Date("2026-06-11T20:00:00.000").toISOString());
  });
  it("is stable across calls in the same dose window (dedup key)", () => {
    const a = doseSlot(8, 0, new Date("2026-06-11T08:03:00"));
    const b = doseSlot(8, 0, new Date("2026-06-11T08:09:45"));
    expect(a.toISOString()).toBe(b.toISOString());
  });
  it("attributes a near-midnight dose answered after midnight to the previous day", () => {
    const now = new Date("2026-06-12T00:15:00");
    expect(doseSlot(23, 45, now).toISOString()).toBe(new Date("2026-06-11T23:45:00.000").toISOString());
  });
  it("assigns a late next-day response to the prior day's occurrence (not a future slot)", () => {
    const now = new Date("2026-06-12T00:15:00");
    expect(doseSlot(8, 0, now).toISOString()).toBe(new Date("2026-06-11T08:00:00.000").toISOString());
  });
});

describe("todaySlot", () => {
  it("keeps a future time on today (unlike doseSlot, never rolls back to yesterday)", () => {
    // 오전 통화에서 저녁 약(미래 슬롯)을 기록해도 어제 슬롯을 덮어쓰면 안 된다.
    const now = new Date("2026-06-11T09:00:00");
    expect(todaySlot(19, 0, now).toISOString()).toBe(new Date("2026-06-11T19:00:00.000").toISOString());
  });
  it("keeps a past time on today", () => {
    const now = new Date("2026-06-11T20:05:00");
    expect(todaySlot(8, 30, now).toISOString()).toBe(new Date("2026-06-11T08:30:00.000").toISOString());
  });
  it("zeroes seconds and milliseconds", () => {
    const now = new Date("2026-06-11T12:34:56.789");
    const slot = todaySlot(12, 0, now);
    expect(slot.getSeconds()).toBe(0);
    expect(slot.getMilliseconds()).toBe(0);
    expect(slot.toISOString()).toBe(new Date("2026-06-11T12:00:00.000").toISOString());
  });
});

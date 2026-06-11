import { validateParsedSchedule } from "../lib/parse";

describe("validateParsedSchedule", () => {
  it("accepts a valid GPT object and normalizes repeat_days", () => {
    const r = validateParsedSchedule({
      medicine_name: "고혈압약", time_of_day: "아침", hour: 8, minute: 0, repeat_days: "매일",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.medicine_name).toBe("고혈압약");
      expect(r.value.repeat_days).toEqual([]);
      expect(r.value.hour).toBe(8);
    }
  });
  it("rejects out-of-range hour", () => {
    const r = validateParsedSchedule({ medicine_name: "약", time_of_day: "아침", hour: 30, minute: 0 });
    expect(r.ok).toBe(false);
  });
  it("rejects missing medicine_name", () => {
    const r = validateParsedSchedule({ time_of_day: "아침", hour: 8, minute: 0 });
    expect(r.ok).toBe(false);
  });
});

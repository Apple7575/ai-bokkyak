import { dayMark, markColor, monthlyAdherence } from "../lib/adherence";

describe("dayMark", () => {
  it("일정 없음 → empty", () => expect(dayMark(0, 0, true)).toBe("empty"));
  it("모두 완료 → complete", () => expect(dayMark(3, 3, true)).toBe("complete"));
  it("과거 1회 누락 → warn", () => expect(dayMark(3, 2, true)).toBe("warn"));
  it("과거 2회+ 누락 → danger", () => expect(dayMark(3, 1, true)).toBe("danger"));
  it("미래/오늘 미완료 → future(중립)", () => expect(dayMark(3, 1, false)).toBe("future"));
});

describe("monthlyAdherence", () => {
  it("12/14 → 86", () => expect(monthlyAdherence(14, 12)).toBe(86));
  it("예정 0 → 0", () => expect(monthlyAdherence(0, 0)).toBe(0));
});

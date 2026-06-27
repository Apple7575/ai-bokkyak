import { dueAtSlot } from "../lib/doseSlotSelect";

// 월요일(day=1) 기준 테스트 날짜
const MON = new Date("2026-06-22T13:00:00"); // 월요일
const WED = new Date("2026-06-24T08:00:00"); // 수요일

const S = (id: string, h: number, m: number, active = true, repeatDays?: number[]) => ({
  id, hour: h, minute: m, active, repeat_days: repeatDays,
});

describe("dueAtSlot", () => {
  it("같은 시각의 활성 일정 id만 반환 (매일 = repeat_days 없음)", () => {
    const list = [S("a", 13, 0), S("b", 13, 0), S("c", 8, 0), S("d", 13, 0, false)];
    expect(dueAtSlot(list, 13, 0, MON).sort()).toEqual(["a", "b"]);
  });
  it("일치 없으면 빈 배열", () => {
    expect(dueAtSlot([S("a", 8, 0)], 13, 0, MON)).toEqual([]);
  });
  it("매일(빈 배열 repeat_days) 약은 요일 무관하게 포함", () => {
    const list = [S("daily", 8, 0, true, [])];
    expect(dueAtSlot(list, 8, 0, WED)).toEqual(["daily"]);
  });
  it("해당 요일 포함이면 선택됨 (수요일=3 약, 수요일에 확인)", () => {
    const list = [S("wed-only", 8, 0, true, [3])];
    expect(dueAtSlot(list, 8, 0, WED)).toEqual(["wed-only"]);
  });
  it("다른 요일만 반복이면 제외됨 (수요일=3 약, 월요일에 확인)", () => {
    const list = [S("wed-only", 8, 0, true, [3])];
    expect(dueAtSlot(list, 8, 0, MON)).toEqual([]);
  });
  it("복수 요일 중 해당 요일이면 포함", () => {
    const list = [S("multi", 8, 0, true, [1, 3, 5])]; // 월·수·금
    expect(dueAtSlot(list, 8, 0, MON)).toEqual(["multi"]); // 월요일
    expect(dueAtSlot(list, 8, 0, WED)).toEqual(["multi"]); // 수요일
  });
  it("복수 요일 중 해당 요일이 없으면 제외", () => {
    const list = [S("fri-sat", 8, 0, true, [5, 6])]; // 금·토
    expect(dueAtSlot(list, 8, 0, MON)).toEqual([]); // 월요일 → 제외
  });
});

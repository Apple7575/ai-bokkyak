import {
  presetOf, daysForPreset, repeatSummary, repeatSummaryFor, relativeDay, WEEKDAYS, WEEKEND, DAY_FULL,
} from "../lib/repeatDays";

describe("presetOf", () => {
  it("빈 배열은 매일 (설계 결정 #1)", () => {
    expect(presetOf([])).toBe("daily");
  });
  it("월~금은 평일", () => {
    expect(presetOf([1, 2, 3, 4, 5])).toBe("weekdays");
  });
  it("정렬 안 된 입력도 정규화해서 판정한다", () => {
    expect(presetOf([5, 1, 2, 3, 4])).toBe("weekdays");
    expect(presetOf([6, 0, 6])).toBe("weekend");
  });
  it("일·토는 주말", () => {
    expect(presetOf([0, 6])).toBe("weekend");
  });
  it("그 외는 직접 고르기", () => {
    expect(presetOf([0])).toBe("custom");
    expect(presetOf([1, 3])).toBe("custom");
  });
  it("일곱 요일을 모두 고르면 매일이다", () => {
    expect(presetOf([0, 1, 2, 3, 4, 5, 6])).toBe("daily");
    expect(presetOf([6, 5, 4, 3, 2, 1, 0, 0])).toBe("daily");
  });
});

describe("daysForPreset", () => {
  it("매일은 빈 배열", () => {
    expect(daysForPreset("daily", [1, 3])).toEqual([]);
  });
  it("평일·주말은 고정 배열", () => {
    expect(daysForPreset("weekdays", [])).toEqual(WEEKDAYS);
    expect(daysForPreset("weekend", [])).toEqual(WEEKEND);
  });
  it("직접 고르기는 현재 요일을 유지(정렬·중복제거)", () => {
    expect(daysForPreset("custom", [3, 1, 3])).toEqual([1, 3]);
  });
  it("프리셋 → 요일 → 프리셋이 왕복한다", () => {
    for (const p of ["daily", "weekdays", "weekend"] as const) {
      expect(presetOf(daysForPreset(p, [2]))).toBe(p);
    }
  });
});

describe("repeatSummary", () => {
  it("매일", () => {
    expect(repeatSummary([])).toBe("매일 알려 드려요");
  });
  it("평일만", () => {
    expect(repeatSummary([1, 2, 3, 4, 5])).toBe("평일에만 알려 드려요");
  });
  it("주말만", () => {
    expect(repeatSummary([0, 6])).toBe("주말에만 알려 드려요");
  });
  it("직접 고른 요일은 전체 이름으로 나열", () => {
    expect(repeatSummary([3, 1])).toBe("월요일·수요일에만 알려 드려요");
    expect(repeatSummary([0])).toBe("일요일에만 알려 드려요");
  });
  it("DAY_FULL은 일요일부터 토요일까지", () => {
    expect(DAY_FULL).toEqual(["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"]);
  });
});

describe("repeatSummaryFor", () => {
  it("직접 고르기 상태에서 요일이 없으면 고르라고 한다 — 매일로 읽히지 않게", () => {
    expect(repeatSummaryFor([], true)).toBe("요일을 골라 주세요");
  });
  it("직접 고르기 상태라도 요일이 있으면 그 요일 문장", () => {
    expect(repeatSummaryFor([1, 3], true)).toBe("월요일·수요일에만 알려 드려요");
    expect(repeatSummaryFor([1, 2, 3, 4, 5], true)).toBe("평일에만 알려 드려요");
  });
  it("직접 고르기가 아니면 repeatSummary와 같다", () => {
    expect(repeatSummaryFor([], false)).toBe("매일 알려 드려요");
    expect(repeatSummaryFor([0, 6], false)).toBe("주말에만 알려 드려요");
  });
});

describe("relativeDay", () => {
  // 2026-10-03 (토) 오전 10시
  const now = new Date(2026, 9, 3, 10, 0, 0, 0);
  it("같은 날이면 오늘 — 시각이 늦어도", () => {
    expect(relativeDay(new Date(2026, 9, 3, 23, 59), now)).toBe("오늘");
  });
  it("자정을 넘기면 내일", () => {
    expect(relativeDay(new Date(2026, 9, 4, 0, 0), now)).toBe("내일");
    expect(relativeDay(new Date(2026, 9, 4, 11, 0), now)).toBe("내일");
  });
  it("2~6일 뒤는 요일 이름", () => {
    expect(relativeDay(new Date(2026, 9, 5, 8, 0), now)).toBe("월요일");
    expect(relativeDay(new Date(2026, 9, 9, 8, 0), now)).toBe("금요일");
  });
  it("7일 뒤부터는 날짜", () => {
    expect(relativeDay(new Date(2026, 9, 10, 8, 0), now)).toBe("10월 10일");
    expect(relativeDay(new Date(2026, 10, 1, 8, 0), now)).toBe("11월 1일");
  });
  it("늦은 밤 기준으로도 날짜 경계는 자정이다", () => {
    const late = new Date(2026, 9, 3, 23, 30);
    expect(relativeDay(new Date(2026, 9, 4, 0, 10), late)).toBe("내일");
    expect(relativeDay(new Date(2026, 9, 3, 23, 50), late)).toBe("오늘");
  });
});

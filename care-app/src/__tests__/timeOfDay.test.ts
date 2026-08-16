import {
  timeOfDayForHour, defaultHourFor, hourForTimeOfDay, isTimeOfDay, TIME_OF_DAYS, slotLabel,
} from "../lib/timeOfDay";

describe("timeOfDayForHour", () => {
  it("경계값", () => {
    expect(timeOfDayForHour(4)).toBe("아침");
    expect(timeOfDayForHour(10)).toBe("아침");
    expect(timeOfDayForHour(11)).toBe("점심");
    expect(timeOfDayForHour(15)).toBe("점심");
    expect(timeOfDayForHour(16)).toBe("저녁");
    expect(timeOfDayForHour(20)).toBe("저녁");
    expect(timeOfDayForHour(21)).toBe("취침");
    expect(timeOfDayForHour(3)).toBe("취침");
    expect(timeOfDayForHour(0)).toBe("취침");
  });

  it("QA에서 보고된 조합 — 8시는 아침이지 점심이 아니다", () => {
    // 「점심 · 08:00」 일정이 아침 8시에 "점심 약 복용 시간입니다"로 울린 원인.
    expect(timeOfDayForHour(8)).toBe("아침");
    expect(timeOfDayForHour(22)).toBe("취침");
  });

  it("범위 밖 값도 하루 안으로 넣는다", () => {
    expect(timeOfDayForHour(24)).toBe("취침");   // 0시
    expect(timeOfDayForHour(25)).toBe("취침");   // 1시
    expect(timeOfDayForHour(32)).toBe("아침");   // 8시
    expect(timeOfDayForHour(-2)).toBe("취침");   // 22시
    expect(timeOfDayForHour(NaN)).toBe("아침");
  });
});

describe("defaultHourFor", () => {
  it("회의에서 정한 기본 시각", () => {
    expect(defaultHourFor("아침")).toBe(8);
    expect(defaultHourFor("점심")).toBe(13);
    expect(defaultHourFor("저녁")).toBe(19);
    expect(defaultHourFor("취침")).toBe(21);
  });

  it("기본 시각은 자기 시간대 안에 있다 (자기모순 방지)", () => {
    for (const t of TIME_OF_DAYS) {
      expect(timeOfDayForHour(defaultHourFor(t))).toBe(t);
    }
  });
});

describe("hourForTimeOfDay", () => {
  it("이미 그 시간대 안이면 고른 시각을 유지한다", () => {
    // 점심 12시를 고른 사람이 점심 칩을 다시 눌러도 13시로 튕기면 안 된다.
    expect(hourForTimeOfDay("점심", 12)).toBe(12);
    expect(hourForTimeOfDay("아침", 7)).toBe(7);
  });

  it("시간대를 벗어난 시각이면 기본 시각으로 옮긴다", () => {
    expect(hourForTimeOfDay("점심", 8)).toBe(13);
    expect(hourForTimeOfDay("아침", 22)).toBe(8);
  });

  it("어떤 조합이든 결과는 항상 그 시간대와 일치한다", () => {
    for (const t of TIME_OF_DAYS) {
      for (let h = 0; h < 24; h++) {
        expect(timeOfDayForHour(hourForTimeOfDay(t, h))).toBe(t);
      }
    }
  });
});

describe("isTimeOfDay", () => {
  it("정해진 4종만 통과", () => {
    expect(isTimeOfDay("아침")).toBe(true);
    expect(isTimeOfDay("새벽")).toBe(false);
    expect(isTimeOfDay(null)).toBe(false);
  });
});

describe("slotLabel — 저장값과 표시 이름을 분리한다", () => {
  it("'취침'은 화면에 '자기 전'", () => {
    expect(slotLabel("취침")).toBe("자기 전");
  });
  it("나머지는 그대로", () => {
    expect(slotLabel("아침")).toBe("아침");
    expect(slotLabel("점심")).toBe("점심");
    expect(slotLabel("저녁")).toBe("저녁");
  });
  it("알 수 없는 값은 건드리지 않는다", () => {
    expect(slotLabel("새벽")).toBe("새벽");
  });
});

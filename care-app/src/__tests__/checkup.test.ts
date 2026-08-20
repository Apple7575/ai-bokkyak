import {
  buildCheckupList, checkupGreeting, checkupPrompt, checkupTimeLabel,
  checkupSummary, answerToStatus, CheckupDose,
} from "../lib/checkup";

const dose = (o: Partial<CheckupDose> & { id: string }): CheckupDose => ({
  medicine_name: "약", time_of_day: "아침", hour: 8, minute: 0, repeat_days: [], ...o,
});

describe("buildCheckupList", () => {
  const thu = new Date(2026, 7, 20); // 2026-08-20 목요일 (getDay() === 4)

  it("빈 repeat_days는 매일이라 항상 포함된다 (설계 결정 #1)", () => {
    const list = buildCheckupList([dose({ id: "a", repeat_days: [] })], new Set(), thu);
    expect(list.map((d) => d.id)).toEqual(["a"]);
  });

  it("오늘 요일이 아닌 약은 뺀다", () => {
    const list = buildCheckupList(
      [dose({ id: "a", repeat_days: [4] }), dose({ id: "b", repeat_days: [1, 2] })],
      new Set(), thu
    );
    expect(list.map((d) => d.id)).toEqual(["a"]);
  });

  it("이미 먹은 약은 다시 묻지 않는다", () => {
    const list = buildCheckupList(
      [dose({ id: "a" }), dose({ id: "b", hour: 20 })],
      new Set(["a"]), thu
    );
    expect(list.map((d) => d.id)).toEqual(["b"]);
  });

  it("이른 시각부터 순서대로", () => {
    const list = buildCheckupList(
      [dose({ id: "밤", hour: 21 }), dose({ id: "점심", hour: 13 }), dose({ id: "아침", hour: 8, minute: 30 })],
      new Set(), thu
    );
    expect(list.map((d) => d.id)).toEqual(["아침", "점심", "밤"]);
  });

  it("같은 시각이면 순서가 뒤집히지 않는다", () => {
    const list = buildCheckupList([dose({ id: "a" }), dose({ id: "b" })], new Set(), thu);
    expect(list.map((d) => d.id)).toEqual(["a", "b"]);
  });
});

describe("문구", () => {
  it("이름이 있으면 부르고, 없으면 뺀다", () => {
    expect(checkupGreeting("김복약")).toContain("김복약님");
    expect(checkupGreeting("")).toBe("안녕하세요. 오늘 드실 약을 하나씩 확인해 볼게요.");
    expect(checkupGreeting(null)).not.toContain("님");
  });

  it("묻는 말에 시간대와 약 이름이 들어간다", () => {
    expect(checkupPrompt(dose({ id: "a", medicine_name: "비타민" })))
      .toBe("아침에 드시는 비타민, 드셨어요?");
  });

  it("취침은 화면 표기대로 '자기 전'으로 읽는다", () => {
    expect(checkupPrompt(dose({ id: "a", time_of_day: "취침", medicine_name: "혈압약" })))
      .toBe("자기 전에 드시는 혈압약, 드셨어요?");
  });

  it("시각 라벨", () => {
    expect(checkupTimeLabel(dose({ id: "a", hour: 8, minute: 5 }))).toBe("아침 08:05");
  });
});

describe("checkupSummary", () => {
  it("확인할 약이 없을 때", () => {
    expect(checkupSummary(0, 0)).toContain("확인할 약이 없어요");
  });
  it("다 먹었을 때", () => {
    expect(checkupSummary(3, 3)).toBe("3개 모두 드셨네요. 잘하셨어요.");
  });
  it("하나도 안 먹었을 때는 개수를 들먹이지 않는다", () => {
    expect(checkupSummary(3, 0)).toBe("아직 드시지 않은 약이 있어요. 잊지 말고 챙겨 드세요.");
  });
  it("일부만 먹었을 때", () => {
    expect(checkupSummary(3, 1)).toBe("3개 중 1개 드셨어요. 나머지도 잊지 말고 챙겨 드세요.");
  });
});

describe("answerToStatus", () => {
  it("먹었어요/안먹었어요만 기록한다", () => {
    expect(answerToStatus("먹었어요")).toBe("completed");
    expect(answerToStatus("안먹었어요")).toBe("skipped");
    expect(answerToStatus("나중에")).toBeNull();
  });
});

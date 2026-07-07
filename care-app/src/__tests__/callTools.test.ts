import {
  buildMedsContext,
  matchSchedule,
  parseRecordMedicationArgs,
  toolStatusToIntake,
} from "../lib/callTools";

describe("parseRecordMedicationArgs", () => {
  it("정상 JSON 파싱", () => {
    expect(
      parseRecordMedicationArgs(
        JSON.stringify({ medicine_name: "혈압약", time_of_day: "아침", status: "복용함" })
      )
    ).toEqual({ medicine_name: "혈압약", time_of_day: "아침", status: "복용함" });
  });
  it("깨진 JSON → null", () => {
    expect(parseRecordMedicationArgs("{medicine_name:")).toBeNull();
  });
  it("필드 누락 → null", () => {
    expect(
      parseRecordMedicationArgs(JSON.stringify({ medicine_name: "혈압약", time_of_day: "아침" }))
    ).toBeNull();
  });
  it("문자열 아닌 필드 → null", () => {
    expect(
      parseRecordMedicationArgs(
        JSON.stringify({ medicine_name: 3, time_of_day: "아침", status: "복용함" })
      )
    ).toBeNull();
  });
  it('enum 밖 status("먹음") → null', () => {
    expect(
      parseRecordMedicationArgs(
        JSON.stringify({ medicine_name: "혈압약", time_of_day: "아침", status: "먹음" })
      )
    ).toBeNull();
  });
  it("공백뿐인 약명 → null", () => {
    expect(
      parseRecordMedicationArgs(
        JSON.stringify({ medicine_name: "   ", time_of_day: "아침", status: "복용함" })
      )
    ).toBeNull();
  });
  it("enum 밖 time_of_day → null", () => {
    expect(
      parseRecordMedicationArgs(
        JSON.stringify({ medicine_name: "혈압약", time_of_day: "새벽", status: "복용함" })
      )
    ).toBeNull();
  });
});

describe("toolStatusToIntake", () => {
  it("복용함 → completed", () => {
    expect(toolStatusToIntake("복용함")).toBe("completed");
  });
  it("안먹음 → missed", () => {
    expect(toolStatusToIntake("안먹음")).toBe("missed");
  });
});

describe("matchSchedule", () => {
  const schedules = [
    { id: "a", medicine_name: "혈압약", time_of_day: "아침" },
    { id: "b", medicine_name: "혈압약", time_of_day: "저녁" },
    { id: "c", medicine_name: "당뇨약", time_of_day: "점심" },
  ];
  it("1순위: 약명 부분일치 && time_of_day 완전일치", () => {
    expect(matchSchedule(schedules, { medicine_name: "혈압약", time_of_day: "저녁" })?.id).toBe(
      "b"
    );
  });
  it("2순위: time_of_day 불일치면 약명만 일치하는 것", () => {
    expect(matchSchedule(schedules, { medicine_name: "당뇨약", time_of_day: "아침" })?.id).toBe(
      "c"
    );
  });
  it('공백 무시: "혈압 약" ↔ "혈압약"', () => {
    expect(matchSchedule(schedules, { medicine_name: "혈압 약", time_of_day: "아침" })?.id).toBe(
      "a"
    );
  });
  it('부분일치: 스케줄 "아침 혈압약"에 args "혈압약"', () => {
    const list = [{ id: "x", medicine_name: "아침 혈압약", time_of_day: "아침" }];
    expect(matchSchedule(list, { medicine_name: "혈압약", time_of_day: "아침" })?.id).toBe("x");
  });
  it("매칭 없으면 null", () => {
    expect(matchSchedule(schedules, { medicine_name: "감기약", time_of_day: "아침" })).toBeNull();
  });
  it("빈/공백 약명은 어떤 스케줄에도 매칭되지 않음", () => {
    expect(matchSchedule(schedules, { medicine_name: "", time_of_day: "아침" })).toBeNull();
    expect(matchSchedule(schedules, { medicine_name: "  ", time_of_day: "아침" })).toBeNull();
  });
  it("동순위 여러 개면 배열 앞쪽 우선", () => {
    // 둘 다 2순위(약명만 일치) → 앞쪽 "a"
    expect(matchSchedule(schedules, { medicine_name: "혈압약", time_of_day: "취침" })?.id).toBe(
      "a"
    );
  });
});

describe("buildMedsContext", () => {
  it("taken 표시와 id 미포함", () => {
    const schedules = [
      { id: "a", medicine_name: "혈압약", time_of_day: "아침" },
      { id: "b", medicine_name: "당뇨약", time_of_day: "점심" },
    ];
    const meds = buildMedsContext(schedules, new Set(["a"]));
    expect(meds).toEqual([
      { medicine_name: "혈압약", time_of_day: "아침", taken: true },
      { medicine_name: "당뇨약", time_of_day: "점심", taken: false },
    ]);
    for (const m of meds) {
      expect("id" in m).toBe(false);
    }
  });
});

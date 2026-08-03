import {
  buildMedsContext,
  matchSchedule,
  parseRecordMedicationArgs,
  parseBirthDateArgs,
  parseAddMedicationArgs,
  parseUpdateMedicationArgs,
  parseRemoveMedicationArgs,
  summarizeMedList,
  toolStatusToIntake,
} from "../lib/callTools";

describe("parseBirthDateArgs", () => {
  it("정상 → YYYY-MM-DD", () => {
    expect(parseBirthDateArgs(JSON.stringify({ year: 1948, month: 3, day: 5 }))).toBe("1948-03-05");
  });
  it("한 자리 월/일 zero-pad", () => {
    expect(parseBirthDateArgs(JSON.stringify({ year: 2000, month: 12, day: 9 }))).toBe("2000-12-09");
  });
  it("존재하지 않는 날짜(2월 30일) → null", () => {
    expect(parseBirthDateArgs(JSON.stringify({ year: 1990, month: 2, day: 30 }))).toBeNull();
  });
  it("범위 밖(월 13) → null", () => {
    expect(parseBirthDateArgs(JSON.stringify({ year: 1990, month: 13, day: 1 }))).toBeNull();
  });
  it("정수 아님 → null", () => {
    expect(parseBirthDateArgs(JSON.stringify({ year: 1990.5, month: 1, day: 1 }))).toBeNull();
  });
  it("깨진 JSON → null", () => {
    expect(parseBirthDateArgs("{year:")).toBeNull();
  });
});

describe("parseAddMedicationArgs", () => {
  it("정상 파싱 + 공백 트림", () => {
    expect(
      parseAddMedicationArgs(JSON.stringify({ medicine_name: " 혈압약 ", time_of_day: "저녁", hour: 20, minute: 30 }))
    ).toEqual({ medicine_name: "혈압약", time_of_day: "저녁", hour: 20, minute: 30 });
  });
  it("minute 없으면 0", () => {
    expect(
      parseAddMedicationArgs(JSON.stringify({ medicine_name: "비타민", time_of_day: "아침", hour: 8 }))
    ).toEqual({ medicine_name: "비타민", time_of_day: "아침", hour: 8, minute: 0 });
  });
  it("빈 약명 → null", () => {
    expect(parseAddMedicationArgs(JSON.stringify({ medicine_name: "  ", time_of_day: "아침", hour: 8 }))).toBeNull();
  });
  it("시간대 enum 밖 → null", () => {
    expect(parseAddMedicationArgs(JSON.stringify({ medicine_name: "약", time_of_day: "새벽", hour: 3 }))).toBeNull();
  });
  it("hour 범위 밖 → null", () => {
    expect(parseAddMedicationArgs(JSON.stringify({ medicine_name: "약", time_of_day: "아침", hour: 24 }))).toBeNull();
  });
  it("hour 정수 아님 → null", () => {
    expect(parseAddMedicationArgs(JSON.stringify({ medicine_name: "약", time_of_day: "아침", hour: 8.5 }))).toBeNull();
  });
});

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
  it("안먹음 → skipped (DB IntakeStatus 값 — missed는 표시 전용)", () => {
    expect(toolStatusToIntake("안먹음")).toBe("skipped");
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

describe("parseUpdateMedicationArgs", () => {
  it("바꿀 필드만 담아 돌려준다", () => {
    expect(parseUpdateMedicationArgs('{"index":1,"hour":20}')).toEqual({ index: 1, hour: 20 });
    expect(parseUpdateMedicationArgs('{"index":0,"medicine_name":" 혈압약 ","time_of_day":"저녁"}'))
      .toEqual({ index: 0, medicine_name: "혈압약", time_of_day: "저녁" });
  });

  it("index만 있고 바꿀 게 없으면 null", () => {
    expect(parseUpdateMedicationArgs('{"index":0}')).toBeNull();
  });

  it("null로 온 필드는 '변경 없음'으로 무시한다", () => {
    expect(parseUpdateMedicationArgs('{"index":0,"medicine_name":null,"hour":9}'))
      .toEqual({ index: 0, hour: 9 });
    // 전부 null이면 바꿀 게 없으므로 null
    expect(parseUpdateMedicationArgs('{"index":0,"medicine_name":null}')).toBeNull();
  });

  it("잘못된 index / 범위 밖 값 / 빈 약명은 null", () => {
    expect(parseUpdateMedicationArgs('{"index":-1,"hour":8}')).toBeNull();
    expect(parseUpdateMedicationArgs('{"index":1.5,"hour":8}')).toBeNull();
    expect(parseUpdateMedicationArgs('{"hour":8}')).toBeNull();
    expect(parseUpdateMedicationArgs('{"index":0,"hour":24}')).toBeNull();
    expect(parseUpdateMedicationArgs('{"index":0,"minute":60}')).toBeNull();
    expect(parseUpdateMedicationArgs('{"index":0,"medicine_name":"   "}')).toBeNull();
    expect(parseUpdateMedicationArgs('{"index":0,"time_of_day":"새벽"}')).toBeNull();
    expect(parseUpdateMedicationArgs("깨진 JSON")).toBeNull();
  });

  it("경계값 hour 0/23, minute 0/59 허용", () => {
    expect(parseUpdateMedicationArgs('{"index":0,"hour":0}')).toEqual({ index: 0, hour: 0 });
    expect(parseUpdateMedicationArgs('{"index":0,"hour":23,"minute":59}'))
      .toEqual({ index: 0, hour: 23, minute: 59 });
    expect(parseUpdateMedicationArgs('{"index":0,"minute":0}')).toEqual({ index: 0, minute: 0 });
  });
});

describe("parseRemoveMedicationArgs", () => {
  it("0 이상 정수 index만 허용", () => {
    expect(parseRemoveMedicationArgs('{"index":0}')).toBe(0);
    expect(parseRemoveMedicationArgs('{"index":3}')).toBe(3);
    expect(parseRemoveMedicationArgs('{"index":-1}')).toBeNull();
    expect(parseRemoveMedicationArgs('{"index":"1"}')).toBeNull();
    expect(parseRemoveMedicationArgs("{}")).toBeNull();
    expect(parseRemoveMedicationArgs("깨진 JSON")).toBeNull();
  });
});

describe("summarizeMedList", () => {
  it("현재 순서대로 0부터 번호를 다시 매긴다", () => {
    const meds = summarizeMedList([
      { medicine_name: "혈압약", time_of_day: "아침", hour: 8, minute: 0 },
      { medicine_name: "당뇨약", time_of_day: "저녁", hour: 19, minute: 5 },
    ]);
    expect(meds).toEqual([
      { index: 0, medicine_name: "혈압약", time_of_day: "아침", time: "08:00" },
      { index: 1, medicine_name: "당뇨약", time_of_day: "저녁", time: "19:05" },
    ]);
  });
});

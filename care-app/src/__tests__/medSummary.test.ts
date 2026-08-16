import {
  groupByMedicine, describeDoses, describeRepeat, buildDoseRows, DoseLike,
} from "../lib/medSummary";

const d = (id: string, name: string, tod: string, hour: number, minute = 0, repeat: number[] = [], amount?: string): DoseLike => ({
  id, medicine_name: name, time_of_day: tod, hour, minute, repeat_days: repeat, dose_amount: amount,
});

describe("groupByMedicine", () => {
  it("같은 약을 한 묶음으로 모으고 시간대 순으로 정렬한다", () => {
    const g = groupByMedicine([
      d("2", "오메가3", "저녁", 20),
      d("1", "오메가3", "아침", 8),
      d("3", "혈압약", "아침", 8),
    ]);
    expect(g).toHaveLength(2);
    expect(g[0].name).toBe("오메가3");
    expect(g[0].doses.map((x) => x.time_of_day)).toEqual(["아침", "저녁"]);
    expect(g[0].timesPerDay).toBe(2);
  });

  it("같은 시간대면 이른 시각이 앞", () => {
    const g = groupByMedicine([d("1", "약", "아침", 9), d("2", "약", "아침", 7, 30)]);
    expect(g[0].doses.map((x) => x.hour)).toEqual([7, 9]);
  });

  it("하나라도 요일 반복이면 everyDay=false", () => {
    expect(groupByMedicine([d("1", "약", "아침", 8), d("2", "약", "저녁", 20)])[0].everyDay).toBe(true);
    expect(groupByMedicine([d("1", "약", "아침", 8, 0, [1, 3])])[0].everyDay).toBe(false);
  });

  it("복용량은 값이 있는 첫 항목에서 가져온다", () => {
    const g = groupByMedicine([d("1", "약", "아침", 8), d("2", "약", "저녁", 20, 0, [], "2정")]);
    expect(g[0].doseAmount).toBe("2정");
  });

  it("빈 목록은 빈 결과", () => {
    expect(groupByMedicine([])).toEqual([]);
  });
});

describe("describeDoses", () => {
  it("'취침'은 화면에 '자기 전'으로 보인다 — 저장값은 그대로 '취침'", () => {
    // 저장값을 바꾸면 알람 소리(night.mp3)·채널 키와 기존 행이 깨진다.
    const g = groupByMedicine([d("1", "약", "취침", 22)])[0];
    expect(g.doses[0].time_of_day).toBe("취침");
    expect(describeDoses(g)).toBe("1일 1회 · 자기 전 22:00");
  });

  it("1일 N회 · 시간대 시각", () => {
    const g = groupByMedicine([d("1", "약", "아침", 8), d("2", "약", "저녁", 20)])[0];
    expect(describeDoses(g)).toBe("1일 2회 · 아침 08:00, 저녁 20:00");
  });

  it("많으면 뒤를 접는다", () => {
    const g = groupByMedicine([
      d("1", "약", "아침", 8), d("2", "약", "점심", 13), d("3", "약", "저녁", 19), d("4", "약", "취침", 21),
    ])[0];
    expect(describeDoses(g)).toBe("1일 4회 · 아침 08:00, 점심 13:00 외 2개");
  });

  it("1회면 접지 않는다", () => {
    const g = groupByMedicine([d("1", "약", "아침", 8, 5)])[0];
    expect(describeDoses(g)).toBe("1일 1회 · 아침 08:05");
  });
});

describe("describeRepeat", () => {
  it("매일", () => {
    expect(describeRepeat(groupByMedicine([d("1", "약", "아침", 8)])[0])).toBe("매일");
  });
  it("요일 나열 (정렬)", () => {
    expect(describeRepeat(groupByMedicine([d("1", "약", "아침", 8, 0, [5, 1, 3])])[0])).toBe("월·수·금요일");
  });
  it("여러 행의 요일을 합친다", () => {
    const g = groupByMedicine([d("1", "약", "아침", 8, 0, [1]), d("2", "약", "저녁", 20, 0, [3])])[0];
    expect(describeRepeat(g)).toBe("월·수요일");
  });
});

describe("buildDoseRows", () => {
  const timeBy = {
    아침: { hour: 8, minute: 0 },
    점심: { hour: 13, minute: 0 },
    저녁: { hour: 19, minute: 30 },
    취침: { hour: 21, minute: 0 },
  } as const;

  it("고른 시간대만, 항상 아침→점심→저녁→취침 순으로", () => {
    expect(buildDoseRows(["저녁", "아침"], { ...timeBy })).toEqual([
      { time_of_day: "아침", hour: 8, minute: 0 },
      { time_of_day: "저녁", hour: 19, minute: 30 },
    ]);
  });

  it("하나만 고르면 한 행", () => {
    expect(buildDoseRows(["취침"], { ...timeBy })).toEqual([
      { time_of_day: "취침", hour: 21, minute: 0 },
    ]);
  });

  it("아무것도 안 고르면 빈 배열", () => {
    expect(buildDoseRows([], { ...timeBy })).toEqual([]);
  });
});

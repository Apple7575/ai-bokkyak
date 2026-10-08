import {
  AlarmSetup, sanitizeMedicines, initialSetup, initialTimes, toggleMedSlot, pickCount,
  chosenSlots, chosenTimes, canFinish, unslottedMedicines, showsUnslottedNote, medicinesAt,
  bumpTime, bumpSlotTime, clock12, ampm, bannerText, scheduleRows,
} from "../lib/voiceGuideFlow";

// 회의 2026-09-03·09-06·09-12: 알람 설정 4단계 → 1단계.
// Case A(점검 후)는 약별 시간대, Case C(점검 건너뜀)는 하루 횟수.

const MEDS = ["오메가3", "비타민D", "혈압약", "아스피린"];

function pick(s: AlarmSetup, picks: [string, "아침" | "점심" | "저녁" | "취침"][]): AlarmSetup {
  return picks.reduce((acc, [m, slot]) => toggleMedSlot(acc, m, slot), s);
}

describe("sanitizeMedicines — 앞 화면이 넘긴 약 이름 정리", () => {
  it("앞뒤 공백을 떼고 빈 이름·중복을 버린다(처음 나온 순서 유지)", () => {
    expect(sanitizeMedicines([" 혈압약", "오메가3 ", "", "   ", "혈압약", "오메가3", "비타민D"]))
      .toEqual(["혈압약", "오메가3", "비타민D"]);
  });
  it("배열이 아니거나 문자열이 아닌 값은 버린다", () => {
    expect(sanitizeMedicines(undefined)).toEqual([]);
    expect(sanitizeMedicines(null)).toEqual([]);
    expect(sanitizeMedicines("혈압약")).toEqual([]);
    expect(sanitizeMedicines([1, null, { name: "x" }, "아스피린"])).toEqual(["아스피린"]);
  });
});

describe("initialSetup — 모드와 첫 상태", () => {
  it("약 이름이 있으면 약별 모드(Case A)", () => {
    const s = initialSetup(MEDS);
    expect(s.mode).toBe("medicines");
    expect(s.medicines).toEqual(MEDS);
  });
  it("이름이 없거나 정리하고 남는 게 없으면 횟수 모드(Case C)", () => {
    expect(initialSetup(undefined).mode).toBe("count");
    expect(initialSetup([]).mode).toBe("count");
    expect(initialSetup(["", "  "]).mode).toBe("count");
  });
  it("미리 골라 둔 시간대가 없다 — 저녁 약을 아침으로 짐작하지 않는다", () => {
    const s = initialSetup(MEDS);
    for (const m of MEDS) expect(s.medSlots[m]).toEqual([]);
    expect(chosenSlots(s)).toEqual([]);
    expect(canFinish(s)).toBe(false);
  });
  it("직접 입력한 이름이 객체 예약어여도 제 칸을 가진다", () => {
    let s = initialSetup(["__proto__", "constructor"]);
    expect(s.medSlots["__proto__"]).toEqual([]);
    expect(s.medSlots["constructor"]).toEqual([]);
    s = toggleMedSlot(toggleMedSlot(s, "__proto__", "아침"), "constructor", "저녁");
    expect(scheduleRows(s).map((r) => [r.medicine_name, r.time_of_day]))
      .toEqual([["__proto__", "아침"], ["constructor", "저녁"]]);
  });
  it("시각은 시간대마다 식후 기본값 8:00 · 12:00 · 18:00 · 22:00", () => {
    expect(initialTimes()).toEqual({
      아침: { hour: 8, minute: 0 }, 점심: { hour: 12, minute: 0 },
      저녁: { hour: 18, minute: 0 }, 취침: { hour: 22, minute: 0 },
    });
  });
});

describe("약별 모드 — 시간대 칩", () => {
  it("여러 개를 고를 수 있고, 다시 누르면 꺼진다", () => {
    let s = pick(initialSetup(MEDS), [["오메가3", "저녁"], ["오메가3", "아침"]]);
    expect(s.medSlots["오메가3"]).toEqual(["아침", "저녁"]); // 누른 순서가 아니라 SLOTS 순서
    s = toggleMedSlot(s, "오메가3", "아침");
    expect(s.medSlots["오메가3"]).toEqual(["저녁"]);
  });
  it("다른 약의 선택은 건드리지 않는다", () => {
    const s = pick(initialSetup(MEDS), [["오메가3", "저녁"], ["혈압약", "아침"]]);
    expect(s.medSlots["비타민D"]).toEqual([]);
    expect(s.medSlots["혈압약"]).toEqual(["아침"]);
  });
  it("목록에 없는 이름은 무시한다", () => {
    const s = initialSetup(MEDS);
    expect(toggleMedSlot(s, "없는약", "아침")).toBe(s);
  });
  it("고른 시간대는 약 전체의 합집합을 SLOTS 순서로", () => {
    const s = pick(initialSetup(MEDS), [["오메가3", "취침"], ["비타민D", "저녁"], ["혈압약", "아침"], ["아스피린", "아침"]]);
    expect(chosenSlots(s)).toEqual(["아침", "저녁", "취침"]);
    expect(canFinish(s)).toBe(true);
  });
  it("시간대별 약 이름은 점검한 순서대로", () => {
    const s = pick(initialSetup(MEDS), [["아스피린", "아침"], ["비타민D", "아침"], ["오메가3", "저녁"]]);
    expect(medicinesAt(s, "아침")).toEqual(["비타민D", "아스피린"]);
    expect(medicinesAt(s, "저녁")).toEqual(["오메가3"]);
    expect(medicinesAt(s, "점심")).toEqual([]);
  });
});

describe("시간을 고르지 않은 약 안내", () => {
  it("아무것도 안 고른 처음에는 띄우지 않는다", () => {
    expect(showsUnslottedNote(initialSetup(MEDS))).toBe(false);
  });
  it("하나라도 골랐는데 빠진 약이 있으면 띄운다", () => {
    const s = pick(initialSetup(MEDS), [["혈압약", "아침"]]);
    expect(unslottedMedicines(s)).toEqual(["오메가3", "비타민D", "아스피린"]);
    expect(showsUnslottedNote(s)).toBe(true);
  });
  it("모든 약에 시간대가 있으면 띄우지 않는다", () => {
    const s = pick(initialSetup(["혈압약", "오메가3"]), [["혈압약", "아침"], ["오메가3", "저녁"]]);
    expect(showsUnslottedNote(s)).toBe(false);
  });
  it("횟수 모드에는 해당 없다", () => {
    expect(showsUnslottedNote(pickCount(initialSetup([]), 2))).toBe(false);
  });
});

describe("횟수 모드 (Case C)", () => {
  const empty = initialSetup([]);
  it("횟수를 고르기 전에는 완료할 수 없다", () => {
    expect(chosenSlots(empty)).toEqual([]);
    expect(canFinish(empty)).toBe(false);
  });
  it("횟수에 맞는 시간대", () => {
    expect(chosenSlots(pickCount(empty, 1))).toEqual(["아침"]);
    expect(chosenSlots(pickCount(empty, 2))).toEqual(["아침", "저녁"]);
    expect(chosenSlots(pickCount(empty, 3))).toEqual(["아침", "점심", "저녁"]);
    expect(chosenSlots(pickCount(empty, 4))).toEqual(["아침", "점심", "저녁", "취침"]);
    expect(canFinish(pickCount(empty, 1))).toBe(true);
  });
  it("4 이상은 「4번 이상」으로 묶고, 0 이하는 무시한다", () => {
    expect(pickCount(empty, 6).count).toBe(4);
    expect(pickCount(empty, 0)).toBe(empty);
    expect(pickCount(empty, Number.NaN)).toBe(empty);
  });
  it("횟수를 바꿔도 시간대별로 고친 시각은 남는다", () => {
    let s = bumpSlotTime(pickCount(empty, 2), "저녁", 60);
    s = pickCount(s, 1);
    s = pickCount(s, 2);
    expect(chosenTimes(s)).toEqual([
      { slot: "아침", hour: 8, minute: 0 },
      { slot: "저녁", hour: 19, minute: 0 },
    ]);
  });
});

describe("시각 — ±30분", () => {
  it("30분씩 앞뒤로", () => {
    expect(bumpTime({ hour: 8, minute: 0 }, 30)).toEqual({ hour: 8, minute: 30 });
    expect(bumpTime({ hour: 8, minute: 0 }, -30)).toEqual({ hour: 7, minute: 30 });
  });
  it("자정을 넘으면 하루 안으로 돌린다", () => {
    expect(bumpTime({ hour: 23, minute: 30 }, 30)).toEqual({ hour: 0, minute: 0 });
    expect(bumpTime({ hour: 0, minute: 0 }, -30)).toEqual({ hour: 23, minute: 30 });
  });
  it("시간대 하나만 바뀐다", () => {
    const s = bumpSlotTime(initialSetup(MEDS), "아침", 30);
    expect(s.times.아침).toEqual({ hour: 8, minute: 30 });
    expect(s.times.저녁).toEqual({ hour: 18, minute: 0 });
  });
  it("칩을 껐다 켜도 고친 시각이 남는다", () => {
    let s = pick(initialSetup(MEDS), [["혈압약", "아침"]]);
    s = bumpSlotTime(s, "아침", -30);
    s = toggleMedSlot(s, "혈압약", "아침");
    expect(chosenSlots(s)).toEqual([]);
    s = toggleMedSlot(s, "혈압약", "아침");
    expect(chosenTimes(s)).toEqual([{ slot: "아침", hour: 7, minute: 30 }]);
  });
});

describe("시각 표시", () => {
  it("clock12 — 오전·오후 없이 12시간제", () => {
    expect(clock12(8, 0)).toBe("8:00");
    expect(clock12(12, 0)).toBe("12:00");
    expect(clock12(18, 0)).toBe("6:00");
    expect(clock12(0, 30)).toBe("12:30");
    expect(clock12(22, 5)).toBe("10:05");
  });
  it("ampm — 시트·완료 화면용", () => {
    expect(ampm(8, 0)).toBe("오전 8:00");
    expect(ampm(12, 0)).toBe("오후 12:00");
    expect(ampm(18, 30)).toBe("오후 6:30");
    expect(ampm(0, 0)).toBe("오전 12:00");
  });
});

describe("bannerText — 시각 요약 배너", () => {
  it("고른 시간대가 없으면 빈 문자열", () => {
    expect(bannerText(initialSetup(MEDS))).toBe("");
    expect(bannerText(initialSetup([]))).toBe("");
  });
  it("한 시간대", () => {
    expect(bannerText(pick(initialSetup(MEDS), [["혈압약", "아침"]]))).toBe("아침 8:00에 알려드릴게요");
  });
  it("두 시간대 — 시안 그대로", () => {
    const s = pick(initialSetup(MEDS), [["오메가3", "저녁"], ["비타민D", "아침"]]);
    expect(bannerText(s)).toBe("아침 8:00 · 저녁 6:00에 알려드릴게요");
  });
  it("세 시간대 — 12:00은 그대로, 18:00은 6:00", () => {
    expect(bannerText(pickCount(initialSetup([]), 3))).toBe("아침 8:00 · 점심 12:00 · 저녁 6:00에 알려드릴게요");
  });
  it("취침은 「자기 전」, 고친 시각이 반영된다", () => {
    const s = bumpSlotTime(pick(initialSetup(MEDS), [["오메가3", "취침"]]), "취침", 30);
    expect(bannerText(s)).toBe("자기 전 10:30에 알려드릴게요");
  });
});

describe("scheduleRows — 저장할 행", () => {
  it("약별: 약 × 고른 시간대마다 한 행, 이름은 약 이름 그대로", () => {
    let s = pick(initialSetup(MEDS), [["오메가3", "저녁"], ["비타민D", "아침"], ["혈압약", "아침"], ["혈압약", "저녁"]]);
    s = bumpSlotTime(s, "저녁", 30);
    expect(scheduleRows(s)).toEqual([
      { medicine_name: "오메가3", time_of_day: "저녁", hour: 18, minute: 30, repeat_days: [], active: true },
      { medicine_name: "비타민D", time_of_day: "아침", hour: 8, minute: 0, repeat_days: [], active: true },
      { medicine_name: "혈압약", time_of_day: "아침", hour: 8, minute: 0, repeat_days: [], active: true },
      { medicine_name: "혈압약", time_of_day: "저녁", hour: 18, minute: 30, repeat_days: [], active: true },
    ]);
  });
  it("시간대를 안 고른 약은 저장하지 않는다(아스피린)", () => {
    const s = pick(initialSetup(MEDS), [["혈압약", "아침"]]);
    expect(scheduleRows(s).map((r) => r.medicine_name)).toEqual(["혈압약"]);
  });
  it("횟수: 시간대마다 한 행, 이름은 「시간대 약」", () => {
    const s = bumpSlotTime(pickCount(initialSetup([]), 4), "취침", -60);
    expect(scheduleRows(s)).toEqual([
      { medicine_name: "아침 약", time_of_day: "아침", hour: 8, minute: 0, repeat_days: [], active: true },
      { medicine_name: "점심 약", time_of_day: "점심", hour: 12, minute: 0, repeat_days: [], active: true },
      { medicine_name: "저녁 약", time_of_day: "저녁", hour: 18, minute: 0, repeat_days: [], active: true },
      { medicine_name: "취침 약", time_of_day: "취침", hour: 21, minute: 0, repeat_days: [], active: true },
    ]);
  });
  it("아무것도 안 골랐으면 행이 없다", () => {
    expect(scheduleRows(initialSetup(MEDS))).toEqual([]);
    expect(scheduleRows(initialSetup([]))).toEqual([]);
  });
  it("repeat_days 는 늘 빈 배열(매일)", () => {
    const rows = scheduleRows(pickCount(initialSetup([]), 2));
    for (const r of rows) expect(r.repeat_days).toEqual([]);
  });
});

describe("scheduleRows — 한 번에 넣는 행 묶음", () => {
  it("한 설정 안에서 (약 이름, 시간대)가 겹치지 않는다 — 한 번의 insert로 넣어도 중복 알람이 없다", () => {
    const s = pick(initialSetup(MEDS), [["오메가3", "저녁"], ["오메가3", "아침"], ["혈압약", "아침"]]);
    const keys = scheduleRows(s).map((r) => `${r.medicine_name}|${r.time_of_day}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

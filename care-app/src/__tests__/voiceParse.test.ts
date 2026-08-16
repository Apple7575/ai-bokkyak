import {
  parseCount, parseSlots, parseTimes, parseYesNo, isAfterMeal,
  parseUtterance, defaultSlotsFor, afterMealTimes, toDayHour,
} from "../lib/voiceParse";

describe("parseCount", () => {
  it("문서 예시 발화", () => {
    expect(parseCount("하루 3번 먹어")).toBe(3);
    expect(parseCount("세 번")).toBe(3);
    expect(parseCount("두 번 먹어요")).toBe(2);
    expect(parseCount("한 번")).toBe(1);
  });
  it("4번 이상은 4로 묶는다(화면 버튼과 동일)", () => {
    expect(parseCount("다섯 번")).toBe(4);
    expect(parseCount("6번")).toBe(4);
  });
  it("횟수가 없으면 null", () => {
    expect(parseCount("아침에 먹어요")).toBeNull();
    expect(parseCount("")).toBeNull();
  });
  it("'네'만 있으면 긍정이지 횟수가 아니다", () => {
    // "네 번"은 4회지만 "네"는 긍정 응답이다.
    expect(parseCount("네")).toBeNull();
    expect(parseCount("네 번")).toBe(4);
  });
});

describe("parseSlots", () => {
  it("말한 순서를 유지하고 중복을 제거한다", () => {
    expect(parseSlots("아침 점심 저녁")).toEqual(["아침", "점심", "저녁"]);
    expect(parseSlots("저녁이랑 아침")).toEqual(["저녁", "아침"]);
    expect(parseSlots("아침 아침")).toEqual(["아침"]);
  });
  it("동의어도 잡는다", () => {
    expect(parseSlots("자기 전에")).toEqual(["취침"]);
    expect(parseSlots("밤에")).toEqual(["취침"]);
  });
});

describe("parseTimes", () => {
  it("문서 예시: 아침 8시, 점심 12시, 저녁 6시", () => {
    expect(parseTimes("아침 8시, 점심 12시, 저녁 6시")).toEqual([
      { slot: "아침", hour: 8, minute: 0 },
      { slot: "점심", hour: 12, minute: 0 },
      { slot: "저녁", hour: 18, minute: 0 },
    ]);
  });
  it("'반'을 30분으로 읽는다", () => {
    expect(parseTimes("저녁 6시 반")).toEqual([{ slot: "저녁", hour: 18, minute: 30 }]);
  });
  it("분 단위도 읽는다", () => {
    expect(parseTimes("아침 8시 15분")).toEqual([{ slot: "아침", hour: 8, minute: 15 }]);
  });
  it("시간대 없이 시각만 말하면 버린다 — 어느 끼니인지 알 수 없다", () => {
    expect(parseTimes("8시")).toEqual([]);
  });
});

describe("toDayHour — 어르신은 12시간제로 말한다", () => {
  it("저녁 6시는 18시", () => { expect(toDayHour("저녁", 6)).toBe(18); });
  it("점심 1시는 13시", () => { expect(toDayHour("점심", 1)).toBe(13); });
  it("취침 9시는 21시", () => { expect(toDayHour("취침", 9)).toBe(21); });
  it("아침 8시는 그대로 8시", () => { expect(toDayHour("아침", 8)).toBe(8); });
  it("이미 24시간제로 말해도 그대로 둔다", () => {
    expect(toDayHour("저녁", 18)).toBe(18);
    expect(toDayHour("점심", 13)).toBe(13);
  });
});

describe("parseYesNo", () => {
  it("긍정", () => {
    expect(parseYesNo("네")).toBe(true);
    expect(parseYesNo("맞아요")).toBe(true);
  });
  it("부정", () => {
    expect(parseYesNo("아니요")).toBe(false);
    expect(parseYesNo("다시 할래")).toBe(false);
  });
  it("'네 번'의 네는 긍정이 아니다", () => {
    expect(parseYesNo("네 번")).toBeNull();
  });
  it("부정이 긍정보다 우선", () => {
    // "아니요"류가 섞이면 부정으로 본다 — 잘못 긍정 처리하면 틀린 설정이 저장된다.
    expect(parseYesNo("아니요 다시")).toBe(false);
  });
  it("해당 없으면 null", () => {
    expect(parseYesNo("아침에 먹어요")).toBeNull();
  });
});

describe("isAfterMeal", () => {
  it("문서 예시 발화", () => {
    expect(isAfterMeal("밥 먹고 나서")).toBe(true);
    expect(isAfterMeal("식후")).toBe(true);
    expect(isAfterMeal("식사 후에요")).toBe(true);
  });
  it("아니면 false", () => { expect(isAfterMeal("아침 8시")).toBe(false); });
});

describe("parseUtterance — 멀티 정보 발화 (문서 §5)", () => {
  it("하루 3번 아침 점심 저녁에 먹어 → 횟수+시간대 동시 인식", () => {
    const u = parseUtterance("하루 3번 아침 점심 저녁에 먹어");
    expect(u.count).toBe(3);
    expect(u.slots).toEqual(["아침", "점심", "저녁"]);
  });
  it("횟수와 시각을 함께 말한 경우", () => {
    const u = parseUtterance("하루 2번 아침 8시 저녁 7시");
    expect(u.count).toBe(2);
    expect(u.times).toEqual([
      { slot: "아침", hour: 8, minute: 0 },
      { slot: "저녁", hour: 19, minute: 0 },
    ]);
  });
});

describe("defaultSlotsFor / afterMealTimes", () => {
  it("횟수별 기본 시간대", () => {
    expect(defaultSlotsFor(1)).toEqual(["아침"]);
    expect(defaultSlotsFor(2)).toEqual(["아침", "저녁"]);
    expect(defaultSlotsFor(3)).toEqual(["아침", "점심", "저녁"]);
    expect(defaultSlotsFor(4)).toEqual(["아침", "점심", "저녁", "취침"]);
  });
  it("식후 기본값은 문서 §4 값과 일치한다", () => {
    // 이 값이 바뀌면 V03 녹음도 다시 해야 한다.
    expect(afterMealTimes(["아침", "점심", "저녁"])).toEqual([
      { slot: "아침", hour: 8, minute: 0 },
      { slot: "점심", hour: 12, minute: 30 },
      { slot: "저녁", hour: 18, minute: 30 },
    ]);
  });
});

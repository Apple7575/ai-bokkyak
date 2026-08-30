import {
  SUPPLEMENT_PRESETS, MEDICINE_PRESETS, NONE_SUPPLEMENT, NONE_MEDICINE,
  toggleItem, addItem, checkItems, splitResult, unmatchedNames, checkedCount, EMPTY_DRAFT,
} from "../lib/quickCheck";
import type { Finding } from "../lib/interactions";

const f = (a: string, b: string): Finding => ({
  medA: a, medB: b, ingredientA: "x", ingredientB: "y", reason: null, notice_no: null,
});

describe("presets", () => {
  it("영양제·복용약 각 9개, 중복 없음", () => {
    expect(SUPPLEMENT_PRESETS).toHaveLength(9);
    expect(MEDICINE_PRESETS).toHaveLength(9);
    expect(new Set([...SUPPLEMENT_PRESETS, ...MEDICINE_PRESETS]).size).toBe(18);
  });
});

describe("toggleItem", () => {
  it("항목을 켜고 끈다", () => {
    const on = toggleItem([], "오메가3", NONE_SUPPLEMENT);
    expect(on).toEqual(["오메가3"]);
    expect(toggleItem(on, "오메가3", NONE_SUPPLEMENT)).toEqual([]);
  });
  it("없음을 고르면 나머지를 지우고 혼자 남는다", () => {
    expect(toggleItem(["오메가3", "칼슘"], NONE_SUPPLEMENT, NONE_SUPPLEMENT)).toEqual([NONE_SUPPLEMENT]);
  });
  it("없음을 다시 누르면 빈 목록", () => {
    expect(toggleItem([NONE_SUPPLEMENT], NONE_SUPPLEMENT, NONE_SUPPLEMENT)).toEqual([]);
  });
  it("없음이 켜진 상태에서 실제 항목을 고르면 없음이 빠진다", () => {
    expect(toggleItem([NONE_MEDICINE], "혈압약", NONE_MEDICINE)).toEqual(["혈압약"]);
  });
  it("순서를 보존한다", () => {
    const l = toggleItem(toggleItem(["칼슘"], "철분", NONE_SUPPLEMENT), "오메가3", NONE_SUPPLEMENT);
    expect(l).toEqual(["칼슘", "철분", "오메가3"]);
  });
});

describe("addItem", () => {
  it("공백을 다듬어 추가한다", () => {
    expect(addItem([], "  타이레놀정 ", NONE_MEDICINE)).toEqual(["타이레놀정"]);
  });
  it("빈 값은 무시", () => {
    expect(addItem(["혈압약"], "   ", NONE_MEDICINE)).toEqual(["혈압약"]);
  });
  it("중복은 한 번만", () => {
    expect(addItem(["혈압약"], "혈압약", NONE_MEDICINE)).toEqual(["혈압약"]);
  });
  it("없음 라벨을 밀어낸다", () => {
    expect(addItem([NONE_MEDICINE], "타이레놀정", NONE_MEDICINE)).toEqual(["타이레놀정"]);
  });
});

describe("checkItems", () => {
  it("영양제와 약을 합치고 없음 라벨은 뺀다", () => {
    expect(checkItems({ supplements: ["오메가3", NONE_SUPPLEMENT], medicines: [NONE_MEDICINE, "혈압약"] }))
      .toEqual(["오메가3", "혈압약"]);
  });
  it("양쪽에 같은 이름이 있으면 하나로", () => {
    expect(checkItems({ supplements: ["칼슘"], medicines: ["칼슘", "위장약"] })).toEqual(["칼슘", "위장약"]);
  });
  it("둘 다 없음이면 빈 목록", () => {
    expect(checkItems({ supplements: [NONE_SUPPLEMENT], medicines: [NONE_MEDICINE] })).toEqual([]);
  });
});

describe("splitResult", () => {
  it("0건: 보여줄 것도 잠글 것도 없다", () => {
    expect(splitResult([])).toEqual({ shown: null, lockedCount: 0 });
  });
  it("1건: 첫 건만, 잠금 0", () => {
    const a = f("A", "B");
    expect(splitResult([a])).toEqual({ shown: a, lockedCount: 0 });
  });
  it("3건: 첫 건 + 잠금 2", () => {
    const a = f("A", "B");
    expect(splitResult([a, f("C", "D"), f("E", "F")])).toEqual({ shown: a, lockedCount: 2 });
  });

  describe("unmatchedNames", () => {
    it("성분이 비었거나 없는 이름만 돌려준다", () => {
      expect(unmatchedNames(["혈압약", "노바스크정", "오메가3"], { "노바스크정": ["amlodipine"], "오메가3": [] }))
        .toEqual(["혈압약", "오메가3"]);
    });
    it("전부 찾았으면 빈 배열", () => {
      expect(unmatchedNames(["A"], { A: ["x"] })).toEqual([]);
    });
  });

  it("checkedCount: 고른 이름에서 못 찾은 이름을 뺀다", () => {
    expect(checkedCount({ ...EMPTY_DRAFT, supplements: ["오메가3"], medicines: ["혈압약", "노바스크정"], unmatched: ["혈압약"] })).toBe(2);
    expect(checkedCount({ ...EMPTY_DRAFT, medicines: ["혈압약"], unmatched: ["혈압약"] })).toBe(0);
  });
});

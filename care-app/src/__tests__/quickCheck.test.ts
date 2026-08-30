import {
  SUPPLEMENT_PRESETS, SUPPLEMENT_MORE, MEDICINE_PRESETS, AGES, CONDS, NONE_SUPPLEMENT, NONE_MEDICINE, NONE_CONDITION,
  toggleItem, addItem, checkItems, splitResult, unmatchedNames, checkedCount, EMPTY_DRAFT,
  isPreset, customNames, durToQuickFinding, mergeFindings, summarize, topFinding, lockedGroups, groupByKind,
} from "../lib/quickCheck";
import type { Finding } from "../lib/interactions";
import type { QuickFinding, RuleKind } from "../lib/quickCheckRules";

const dur = (a: string, b: string, reason: string | null = null): Finding => ({
  medA: a, medB: b, ingredientA: "x", ingredientB: "y", reason, notice_no: "2024-1",
});
const f = (a: string, b: string, kind: RuleKind = "priority"): QuickFinding => ({
  kind, a, b, title: `${a} × ${b}`, message: "m", tag: "t", source: "rule",
});

describe("presets (시안 V8 그대로)", () => {
  it("영양제 8개 + 더 보기 4개, 복용약 9개, 서로 중복 없음", () => {
    expect(SUPPLEMENT_PRESETS).toHaveLength(8);
    expect(SUPPLEMENT_MORE).toHaveLength(4);
    expect(MEDICINE_PRESETS).toHaveLength(9);
    expect(new Set([...SUPPLEMENT_PRESETS, ...SUPPLEMENT_MORE, ...MEDICINE_PRESETS]).size).toBe(21);
  });
  it("영양제 목록은 시안 순서", () => {
    expect([...SUPPLEMENT_PRESETS]).toEqual(["오메가3", "비타민D", "마그네슘", "유산균", "종합비타민", "철분", "루테인", "밀크씨슬"]);
    expect([...SUPPLEMENT_MORE]).toEqual(["콜라겐", "아연", "홍삼", "단백질보충제"]);
  });
  it("복용약 목록은 시안 순서(피임약·항우울제·여드름약 포함)", () => {
    expect([...MEDICINE_PRESETS]).toEqual(["갑상선약", "혈압약", "고지혈증약", "위장약", "통증·소염제", "알레르기약", "피임약", "항우울제", "여드름약"]);
  });
  it("연령대 5개, 해당 항목 4개(마지막이 해당 없음)", () => {
    expect([...AGES]).toEqual(["20대", "30대", "40대", "50대", "60대 이상"]);
    expect([...CONDS]).toEqual(["임신·수유 중", "신장질환", "간질환", NONE_CONDITION]);
  });
  it("빈 초안의 profile은 연령 없음·항목 없음", () => {
    expect(EMPTY_DRAFT.profile).toEqual({ age: null, conditions: [] });
  });
});

describe("toggleItem — 해당 항목(해당 없음)", () => {
  it("해당 없음을 고르면 나머지를 지우고 혼자 남는다", () => {
    expect(toggleItem(["신장질환", "간질환"], NONE_CONDITION, NONE_CONDITION)).toEqual([NONE_CONDITION]);
  });
  it("해당 없음이 켜진 상태에서 항목을 고르면 해당 없음이 빠진다", () => {
    expect(toggleItem([NONE_CONDITION], "임신·수유 중", NONE_CONDITION)).toEqual(["임신·수유 중"]);
  });
  it("항목은 여러 개 고를 수 있다", () => {
    expect(toggleItem(["신장질환"], "간질환", NONE_CONDITION)).toEqual(["신장질환", "간질환"]);
  });
});

describe("toggleItem", () => {
  it("항목을 켜고 끈다", () => {
    const on = toggleItem([], "오메가3", NONE_SUPPLEMENT);
    expect(on).toEqual(["오메가3"]);
    expect(toggleItem(on, "오메가3", NONE_SUPPLEMENT)).toEqual([]);
  });
  it("없음을 고르면 나머지를 지우고 혼자 남는다", () => {
    expect(toggleItem(["오메가3", "마그네슘"], NONE_SUPPLEMENT, NONE_SUPPLEMENT)).toEqual([NONE_SUPPLEMENT]);
  });
  it("없음을 다시 누르면 빈 목록", () => {
    expect(toggleItem([NONE_SUPPLEMENT], NONE_SUPPLEMENT, NONE_SUPPLEMENT)).toEqual([]);
  });
  it("없음이 켜진 상태에서 실제 항목을 고르면 없음이 빠진다", () => {
    expect(toggleItem([NONE_MEDICINE], "혈압약", NONE_MEDICINE)).toEqual(["혈압약"]);
  });
  it("순서를 보존한다", () => {
    const l = toggleItem(toggleItem(["루테인"], "철분", NONE_SUPPLEMENT), "오메가3", NONE_SUPPLEMENT);
    expect(l).toEqual(["루테인", "철분", "오메가3"]);
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
    it("제품명 중 성분이 비었거나 없는 이름만 돌려준다 — 종류명 칩은 규칙이 맡으므로 제외", () => {
      expect(unmatchedNames(["혈압약", "노바스크정", "오메가3", "이상한약"], { "노바스크정": ["amlodipine"], "오메가3": [] }))
        .toEqual(["이상한약"]);
    });
    it("전부 찾았으면 빈 배열", () => {
      expect(unmatchedNames(["A"], { A: ["x"] })).toEqual([]);
    });
  });

  it("checkedCount: 고른 이름에서 못 찾은 이름을 뺀다", () => {
    expect(checkedCount({ ...EMPTY_DRAFT, supplements: ["오메가3"], medicines: ["혈압약", "이상한약"], unmatched: ["이상한약"] })).toBe(2);
    expect(checkedCount({ ...EMPTY_DRAFT, medicines: ["이상한약"], unmatched: ["이상한약"] })).toBe(0);
  });
});

describe("isPreset / customNames", () => {
  it("칩 라벨은 프리셋, 나머지는 제품명", () => {
    expect(isPreset("혈압약")).toBe(true);
    expect(isPreset("아연")).toBe(true);
    expect(isPreset("노바스크정")).toBe(false);
    expect(customNames(["혈압약", "노바스크정", "오메가3"])).toEqual(["노바스크정"]);
  });
});

describe("durToQuickFinding / mergeFindings", () => {
  it("DUR 결과는 우선 확인 + 고시 번호를 가진다", () => {
    const q = durToQuickFinding(dur("A정", "B정", "함께 쓰면 안 됨"));
    expect(q).toEqual({ kind: "priority", a: "A정", b: "B정", title: "A정 × B정", message: "함께 쓰면 안 됨", tag: "함께 복용 시 주의", source: "dur", notice_no: "2024-1" });
  });
  it("사유가 없으면 기본 문구", () => {
    expect(durToQuickFinding(dur("A", "B")).message).toContain("병용금기");
  });
  it("합치면 kind 순서로 정렬된다(DUR은 우선 확인이므로 앞으로)", () => {
    const m = mergeFindings([f("철분", "갑상선약", "timing"), f("종합비타민", "비타민D", "overlap")], [dur("A", "B")]);
    expect(m.map((x) => [x.kind, x.source])).toEqual([["priority", "dur"], ["timing", "rule"], ["overlap", "rule"]]);
  });
});

describe("summarize / topFinding / lockedGroups / groupByKind", () => {
  const list = [f("c", "x", "caution"), f("t", "x", "timing"), f("p", "x", "priority"), f("o", "x", "overlap"), f("t2", "x", "timing")];
  it("summarize: 총합과 kind별", () => {
    expect(summarize(list)).toEqual({ total: 5, byKind: { priority: 1, timing: 2, overlap: 1, caution: 1 } });
    expect(summarize([])).toEqual({ total: 0, byKind: { priority: 0, timing: 0, overlap: 0, caution: 0 } });
  });
  it("topFinding: 정렬 후 첫 건", () => {
    expect(topFinding(list)?.a).toBe("p");
    expect(topFinding([])).toBeNull();
  });
  it("lockedGroups: 첫 건 제외, V8 순서, 0건 묶음 제외", () => {
    expect(lockedGroups(list)).toEqual([
      { kind: "overlap", title: "중복 성분 확인", count: 1 },
      { kind: "timing", title: "복용 시간 조정", count: 2 },
      { kind: "caution", title: "추가 확인이 필요한 항목", count: 1 },
    ]);
    expect(lockedGroups([f("p", "x")])).toEqual([]);
  });
  it("groupByKind: kind 순서로 묶는다", () => {
    expect(groupByKind(list).map((g) => [g.kind, g.items.length])).toEqual([["priority", 1], ["timing", 2], ["overlap", 1], ["caution", 1]]);
  });
});

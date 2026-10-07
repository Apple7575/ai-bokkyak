import {
  SUPPLEMENT_PRESETS, SUPPLEMENT_MORE, MEDICINE_PRESETS, AGES, CONDS, NONE_SUPPLEMENT, NONE_MEDICINE, NONE_CONDITION,
  toggleItem, addItem, checkItems, unmatchedNames, checkedCount, checkedNamesLine, EMPTY_DRAFT,
  isPreset, customNames, summarize, topFinding, groupByKind, lockedGroups, isResultLocked,
  unmatchedDescription, PRESET_LABELS, isUnfinished,
} from "../lib/quickCheck";
import type { QuickFinding, RuleKind } from "../lib/quickCheckRules";

const f =(a: string, b: string, kind: RuleKind = "priority"): QuickFinding => ({
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

describe("unmatchedNames / checkedCount / checkedNamesLine", () => {
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

  it("checkedNamesLine — 3개까지는 전부, 4개부터는 외 N개", () => {
    expect(checkedNamesLine([])).toBe("");
    expect(checkedNamesLine(["혈압약"])).toBe("혈압약을 대조했어요");
    expect(checkedNamesLine(["혈압약", "오메가3", "비타민D"])).toBe("혈압약 · 오메가3 · 비타민D를 대조했어요");
    expect(checkedNamesLine(["a", "b", "c", "d", "e"])).toBe("a · b · c 외 2개를 대조했어요");
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

describe("summarize / topFinding / groupByKind", () => {
  const list = [f("c", "x", "caution"), f("t", "x", "timing"), f("p", "x", "priority"), f("o", "x", "overlap"), f("t2", "x", "timing")];
  it("summarize: 총합과 kind별", () => {
    expect(summarize(list)).toEqual({ total: 5, byKind: { priority: 1, timing: 2, overlap: 1, caution: 1 } });
    expect(summarize([])).toEqual({ total: 0, byKind: { priority: 0, timing: 0, overlap: 0, caution: 0 } });
  });
  it("topFinding: 정렬 후 첫 건", () => {
    expect(topFinding(list)?.a).toBe("p");
    expect(topFinding([])).toBeNull();
  });
  it("groupByKind: kind 순서로 묶는다", () => {
    expect(groupByKind(list).map((g) => [g.kind, g.items.length])).toEqual([["priority", 1], ["timing", 2], ["overlap", 1], ["caution", 1]]);
  });
});

describe("lockedGroups — 잠금 목록(첫 건 제외, kind별 개수)", () => {
  it("0건·1건이면 잠글 것이 없다 — 첫 건만 보여 주면 끝", () => {
    expect(lockedGroups([])).toEqual([]);
    expect(lockedGroups([f("c", "x", "caution")])).toEqual([]);
  });
  it("2건: 입력 순서가 아니라 정렬 순서로 첫 건을 뺀다", () => {
    // 입력은 주의사항이 앞이지만 정렬하면 우선 확인이 첫 건 → 남는 건 주의사항 1건.
    expect(lockedGroups([f("c", "x", "caution"), f("p", "x", "priority")])).toEqual([{ kind: "caution", count: 1 }]);
  });
  it("3건 이상 섞이면 첫 건의 kind가 0건이 되어 빠지고, 나머지는 KIND_ORDER 순서로 센다", () => {
    const list = [f("c", "x", "caution"), f("t", "x", "timing"), f("p", "x", "priority"), f("o", "x", "overlap"), f("t2", "x", "timing")];
    expect(topFinding(list)?.kind).toBe("priority");
    expect(lockedGroups(list)).toEqual([
      { kind: "timing", count: 2 }, { kind: "overlap", count: 1 }, { kind: "caution", count: 1 },
    ]);
  });
  it("첫 건과 같은 kind가 더 있으면 그 kind는 남은 개수로 남는다(한 건만 빠진다)", () => {
    const list = [f("c", "x", "caution"), f("o", "x", "overlap"), f("t", "x", "timing"), f("p2", "x", "priority"), f("p1", "x", "priority")];
    expect(lockedGroups(list)).toEqual([
      { kind: "priority", count: 1 }, { kind: "timing", count: 1 }, { kind: "overlap", count: 1 }, { kind: "caution", count: 1 },
    ]);
  });
  it("남은 개수의 합은 전체 − 1이고, 입력 배열은 바꾸지 않는다", () => {
    const list = [f("c", "x", "caution"), f("t", "x", "timing"), f("p", "x", "priority"), f("t2", "x", "timing")];
    const before = list.map((x) => x.a);
    expect(lockedGroups(list).reduce((n, g) => n + g.count, 0)).toBe(list.length - 1);
    expect(list.map((x) => x.a)).toEqual(before);
  });
});

describe("isResultLocked — 2건 이상이고 카카오 미연결(또는 조회 중)일 때만 잠근다", () => {
  // linked: undefined=조회 중 · null=조회 실패 · false=미연결 · true=연결됨
  const table: [number, boolean | null | undefined, boolean][] = [
    // 1건 이하 — 가릴 것이 없으니 연결 상태와 상관없이 연다
    [0, undefined, false], [0, null, false], [0, false, false], [0, true, false],
    [1, undefined, false], [1, null, false], [1, false, false], [1, true, false],
    // 2건 이상 — 미연결(false)·조회 중(undefined)만 잠그고, 연결됨(true)·조회 실패(null)는 연다
    // (조회 실패로 안전 정보를 가리지 않고, 조회 중엔 가릴 내용이 잠깐 비치지 않게 잠가 둔다)
    [2, undefined, true], [2, null, false], [2, false, true], [2, true, false],
    [3, undefined, true], [3, null, false], [3, false, true], [3, true, false],
  ];
  it.each(table)("전체 %i건 · linked %p → 잠금 %p", (total, linked, expected) => {
    expect(isResultLocked(total, linked)).toBe(expected);
  });
});

describe("unmatchedDescription — 점검하지 못한 항목 설명", () => {
  it("전부 종류명 칩이면 '자료에 없는 종류' 문구", () => {
    expect(unmatchedDescription(["유산균", "여드름약"])).toBe("아직 점검 자료에 없는 종류예요. 약사에게 함께 말씀해 주세요.");
    expect(PRESET_LABELS.has("유산균")).toBe(true);
  });
  it("제품명이 하나라도 섞이면 제품 검색 안내 문구", () => {
    expect(unmatchedDescription(["유산균", "락토핏 골드"])).toContain("제품 이름으로 검색");
    expect(unmatchedDescription(["락토핏 골드"])).toContain("제품 이름으로 검색");
  });
});

describe("isUnfinished — 이름 화면의 \"고르다 만 점검\" 배너 조건", () => {
  it("빈 초안(아직 판정 전, 저장한 적 없음)은 미완료", () => {
    expect(EMPTY_DRAFT.committedAt).toBeNull();
    expect(isUnfinished({ ...EMPTY_DRAFT, supplements: ["오메가3"] })).toBe(true);
  });
  it("판정 결과가 있으면 미완료가 아니다", () => {
    expect(isUnfinished({ ...EMPTY_DRAFT, findings: [], analyzedAt: "2026-09-13T00:00:00.000Z" })).toBe(false);
  });
  it("서버에 저장한 뒤 입력만 남긴 초안(findings null, committedAt 있음)은 미완료가 아니다", () => {
    expect(isUnfinished({ ...EMPTY_DRAFT, supplements: ["오메가3"], committedAt: "2026-09-13T00:00:00.000Z" })).toBe(false);
  });
});

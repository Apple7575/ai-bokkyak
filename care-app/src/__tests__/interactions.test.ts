import { allIngredients, crossPairs, matchFindings, MedIngredients, Rule } from "../lib/interactions";

const meds: MedIngredients[] = [
  { scheduleId: "1", name: "사이폴주", ingredients: ["cyclosporine"] },
  { scheduleId: "2", name: "로슈바정", ingredients: ["rosuvastatin"] },
  { scheduleId: "3", name: "비타민D", ingredients: [] },
];

// DUR 실제 규칙 (사전순 저장: cyclosporine < rosuvastatin)
const rules: Rule[] = [
  {
    ingredient_a: "cyclosporine",
    ingredient_b: "rosuvastatin",
    reason: "근육통, 근육약화, 근염 위험 증가",
    notice_no: "20230083",
  },
];

describe("allIngredients", () => {
  it("중복 제거하고 빈 값은 뺀다", () => {
    const g = allIngredients([
      ...meds,
      { scheduleId: "4", name: "복제", ingredients: ["cyclosporine", ""] },
    ]);
    expect(g.sort()).toEqual(["cyclosporine", "rosuvastatin"]);
  });
});

describe("crossPairs", () => {
  it("서로 다른 약 사이의 성분 쌍만, 사전순으로", () => {
    expect(crossPairs(meds)).toEqual([{ a: "cyclosporine", b: "rosuvastatin" }]);
  });

  it("같은 약 안의 성분 조합은 만들지 않는다", () => {
    // 복합제 내부 조합은 제조사가 함께 넣은 것이라 경고 대상이 아니다.
    const combo: MedIngredients[] = [
      { scheduleId: "1", name: "복합제", ingredients: ["a", "b"] },
    ];
    expect(crossPairs(combo)).toEqual([]);
  });

  it("같은 성분끼리는 쌍을 만들지 않는다", () => {
    const same: MedIngredients[] = [
      { scheduleId: "1", name: "가", ingredients: ["aspirin"] },
      { scheduleId: "2", name: "나", ingredients: ["aspirin"] },
    ];
    expect(crossPairs(same)).toEqual([]);
  });

  it("중복 쌍은 한 번만", () => {
    const dup: MedIngredients[] = [
      { scheduleId: "1", name: "가", ingredients: ["x"] },
      { scheduleId: "2", name: "나", ingredients: ["y"] },
      { scheduleId: "3", name: "다", ingredients: ["y"] },
    ];
    expect(crossPairs(dup)).toEqual([{ a: "x", b: "y" }]);
  });
});

describe("matchFindings", () => {
  it("규칙에 걸리는 약 쌍을 이유·근거와 함께 돌려준다", () => {
    const f = matchFindings(meds, rules);
    expect(f).toHaveLength(1);
    expect(f[0].medA).toBe("사이폴주");
    expect(f[0].medB).toBe("로슈바정");
    expect(f[0].notice_no).toBe("20230083");
    expect(f[0].reason).toContain("근육");
  });

  it("규칙이 반대 순서로 와도 찾는다", () => {
    const flipped: Rule[] = [{ ...rules[0], ingredient_a: "rosuvastatin", ingredient_b: "cyclosporine" }];
    expect(matchFindings(meds, flipped)).toHaveLength(1);
  });

  it("약 순서가 바뀌어도 같은 건수", () => {
    const reversed = [...meds].reverse();
    expect(matchFindings(reversed, rules)).toHaveLength(1);
  });

  it("걸리는 규칙이 없으면 빈 배열", () => {
    expect(matchFindings(meds, [])).toEqual([]);
  });

  it("성분을 못 찾은 약(빈 배열)은 아무 규칙에도 걸리지 않는다", () => {
    const onlyUnknown: MedIngredients[] = [
      { scheduleId: "1", name: "모르는약", ingredients: [] },
      { scheduleId: "2", name: "다른약", ingredients: [] },
    ];
    expect(matchFindings(onlyUnknown, rules)).toEqual([]);
  });

  it("같은 약 쌍·같은 성분 쌍은 중복으로 세지 않는다", () => {
    // 같은 약이 성분을 중복으로 갖고 있어도 1건.
    const dup: MedIngredients[] = [
      { scheduleId: "1", name: "가", ingredients: ["cyclosporine", "cyclosporine"] },
      { scheduleId: "2", name: "나", ingredients: ["rosuvastatin"] },
    ];
    expect(matchFindings(dup, rules)).toHaveLength(1);
  });
});

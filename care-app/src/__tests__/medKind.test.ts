import { guessMedKind, groupByKind, isMedKind, KIND_ORDER } from "../lib/medKind";

describe("guessMedKind", () => {
  it("건기식 이름은 자동 분류", () => {
    expect(guessMedKind("비타민D")).toBe("건기식");
    expect(guessMedKind("오메가3")).toBe("건기식");
    expect(guessMedKind("오메가 3")).toBe("건기식");   // 공백 무시
    expect(guessMedKind("종합비타민")).toBe("건기식");
    expect(guessMedKind("프로바이오틱스 유산균")).toBe("건기식");
    expect(guessMedKind("밀크씨슬")).toBe("건기식");
  });

  it("이름만으로는 처방약/일반약을 추측하지 않는다", () => {
    // 틀린 분류는 없는 분류보다 나쁘다 — 모르면 null로 두고 사용자가 고르게 한다.
    expect(guessMedKind("혈압약")).toBeNull();
    expect(guessMedKind("아모잘탄정")).toBeNull();
    expect(guessMedKind("타이레놀")).toBeNull();
  });

  it("빈 이름은 null", () => {
    expect(guessMedKind("")).toBeNull();
    expect(guessMedKind("   ")).toBeNull();
  });
});

describe("isMedKind", () => {
  it("정해진 3종만 통과", () => {
    expect(isMedKind("처방약")).toBe(true);
    expect(isMedKind("건기식")).toBe(true);
    expect(isMedKind("영양제")).toBe(false);
    expect(isMedKind(null)).toBe(false);
    expect(isMedKind(3)).toBe(false);
  });
});

describe("groupByKind", () => {
  const items = [
    { n: "혈압약", k: "처방약" as const },
    { n: "비타민", k: "건기식" as const },
    { n: "타이레놀", k: "일반약" as const },
    { n: "모르는약", k: null },
    { n: "당뇨약", k: "처방약" as const },
  ];

  it("KIND_ORDER 순서로 묶고 미분류는 맨 아래", () => {
    const g = groupByKind(items, (x) => x.k);
    expect(g.map((x) => x.kind)).toEqual(["처방약", "일반약", "건기식", "미분류"]);
    expect(g[0].items.map((x) => x.n)).toEqual(["혈압약", "당뇨약"]);
    expect(g[3].items.map((x) => x.n)).toEqual(["모르는약"]);
  });

  it("비어 있는 구분은 그룹을 만들지 않는다", () => {
    const g = groupByKind([{ n: "비타민", k: "건기식" as const }], (x) => x.k);
    expect(g).toHaveLength(1);
    expect(g[0].kind).toBe("건기식");
  });

  it("알 수 없는 값도 미분류로 모은다", () => {
    const g = groupByKind([{ n: "x", k: "영양제" as any }], (x) => x.k);
    expect(g[0].kind).toBe("미분류");
  });

  it("빈 목록은 빈 결과", () => {
    expect(groupByKind([], () => null)).toEqual([]);
  });

  it("KIND_ORDER는 미분류를 마지막에 둔다", () => {
    expect(KIND_ORDER[KIND_ORDER.length - 1]).toBe("미분류");
  });
});

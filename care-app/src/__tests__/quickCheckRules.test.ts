import { sortFindings, KIND_LABEL, KIND_ORDER, isQuickFinding, QuickFinding } from "../lib/quickCheckRules";

// 앱 내장 규칙(RULES/applyRules)은 2026-09-17에 제거됐다 — 판정은 서버 전용. 여기서는 타입·라벨·정렬만 본다.

describe("등급 라벨", () => {
  it("KIND_LABEL", () => {
    expect(KIND_LABEL).toEqual({ priority: "우선 확인 필요", timing: "복용 시간 조정", overlap: "중복·과다 확인", caution: "주의사항" });
  });
  it("KIND_ORDER는 우선 → 시간 → 중복 → 주의", () => {
    expect(KIND_ORDER).toEqual(["priority", "timing", "overlap", "caution"]);
  });
});

describe("sortFindings", () => {
  const f = (kind: QuickFinding["kind"], a: string): QuickFinding =>
    ({ kind, a, b: "x", title: `${a} × x`, message: "", tag: "", source: "rule" });
  it("kind 순서로, 같은 kind 안에서는 입력 순서를 지킨다", () => {
    const s = sortFindings([f("caution", "c1"), f("timing", "t1"), f("priority", "p1"), f("timing", "t2")]);
    expect(s.map((x) => x.a)).toEqual(["p1", "t1", "t2", "c1"]);
  });
  it("입력 배열을 바꾸지 않는다", () => {
    const input = [f("caution", "c1"), f("priority", "p1")];
    sortFindings(input);
    expect(input.map((x) => x.a)).toEqual(["c1", "p1"]);
  });
});

describe("isQuickFinding — 저장된 값 모양 검사", () => {
  it("이 빌드의 QuickFinding 모양이면 true", () => {
    expect(isQuickFinding({ kind: "priority", a: "A", b: "B", title: "A × B", message: "m", tag: "t", source: "rule" })).toBe(true);
    expect(isQuickFinding({ kind: "timing", a: "A", b: "B", title: "A × B", message: "m", tag: "t", source: "dur", notice_no: "1" })).toBe(true);
  });
  it("구버전 DUR Finding(medA/medB)이나 모르는 kind는 false", () => {
    expect(isQuickFinding({ medA: "A", medB: "B", reason: null })).toBe(false);
    expect(isQuickFinding({ kind: "weird", title: "x", message: "m", source: "rule" })).toBe(false);
    expect(isQuickFinding(null)).toBe(false);
    expect(isQuickFinding("x")).toBe(false);
  });
});

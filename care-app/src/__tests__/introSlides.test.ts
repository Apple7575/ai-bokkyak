import { INTRO_SLIDES, SKIP_TARGET_INDEX, dotState, nextIndex, prevIndex } from "../lib/introSlides";

describe("INTRO_SLIDES", () => {
  it("슬라이드는 7장", () => {
    expect(INTRO_SLIDES).toHaveLength(7);
  });
  it("앞 두 장은 브랜드 슬라이드이며 자동으로 넘어간다 (3800ms, 2600ms)", () => {
    expect(INTRO_SLIDES[0]).toMatchObject({ kind: "brand", autoAdvanceMs: 3800, showBar: false });
    expect(INTRO_SLIDES[1]).toMatchObject({ kind: "brand", autoAdvanceMs: 2600, showBar: false });
  });
  it("3~6번은 온보딩 — 자동 진행 없음, 상단 바 표시", () => {
    for (const i of [2, 3, 4, 5]) {
      expect(INTRO_SLIDES[i]).toMatchObject({ kind: "onboarding", autoAdvanceMs: null, showBar: true });
    }
  });
  it("마지막은 CTA — 자동 진행 없음, 상단 바 없음", () => {
    expect(INTRO_SLIDES[6]).toMatchObject({ kind: "cta", autoAdvanceMs: null, showBar: false });
  });
  it("건너뛰기는 CTA(인덱스 6)로 간다", () => {
    expect(SKIP_TARGET_INDEX).toBe(6);
    expect(INTRO_SLIDES[SKIP_TARGET_INDEX].kind).toBe("cta");
  });
});

describe("dotState", () => {
  it("점은 4개, 온보딩 슬라이드에서 활성 인덱스 0~3", () => {
    expect(dotState(2)).toEqual({ count: 4, active: 0 });
    expect(dotState(5)).toEqual({ count: 4, active: 3 });
  });
  it("온보딩이 아닌 슬라이드에서는 활성 없음(-1)", () => {
    expect(dotState(0).active).toBe(-1);
    expect(dotState(6).active).toBe(-1);
  });
});

describe("nextIndex / prevIndex", () => {
  it("다음은 하나 증가, 마지막에서 멈춘다", () => {
    expect(nextIndex(0)).toBe(1);
    expect(nextIndex(6)).toBe(6);
  });
  it("이전은 하나 감소, 첫 장에서는 null", () => {
    expect(prevIndex(3)).toBe(2);
    expect(prevIndex(0)).toBeNull();
  });
});

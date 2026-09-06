import { INTRO_SLIDES, SKIP_TARGET_INDEX, dotState, nextIndex, prevIndex } from "../lib/introSlides";

// 회의 2026-09-03: 7장 → 4장 (브랜드 로고·1분 복용 점검 소개·약사가 설계한 기준 삭제).

describe("INTRO_SLIDES", () => {
  it("슬라이드는 4장", () => {
    expect(INTRO_SLIDES).toHaveLength(4);
  });
  it("첫 장은 브랜드 슬라이드이며 자동으로 넘어가지 않는다 (탭 전용 — 피드백 2026-09-03)", () => {
    expect(INTRO_SLIDES[0]).toMatchObject({ kind: "brand", autoAdvanceMs: null, showBar: false });
  });
  it("2~3번은 온보딩 — 자동 진행 없음, 상단 바 표시", () => {
    for (const i of [1, 2]) {
      expect(INTRO_SLIDES[i]).toMatchObject({ kind: "onboarding", autoAdvanceMs: null, showBar: true });
    }
  });
  it("마지막은 CTA — 자동 진행 없음, 상단 바 없음", () => {
    expect(INTRO_SLIDES[3]).toMatchObject({ kind: "cta", autoAdvanceMs: null, showBar: false });
  });
  it("건너뛰기는 CTA(인덱스 3)로 간다", () => {
    expect(SKIP_TARGET_INDEX).toBe(3);
    expect(INTRO_SLIDES[SKIP_TARGET_INDEX].kind).toBe("cta");
  });
});

describe("dotState", () => {
  it("점은 2개, 온보딩 슬라이드에서 활성 인덱스 0~1", () => {
    expect(dotState(1)).toEqual({ count: 2, active: 0 });
    expect(dotState(2)).toEqual({ count: 2, active: 1 });
  });
  it("온보딩이 아닌 슬라이드에서는 활성 없음(-1)", () => {
    expect(dotState(0).active).toBe(-1);
    expect(dotState(3).active).toBe(-1);
  });
});

describe("nextIndex / prevIndex", () => {
  it("다음은 하나 증가, 마지막에서 멈춘다", () => {
    expect(nextIndex(0)).toBe(1);
    expect(nextIndex(3)).toBe(3);
  });
  it("이전은 하나 감소, 첫 장에서는 null", () => {
    expect(prevIndex(2)).toBe(1);
    expect(prevIndex(0)).toBeNull();
  });
});

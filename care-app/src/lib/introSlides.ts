// 인트로(브랜드 + 온보딩 + 시작 CTA) 슬라이드 표 — 순수 로직 (RN 의존 없음, jest 대상).
//
// 시안 V8의 화면 1~7을 한 화면(IntroScreen)에서 페이지로 넘긴다.
// - 1·2번은 탭해야 넘어간다. (자동 전환은 사용자 피드백 2026-09-03으로 제거 —
//   "탭하여 계속"인데 저절로 넘어가 혼란을 줬다.)
// - 3~6번은 상단에 점 4개 + 건너뛰기(→ CTA)가 있고 "다음" 버튼으로만 넘어간다.
// - 7번은 시작 CTA.
// 문구 자체는 화면(IntroScreen)에 있다 — 강조 색·형광 밴드 같은 부분 서식이 섞여 있어서다.

export type IntroSlideKind = "brand" | "onboarding" | "cta";

export type IntroSlide = {
  kind: IntroSlideKind;
  /** 자동으로 다음 슬라이드로 넘어가기까지의 ms. null이면 자동 진행 없음. */
  autoAdvanceMs: number | null;
  /** 상단 점·건너뛰기 바 표시 여부 */
  showBar: boolean;
  /** 화면 식별용 라벨 (시안의 data-screen-label) */
  label: string;
};

export const INTRO_SLIDES: readonly IntroSlide[] = [
  { kind: "brand", autoAdvanceMs: null, showBar: false, label: "브랜드 인트로" },
  { kind: "brand", autoAdvanceMs: null, showBar: false, label: "브랜드 로고" },
  { kind: "onboarding", autoAdvanceMs: null, showBar: true, label: "하나의 복용 조합" },
  { kind: "onboarding", autoAdvanceMs: null, showBar: true, label: "낭비와 위험" },
  { kind: "onboarding", autoAdvanceMs: null, showBar: true, label: "1분 복용 점검" },
  { kind: "onboarding", autoAdvanceMs: null, showBar: true, label: "병용금기 기준 점검" },
  { kind: "cta", autoAdvanceMs: null, showBar: false, label: "시작 CTA" },
] as const;

/** 건너뛰기가 향하는 슬라이드 인덱스 = 마지막(CTA) */
export const SKIP_TARGET_INDEX = INTRO_SLIDES.length - 1;

/** 상단 바에 그릴 점의 개수·활성 인덱스 (온보딩 슬라이드에서만 의미 있다) */
export function dotState(index: number): { count: number; active: number } {
  const onboarding = INTRO_SLIDES.map((s, i) => (s.kind === "onboarding" ? i : -1)).filter((i) => i >= 0);
  return { count: onboarding.length, active: onboarding.indexOf(index) };
}

/** 다음 슬라이드 인덱스. 마지막이면 그대로. */
export function nextIndex(index: number): number {
  return Math.min(INTRO_SLIDES.length - 1, index + 1);
}

/** 이전 슬라이드 인덱스. 첫 슬라이드면 null (하드웨어 뒤로가기를 기본 동작에 맡긴다). */
export function prevIndex(index: number): number | null {
  return index <= 0 ? null : index - 1;
}

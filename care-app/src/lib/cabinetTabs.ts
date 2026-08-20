// '내 약장'의 구분 필터·요약 칸 치수 — 순수 로직 (RN 의존 없음, jest 대상).
//
// 칸이 5개다: 전체 / 처방약 / 일반약 / 건기식 / 미분류.
// 반드시 한 줄에 다 들어가야 한다 — 줄바꿈하면 아래 줄이 목록처럼 보이고,
// 가로 스크롤은 나머지 탭이 화면 밖에 숨어 어르신이 못 찾는다.
//
// 그래서 글자 크기를 화면 폭에서 거꾸로 계산한다. 큰 화면에서는 본문 크기(18)를
// 그대로 쓰고, 좁은 화면(SE 등)에서만 필요한 만큼 줄인다. 잘리는 것보다 낫다.

/** 라벨 중 가장 긴 것의 글자 수 — "처방약", "건기식", "미분류" 모두 3자. */
const LONGEST_LABEL = 3;
/** 한글은 글자 하나가 대략 1em 폭을 차지한다. */
const CHAR_WIDTH_EM = 1;
/** 글자 양옆 최소 여백(px). 이만큼은 남겨야 답답해 보이지 않는다. */
const SIDE_PADDING = 8;

/** 디자인 기본값. 이보다 크게는 키우지 않는다. */
export const MAX_LABEL_FONT = 18;
/** 이보다 작아지면 읽기 어렵다. 여기 걸리면 글자가 잘릴 수 있음을 감수한다. */
export const MIN_LABEL_FONT = 13;

export const TAB_COUNT = 5;

export type TabLayout = {
  /** 칸 하나의 폭(px) */
  cellWidth: number;
  /** 라벨 글자 크기(px) */
  fontSize: number;
};

/**
 * @param screenWidth   화면 전체 폭
 * @param outerPadding  목록 좌우 여백(한쪽) — CabinetScreen의 styles.list padding
 * @param innerPadding  탭 묶음 자체의 좌우 여백(한쪽). 요약 칸은 0.
 */
export function tabLayout(screenWidth: number, outerPadding: number, innerPadding = 0): TabLayout {
  const w = Number.isFinite(screenWidth) && screenWidth > 0 ? screenWidth : 375;
  const available = Math.max(0, w - outerPadding * 2 - innerPadding * 2);
  const cellWidth = available / TAB_COUNT;
  const room = cellWidth - SIDE_PADDING;
  const fit = Math.floor(room / (LONGEST_LABEL * CHAR_WIDTH_EM));
  const fontSize = Math.max(MIN_LABEL_FONT, Math.min(MAX_LABEL_FONT, fit));
  return { cellWidth, fontSize };
}

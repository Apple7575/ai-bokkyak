// Pretendard 굵기 매핑 — 순수 로직 (RN 의존 없음, jest 대상).
//
// 안드로이드는 커스텀 폰트에 fontWeight를 적용하지 못한다. 굵기별로 파일을
// 따로 등록하고 fontFamily 이름 자체를 바꿔 주는 수밖에 없다. iOS도 굵기별
// 파일을 쓰는 편이 합성 볼드(가짜 굵게)를 피할 수 있어 더 깨끗하다.
//
// 그래서 화면이 쓰던 fontWeight를 이 함수가 파일 이름으로 번역한다.
// 화면 코드는 하나도 고치지 않아도 된다 — applyPretendard가 가로채 준다.

export const FONT_FAMILIES = {
  regular: "Pretendard-Regular",
  semibold: "Pretendard-SemiBold",
  bold: "Pretendard-Bold",
  extrabold: "Pretendard-ExtraBold",
} as const;

export type FontFamilyName = (typeof FONT_FAMILIES)[keyof typeof FONT_FAMILIES];

// RN의 fontWeight 값 → Pretendard 파일 이름.
//
// 이 앱이 실제로 쓰는 굵기는 600·700·800과 기본값뿐이라 4종만 번들에 넣었다
// (5종이면 7.6MB, 4종이면 6.1MB). 없는 굵기는 가장 가까운 것으로 내린다 —
// 500을 요구했는데 아무 폰트도 못 찾아 시스템 폰트로 떨어지는 것이 최악이다.
export function fontFamilyForWeight(weight?: string | number | null): FontFamilyName {
  if (weight === null || weight === undefined) return FONT_FAMILIES.regular;

  if (weight === "bold") return FONT_FAMILIES.bold;
  if (weight === "normal") return FONT_FAMILIES.regular;

  const n = typeof weight === "number" ? weight : Number(weight);
  if (!Number.isFinite(n)) return FONT_FAMILIES.regular;

  if (n >= 800) return FONT_FAMILIES.extrabold;
  if (n >= 700) return FONT_FAMILIES.bold;
  if (n >= 600) return FONT_FAMILIES.semibold;
  return FONT_FAMILIES.regular;
}

// 스플래시 로고 카드 치수 — 순수 로직 (RN 의존 없음, jest 대상).
//
// 왜 계산해서 쓰나:
//   처음엔 카드에 width:234, 이미지에 { width: "100%", aspectRatio: 1 }을 줬다.
//   iOS 실기기에서 카드가 화면 밖으로 넘칠 만큼 커졌다. SDK 54는 신아키텍처(Fabric)가
//   기본이고, 앱에서 aspectRatio를 쓰는 곳은 그 로고 하나뿐이었는데 그 화면만 깨졌다.
//   퍼센트 폭 + aspectRatio 조합을 걷어내고 픽셀 값으로 못 박는다 — 해석의 여지가 없다.
//
// 겸사겸사 작은 화면(SE 등)에서도 넘치지 않게 화면 폭에 비례시킨다.

/** 큰 화면에서도 이보다 커지지 않는다. 시안 값. */
export const MAX_CARD = 234;
/** 화면 폭 대비 카드 폭 비율. */
const CARD_RATIO = 0.62;
/** 카드 안쪽 여백 비율 — 234일 때 18이 되도록. */
const PAD_RATIO = 0.077;

export type SplashSizes = { card: number; cardPad: number; logoSize: number };

export function cardSizes(screenWidth: number): SplashSizes {
  const w = Number.isFinite(screenWidth) && screenWidth > 0 ? screenWidth : MAX_CARD;
  const card = Math.min(MAX_CARD, Math.round(w * CARD_RATIO));
  const cardPad = Math.round(card * PAD_RATIO);
  return { card, cardPad, logoSize: card - cardPad * 2 };
}

import { cardSizes, MAX_CARD } from "../lib/splashLayout";

// 실기기 회귀: 로고 카드가 화면 밖으로 넘쳐 [시작하기] 버튼까지 밀려났다.
// 어떤 화면 폭에서도 다시 넘치지 않는 것을 여기서 못 박는다.

const WIDTHS = [
  320,  // iPhone SE(1세대)급
  375,  // SE2/3 · mini
  390,  // 13/14
  393,  // 15/16
  430,  // Pro Max
  768,  // 아이패드
  1024,
];

describe("cardSizes", () => {
  it("카드는 절대 화면 폭을 넘지 않는다", () => {
    for (const w of WIDTHS) {
      expect(cardSizes(w).card).toBeLessThanOrEqual(w);
    }
  });

  it("좌우 여백(26pt씩)을 빼고도 들어간다", () => {
    for (const w of WIDTHS) {
      expect(cardSizes(w).card).toBeLessThanOrEqual(w - 52);
    }
  });

  it("큰 화면에서도 시안 크기(234)를 넘지 않는다", () => {
    expect(cardSizes(768).card).toBe(MAX_CARD);
    expect(cardSizes(1024).card).toBe(MAX_CARD);
  });

  it("시안 폭(≈378 이상)에서 234·패딩 18이 나온다", () => {
    const { card, cardPad, logoSize } = cardSizes(390);
    expect(card).toBe(234);
    expect(cardPad).toBe(18);
    expect(logoSize).toBe(198);
  });

  it("작은 화면에서는 비례해 줄어든다", () => {
    expect(cardSizes(320).card).toBeLessThan(MAX_CARD);
    expect(cardSizes(320).card).toBeLessThan(cardSizes(390).card);
  });

  it("로고는 카드 안에 들어간다 — 패딩만큼 작다", () => {
    for (const w of WIDTHS) {
      const { card, cardPad, logoSize } = cardSizes(w);
      expect(logoSize).toBe(card - cardPad * 2);
      expect(logoSize).toBeLessThan(card);
      expect(logoSize).toBeGreaterThan(0);
    }
  });

  it("이상한 폭이 와도 음수나 NaN을 내지 않는다", () => {
    for (const w of [0, -100, NaN, Infinity]) {
      const { card, logoSize } = cardSizes(w as number);
      expect(card).toBeGreaterThan(0);
      expect(card).toBeLessThanOrEqual(MAX_CARD);
      expect(logoSize).toBeGreaterThan(0);
    }
  });
});

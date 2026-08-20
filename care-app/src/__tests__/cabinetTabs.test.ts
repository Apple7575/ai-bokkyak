import { tabLayout, TAB_COUNT, MAX_LABEL_FONT, MIN_LABEL_FONT } from "../lib/cabinetTabs";

// CabinetScreen이 실제로 쓰는 값
const LIST_PADDING = 16; // styles.list padding
const TABS_PADDING = 4;  // styles.tabs padding

describe("tabLayout", () => {
  it("칸은 언제나 5개로 나눈다", () => {
    expect(TAB_COUNT).toBe(5);
  });

  it("일반적인 폰(375)에서는 본문 크기를 그대로 쓴다", () => {
    expect(tabLayout(375, LIST_PADDING, TABS_PADDING).fontSize).toBe(MAX_LABEL_FONT);
  });

  it("큰 폰에서도 본문 크기를 넘기지 않는다", () => {
    expect(tabLayout(430, LIST_PADDING, TABS_PADDING).fontSize).toBe(MAX_LABEL_FONT);
    expect(tabLayout(768, LIST_PADDING, TABS_PADDING).fontSize).toBe(MAX_LABEL_FONT);
  });

  it("좁은 폰(SE 320)에서는 줄여서라도 한 줄에 넣는다", () => {
    const { fontSize } = tabLayout(320, LIST_PADDING, TABS_PADDING);
    expect(fontSize).toBeLessThan(MAX_LABEL_FONT);
    expect(fontSize).toBeGreaterThanOrEqual(MIN_LABEL_FONT);
  });

  // 이게 이 파일의 존재 이유다 — 5칸이 한 줄을 넘으면 안 된다.
  it("어떤 화면 폭에서도 '미분류' 3글자가 칸 안에 들어간다", () => {
    for (const w of [320, 360, 375, 390, 412, 430, 768]) {
      const { cellWidth, fontSize } = tabLayout(w, LIST_PADDING, TABS_PADDING);
      expect(fontSize * 3).toBeLessThanOrEqual(cellWidth);
    }
  });

  it("5칸을 합쳐도 쓸 수 있는 폭을 넘지 않는다", () => {
    for (const w of [320, 375, 430]) {
      const { cellWidth } = tabLayout(w, LIST_PADDING, TABS_PADDING);
      expect(cellWidth * TAB_COUNT).toBeLessThanOrEqual(w - LIST_PADDING * 2 - TABS_PADDING * 2 + 0.001);
    }
  });

  it("요약 칸은 안쪽 여백이 없어 탭보다 넉넉하다", () => {
    const tabs = tabLayout(375, LIST_PADDING, TABS_PADDING);
    const summary = tabLayout(375, LIST_PADDING);
    expect(summary.cellWidth).toBeGreaterThan(tabs.cellWidth);
  });

  it("읽을 수 없을 만큼 작아지지는 않는다", () => {
    expect(tabLayout(200, LIST_PADDING, TABS_PADDING).fontSize).toBe(MIN_LABEL_FONT);
  });

  it("폭을 모를 때(0, NaN)는 기본 폰 기준으로 떨어진다", () => {
    expect(tabLayout(0, LIST_PADDING, TABS_PADDING).fontSize).toBe(MAX_LABEL_FONT);
    expect(tabLayout(NaN, LIST_PADDING, TABS_PADDING).fontSize).toBe(MAX_LABEL_FONT);
  });
});

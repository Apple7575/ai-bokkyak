import { fontFamilyForWeight, FONT_FAMILIES } from "../theme/fonts";

describe("fontFamilyForWeight — 굵기를 파일 이름으로 번역한다", () => {
  it("이 앱이 실제로 쓰는 굵기", () => {
    // src 전체에서 쓰이는 값은 600 / 700 / 800 뿐이다.
    expect(fontFamilyForWeight("600")).toBe(FONT_FAMILIES.semibold);
    expect(fontFamilyForWeight("700")).toBe(FONT_FAMILIES.bold);
    expect(fontFamilyForWeight("800")).toBe(FONT_FAMILIES.extrabold);
  });

  it("굵기를 안 준 글자는 Regular", () => {
    expect(fontFamilyForWeight(undefined)).toBe(FONT_FAMILIES.regular);
    expect(fontFamilyForWeight(null)).toBe(FONT_FAMILIES.regular);
  });

  it("키워드도 받는다", () => {
    expect(fontFamilyForWeight("bold")).toBe(FONT_FAMILIES.bold);
    expect(fontFamilyForWeight("normal")).toBe(FONT_FAMILIES.regular);
  });

  it("숫자로 줘도 같다", () => {
    expect(fontFamilyForWeight(700)).toBe(FONT_FAMILIES.bold);
    expect(fontFamilyForWeight(400)).toBe(FONT_FAMILIES.regular);
  });

  it("번들에 없는 굵기는 가장 가까운 아래쪽으로 — 시스템 폰트로 떨어지지 않게", () => {
    expect(fontFamilyForWeight("500")).toBe(FONT_FAMILIES.regular);   // Medium 미번들
    expect(fontFamilyForWeight("650")).toBe(FONT_FAMILIES.semibold);
    expect(fontFamilyForWeight("900")).toBe(FONT_FAMILIES.extrabold); // Black 미번들
  });

  it("이상한 값이 와도 반드시 Pretendard를 돌려준다", () => {
    expect(fontFamilyForWeight("아주굵게")).toBe(FONT_FAMILIES.regular);
    expect(fontFamilyForWeight("")).toBe(FONT_FAMILIES.regular);
  });

  it("어떤 입력이든 번들된 4종 안에서만 나온다", () => {
    const bundled = Object.values(FONT_FAMILIES);
    const inputs = [undefined, null, "", "bold", "normal", "100", "400", "500",
      "600", "700", "800", "900", 250, 1000, NaN, "xyz"];
    for (const w of inputs) {
      expect(bundled).toContain(fontFamilyForWeight(w as any));
    }
  });
});

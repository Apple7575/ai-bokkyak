import { medicineIdentity } from "../lib/medicineIdentity";

describe("medicineIdentity", () => {
  it("같은 약 이름은 항상 같은 표식을 돌려준다", () => {
    expect(medicineIdentity("혈압약")).toEqual(medicineIdentity("혈압약"));
  });

  it("앞뒤 공백과 영문 대소문자는 표식에 영향을 주지 않는다", () => {
    expect(medicineIdentity("  Vitamin D ")).toEqual(medicineIdentity("vitamin d"));
  });

  it("모양과 팔레트 범위가 유효하다", () => {
    const result = medicineIdentity("오메가3");
    expect(["capsule", "tablet", "bottle", "packet"]).toContain(result.shape);
    expect(result.paletteIndex).toBeGreaterThanOrEqual(0);
    expect(result.paletteIndex).toBeLessThan(6);
  });

  it("해시 결과가 고정되어 있다 — 바뀌면 기존 약의 색·모양이 전부 바뀐다", () => {
    expect(medicineIdentity("혈압약")).toEqual({ shape: "tablet", paletteIndex: 2 });
    expect(medicineIdentity("Vitamin D")).toEqual({ shape: "tablet", paletteIndex: 5 });
    expect(medicineIdentity("")).toEqual({ shape: "tablet", paletteIndex: 3 });
  });
});

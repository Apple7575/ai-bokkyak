import { CHIP_ALIASES, expandChipNames } from "../lib/chipAliases";
import { PRESET_LABELS } from "../lib/quickCheckLabels";

describe("CHIP_ALIASES 데이터 자체", () => {
  it("별칭의 키는 전부 칩 라벨이다(자유 입력에는 별칭을 붙이지 않는다)", () => {
    for (const key of Object.keys(CHIP_ALIASES)) expect(PRESET_LABELS.has(key)).toBe(true);
  });
  it("별칭 이름은 비어 있지 않고, 칩 라벨과 겹치지 않는다", () => {
    for (const [chip, a] of Object.entries(CHIP_ALIASES)) {
      expect(a!.names.length).toBeGreaterThan(0);
      for (const n of a!.names) {
        expect(n.trim()).toBe(n);
        expect(n).not.toBe(chip);
        expect(PRESET_LABELS.has(n)).toBe(false);
      }
    }
  });
  it("회의에서 확인한 핵심 별칭", () => {
    expect(CHIP_ALIASES["혈압약"]).toEqual({ names: ["칼슘통로차단제", "RAS차단제", "칼륨보존이뇨제"] });
    expect(CHIP_ALIASES["유산균"]).toEqual({ names: ["프로바이오틱스"], replace: true });
  });
});

describe("expandChipNames", () => {
  it("칩 뒤에 별칭을 순서대로 붙이고, 별칭→칩 역매핑을 돌려준다", () => {
    const { send, aliasOf } = expandChipNames(["혈압약", "자몽"]);
    expect(send).toEqual(["혈압약", "칼슘통로차단제", "RAS차단제", "칼륨보존이뇨제", "자몽"]);
    expect(aliasOf.get("칼슘통로차단제")).toBe("혈압약");
    expect(aliasOf.get("RAS차단제")).toBe("혈압약");
    expect(aliasOf.get("칼륨보존이뇨제")).toBe("혈압약");
    expect(aliasOf.has("혈압약")).toBe(false);
    expect(aliasOf.has("자몽")).toBe(false);
  });
  it("replace 칩(유산균)은 칩 자체를 보내지 않고 별칭만 보낸다", () => {
    const { send, aliasOf } = expandChipNames(["유산균", "항생제"]);
    expect(send).toEqual(["프로바이오틱스", "항생제"]);
    expect(aliasOf.get("프로바이오틱스")).toBe("유산균");
  });
  it("별칭이 없는 칩과 자유 입력(제품명)은 그대로 지나간다", () => {
    const { send, aliasOf } = expandChipNames(["철분", "노바스크정"]);
    expect(send).toEqual(["철분", "노바스크정"]);
    expect(aliasOf.size).toBe(0);
  });
  it("중복은 한 번만(칩·별칭·입력이 겹쳐도)", () => {
    const { send } = expandChipNames(["오메가3", "오메가3", "오메가-3", "홍삼"]);
    expect(send).toEqual(["오메가3", "오메가-3", "홍삼", "인삼"]);
  });
  it("사용자가 별칭과 같은 이름을 직접 넣었으면 그 이름은 별칭으로 취급하지 않는다(입력 이름을 지우지 않는다)", () => {
    const { send, aliasOf } = expandChipNames(["홍삼", "인삼"]);
    expect(send).toEqual(["홍삼", "인삼"]);
    expect(aliasOf.has("인삼")).toBe(false);
  });
  it("빈 입력이면 빈 결과", () => {
    const { send, aliasOf } = expandChipNames([]);
    expect(send).toEqual([]);
    expect(aliasOf.size).toBe(0);
  });
});

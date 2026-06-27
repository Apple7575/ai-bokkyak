import { validateOcrMedicines } from "../lib/parse";

describe("validateOcrMedicines", () => {
  it("{medicines:[...]} 형태에서 유효 항목 추출", () => {
    const r = validateOcrMedicines({
      medicines: [
        { medicine_name: "고혈압약", time_of_day: "아침", hour: 8, minute: 0, repeat_days: "매일" },
        { medicine_name: "혈압약", time_of_day: "저녁", hour: 19, minute: 30, repeat_days: [1, 3, 5] },
      ],
    });
    expect(r).toHaveLength(2);
    expect(r[0].medicine_name).toBe("고혈압약");
    expect(r[0].repeat_days).toEqual([]); // "매일" → []
    expect(r[1].repeat_days).toEqual([1, 3, 5]);
    expect(r[1].minute).toBe(30);
  });

  it("최상위가 배열이어도 동작", () => {
    const r = validateOcrMedicines([
      { medicine_name: "비타민D", time_of_day: "점심", hour: 13, minute: 0, repeat_days: "매일" },
    ]);
    expect(r).toHaveLength(1);
  });

  it("잘못된 항목은 조용히 버리고 유효한 것만 남김", () => {
    const r = validateOcrMedicines({
      medicines: [
        { medicine_name: "", hour: 8 },              // 이름 없음 → 버림
        { medicine_name: "약A", hour: 99 },          // 시간 범위 밖 → 버림
        { medicine_name: "약B", time_of_day: "아침", hour: 8, repeat_days: "매일" }, // 유효
      ],
    });
    expect(r.map((x) => x.medicine_name)).toEqual(["약B"]);
  });

  it("빈/이상 입력은 빈 배열", () => {
    expect(validateOcrMedicines({ medicines: [] })).toEqual([]);
    expect(validateOcrMedicines({})).toEqual([]);
    expect(validateOcrMedicines(null)).toEqual([]);
  });
});

import { historyEntry, koreanDate, koreanDateTime, historyNamesLine } from "../lib/quickCheckHistory";
import type { QuickFinding } from "../lib/quickCheckRules";

const finding = (a: string): QuickFinding => ({
  kind: "timing", tag: "시간 조정", title: `${a} 시간`, message: "간격을 두세요", a, b: "칼슘", source: "rule",
} as QuickFinding);

describe("historyEntry — 저장된 점검 행 → 목록·결과 화면 값", () => {
  it("지금 모양의 행은 결과 화면 params까지 만든다", () => {
    const e = historyEntry({
      id: "r1", created_at: "2026-10-08T05:00:00.000Z",
      items: {
        supplements: ["오메가3"], medicines: ["혈압약"], names: ["오메가3", "혈압약"], unmatched: ["모르는약"],
        durUnavailable: false, unmappedIngredients: ["원료A"], uncoveredConditions: ["신장질환"], engine: "server",
        profile: { age: "70대", conditions: [] },
      },
      findings: [finding("혈압약")],
    });
    expect(e.id).toBe("r1");
    expect(e.names).toEqual(["오메가3", "혈압약"]);
    expect(e.findingsCount).toBe(1);
    expect(e.params).toEqual({
      findings: [finding("혈압약")], names: ["오메가3", "혈압약"], unmatched: ["모르는약"], durUnavailable: false,
      unmappedIngredients: ["원료A"], uncoveredConditions: ["신장질환"], engine: "server", from: "history",
    });
  });

  it("names가 없던 옛 행은 영양제·약을 이어 붙이고, 없는 칸은 빈 값으로", () => {
    const e = historyEntry({ id: "r2", created_at: "x", items: { supplements: ["비타민D"], medicines: ["감기약"] }, findings: [] });
    expect(e.names).toEqual(["비타민D", "감기약"]);
    expect(e.findingsCount).toBe(0);
    expect(e.params).toMatchObject({ findings: [], unmatched: [], unmappedIngredients: [], uncoveredConditions: [], durUnavailable: false });
    expect(e.params?.engine).toBeUndefined();
  });

  it("옛 모양 결과(DUR Finding: medA/medB)는 열지 않는다 — 결과 화면이 깨진다", () => {
    const e = historyEntry({ id: "r3", items: { names: ["a", "b"] }, findings: [{ medA: "a", medB: "b", reason: "x" }] });
    expect(e.findingsCount).toBeNull();
    expect(e.params).toBeNull();
    expect(e.names).toEqual(["a", "b"]);
  });

  it("items·findings가 아예 깨져 있어도 죽지 않는다", () => {
    const e = historyEntry({ id: 7, items: null, findings: "nope" });
    expect(e).toEqual({ id: "7", createdAt: "", names: [], findingsCount: null, params: null });
  });

  it("엔진 값은 server·local만 받고, 문자열이 아닌 이름은 버린다", () => {
    const e = historyEntry({ id: "r4", items: { names: ["a", 3, " ", "b"], engine: null }, findings: [] });
    expect(e.names).toEqual(["a", "b"]);
    expect(e.params?.engine).toBeUndefined();
  });
});

describe("koreanDate / koreanDateTime", () => {
  // 기기 시간대에 맞춰 읽으므로 로컬 시각으로 만든다.
  const pm = new Date(2026, 9, 8, 14, 5).toISOString();
  const am = new Date(2026, 0, 2, 0, 30).toISOString();
  it("날짜", () => {
    expect(koreanDate(pm)).toBe("2026년 10월 8일");
  });
  it("날짜와 오전·오후 시각", () => {
    expect(koreanDateTime(pm)).toBe("2026년 10월 8일 오후 2:05");
    expect(koreanDateTime(am)).toBe("2026년 1월 2일 오전 12:30");
  });
  it("잘못된 값은 빈 문자열", () => {
    expect(koreanDate("")).toBe("");
    expect(koreanDateTime("not a date")).toBe("");
  });
});

describe("historyNamesLine", () => {
  it("3개까지는 모두, 넘으면 앞 3개 + 외 N개", () => {
    expect(historyNamesLine([])).toBe("");
    expect(historyNamesLine(["a", "b", "c"])).toBe("a · b · c");
    expect(historyNamesLine(["a", "b", "c", "d", "e"])).toBe("a · b · c 외 2개");
  });
});

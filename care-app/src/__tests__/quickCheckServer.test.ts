// serverToFindings 매핑 검증 — 네트워크 없음(supabase는 목으로 막는다).
jest.mock("../lib/supabase", () => ({ supabase: { rpc: jest.fn() } }));

import { serverToFindings, ServerCheckResult, ServerFinding } from "../lib/quickCheckServer";

const EMPTY: ServerCheckResult = { resolved: [], unresolved: [], unmapped: [], findings: [], dur: [] };

function finding(over: Partial<ServerFinding>): ServerFinding {
  return {
    code: "R-TEST",
    severity: "caution",
    evidence_level: "established",
    relation_kind: "additive",
    summary: "요약 문구",
    what_happens: null,
    what_to_do: null,
    min_separation_hours: null,
    stop_days_before: null,
    matched: ["오메가3", "혈압약"],
    ...over,
  };
}

describe("serverToFindings — severity/relation_kind → kind·tag 매핑", () => {
  const cases: { severity: ServerFinding["severity"]; relation: string; kind: string; tag: string }[] = [
    { severity: "contraindicated", relation: "additive", kind: "priority", tag: "함께 복용 시 주의" },
    { severity: "caution", relation: "additive", kind: "priority", tag: "우선 확인 필요" },
    { severity: "timing", relation: "absorption", kind: "timing", tag: "복용 시간 확인 필요" },
    { severity: "monitor", relation: "lab", kind: "caution", tag: "주의사항" },
    { severity: "info", relation: "beneficial", kind: "caution", tag: "주의사항" },
    // depletion·limit은 severity와 무관하게 중복·과다(overlap)로 간다.
    { severity: "caution", relation: "depletion", kind: "overlap", tag: "중복·과다 확인" },
    { severity: "monitor", relation: "limit", kind: "overlap", tag: "중복·과다 확인" },
    { severity: "contraindicated", relation: "limit", kind: "overlap", tag: "중복·과다 확인" },
  ];
  for (const c of cases) {
    it(`${c.severity} + ${c.relation} → ${c.kind} / ${c.tag}`, () => {
      const r = serverToFindings({
        ...EMPTY,
        findings: [finding({ severity: c.severity, relation_kind: c.relation })],
      });
      expect(r.findings).toHaveLength(1);
      expect(r.findings[0].kind).toBe(c.kind);
      expect(r.findings[0].tag).toBe(c.tag);
      expect(r.findings[0].source).toBe("rule");
    });
  }
});

describe("serverToFindings — 문구·제목", () => {
  it("what_happens + what_to_do를 줄바꿈으로 잇고 아무것도 덧붙이지 않는다", () => {
    const r = serverToFindings({
      ...EMPTY,
      findings: [finding({ what_happens: "무슨 일이", what_to_do: "어떻게 하면" })],
    });
    expect(r.findings[0].message).toBe("무슨 일이\n어떻게 하면");
  });
  it("what_to_do만 있으면 그것만(null은 건너뛴다)", () => {
    const r = serverToFindings({ ...EMPTY, findings: [finding({ what_happens: null, what_to_do: "어떻게 하면" })] });
    expect(r.findings[0].message).toBe("어떻게 하면");
  });
  it("둘 다 없으면 summary로 폴백", () => {
    const r = serverToFindings({ ...EMPTY, findings: [finding({ summary: "요약만 있음" })] });
    expect(r.findings[0].message).toBe("요약만 있음");
  });
  it("제목은 matched를 ×로 잇고, a·b는 앞의 두 개", () => {
    const r = serverToFindings({ ...EMPTY, findings: [finding({ matched: ["철분", "갑상선약", "위장약"] })] });
    expect(r.findings[0].title).toBe("철분 × 갑상선약 × 위장약");
    expect(r.findings[0].a).toBe("철분");
    expect(r.findings[0].b).toBe("갑상선약");
  });
  it("matched가 비면 code가 제목이 되고 a·b는 빈 문자열", () => {
    const r = serverToFindings({ ...EMPTY, findings: [finding({ matched: [], code: "R-42" })] });
    expect(r.findings[0].title).toBe("R-42");
    expect(r.findings[0].a).toBe("");
    expect(r.findings[0].b).toBe("");
  });
  it("evidence_level과 min_separation_hours를 그대로 실어 나른다", () => {
    const r = serverToFindings({
      ...EMPTY,
      findings: [finding({ evidence_level: "theoretical", min_separation_hours: 4 })],
    });
    expect(r.findings[0].evidenceLevel).toBe("theoretical");
    expect(r.findings[0].minSeparationHours).toBe(4);
  });
});

describe("serverToFindings — DUR 행", () => {
  it("영문 성분 코드를 한국어 이름으로 바꿔 제목·a·b에 쓴다", () => {
    const r = serverToFindings({
      ...EMPTY,
      dur: [{ ingredient_a: "omega3", ingredient_b: "ginkgo_biloba", reason: "병용 시 출혈 위험", notice_no: "제2020-45호" }],
    });
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({
      kind: "priority", source: "dur", tag: "함께 복용 시 주의",
      a: "오메가-3", b: "은행잎", title: "오메가-3 × 은행잎",
      message: "병용 시 출혈 위험", notice_no: "제2020-45호",
    });
  });
  it("모르는 코드는 그대로 보여 준다(폴백)", () => {
    const r = serverToFindings({
      ...EMPTY,
      dur: [{ ingredient_a: "unknown_code_x", ingredient_b: "magnesium", reason: null, notice_no: null }],
    });
    expect(r.findings[0].a).toBe("unknown_code_x");
    expect(r.findings[0].b).toBe("마그네슘");
    expect(r.findings[0].title).toBe("unknown_code_x × 마그네슘");
  });
  it("reason이 없으면 고시 기본 문구", () => {
    const r = serverToFindings({
      ...EMPTY,
      dur: [{ ingredient_a: "A", ingredient_b: "B", reason: null, notice_no: null }],
    });
    expect(r.findings[0].message).toBe("식약처 병용금기 고시에 함께 쓰지 말라고 되어 있는 조합이에요.");
  });
  it("규칙·DUR을 합쳐 우선 → 시간 → 중복 → 주의 순으로 정렬한다", () => {
    const r = serverToFindings({
      ...EMPTY,
      findings: [
        finding({ severity: "monitor", relation_kind: "lab" }),        // caution
        finding({ severity: "timing", relation_kind: "absorption" }),  // timing
        finding({ severity: "caution", relation_kind: "depletion" }),  // overlap
      ],
      dur: [{ ingredient_a: "A", ingredient_b: "B", reason: null, notice_no: null }], // priority
    });
    expect(r.findings.map((f) => f.kind)).toEqual(["priority", "timing", "overlap", "caution"]);
  });
});

describe("serverToFindings — 점검하지 못한 항목", () => {
  it("unmapped는 원료명만 중복 제거해 8개까지 unmappedIngredients로", () => {
    const unmapped = Array.from({ length: 12 }, (_, i) => ({ product: `제품${i}`, ingredient: `원료${i % 10}` }));
    const r = serverToFindings({ ...EMPTY, unmapped });
    expect(r.unmappedIngredients).toHaveLength(8);
    expect(new Set(r.unmappedIngredients).size).toBe(8);
    expect(r.unmappedIngredients[0]).toBe("원료0");
    // "제품: 원료" 형태로 늘어놓지 않는다.
    expect(r.unmappedIngredients.every((s) => !s.includes(":"))).toBe(true);
  });
  it("unresolved는 그대로 돌려준다", () => {
    const r = serverToFindings({ ...EMPTY, unresolved: ["이상한이름", "또다른이름"] });
    expect(r.unresolved).toEqual(["이상한이름", "또다른이름"]);
  });
  it("원료명(unmapped)이 unresolved에 섞이지 않는다 — checkedCount 단위는 입력 이름", () => {
    const r = serverToFindings({
      ...EMPTY,
      unresolved: ["이상한이름"],
      unmapped: [{ product: "제품A", ingredient: "특이원료" }],
    });
    expect(r.unresolved).toEqual(["이상한이름"]);
    expect(r.unmappedIngredients).toEqual(["특이원료"]);
  });
});

describe("serverToFindings — 칩 라벨 해석 검증(presetLabels)", () => {
  const PRESETS = new Set(["유산균", "알레르기약", "항우울제", "오메가3", "철분"]);
  const resolved = (r: ServerCheckResult["resolved"]): ServerCheckResult => ({ ...EMPTY, resolved: r });

  it("두 번째 인자가 없으면 기존 동작 그대로(unresolved만 돌려준다)", () => {
    const r = serverToFindings(resolved([{ input: "유산균", via: "hff_product", substance_ids: [1] }]));
    expect(r.unresolved).toEqual([]);
  });
  it("유산균이 hff_product로 풀리면(임의 제품 성분) 점검 못 한 항목으로 친다", () => {
    const r = serverToFindings(resolved([{ input: "유산균", via: "hff_product", substance_ids: [3, 4] }]), PRESETS);
    expect(r.unresolved).toEqual(["유산균"]);
  });
  it("알레르기약이 chip이지만 substance_ids가 null이면 점검 못 한 항목", () => {
    const r = serverToFindings(resolved([{ input: "알레르기약", via: "chip", substance_ids: null }]), PRESETS);
    expect(r.unresolved).toEqual(["알레르기약"]);
  });
  it("chip인데 substance_ids가 빈 배열이어도 점검 못 한 항목", () => {
    const r = serverToFindings(resolved([{ input: "철분", via: "chip", substance_ids: [] }]), PRESETS);
    expect(r.unresolved).toEqual(["철분"]);
  });
  it("항우울제가 substance로 풀리고 ids가 있으면 정상", () => {
    const r = serverToFindings(resolved([{ input: "항우울제", via: "substance", substance_ids: [68] }]), PRESETS);
    expect(r.unresolved).toEqual([]);
  });
  it("오메가3가 chip으로 풀리고 ids가 있으면 정상", () => {
    const r = serverToFindings(resolved([{ input: "오메가3", via: "chip", substance_ids: [12] }]), PRESETS);
    expect(r.unresolved).toEqual([]);
  });
  it("칩이 아닌 제품명은 hff_product로 풀려도 그대로 정상", () => {
    const r = serverToFindings(resolved([{ input: "락토핏 골드", via: "hff_product", substance_ids: [3] }]), PRESETS);
    expect(r.unresolved).toEqual([]);
  });
  it("서버 unresolved를 먼저, 그 뒤에 칩 검증 탈락을 붙이고 중복은 뺀다", () => {
    const r = serverToFindings(
      {
        ...EMPTY,
        unresolved: ["여드름약", "알레르기약"],
        resolved: [
          { input: "유산균", via: "hff_product", substance_ids: [3] },
          { input: "알레르기약", via: "chip", substance_ids: null },
        ],
      },
      new Set(["유산균", "알레르기약", "여드름약"])
    );
    expect(r.unresolved).toEqual(["여드름약", "알레르기약", "유산균"]);
  });
});

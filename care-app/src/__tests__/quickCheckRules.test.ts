import { applyRules, sortFindings, RULES, KIND_LABEL, LOCKED_GROUPS, KIND_ORDER, QuickFinding } from "../lib/quickCheckRules";
import { SUPPLEMENT_PRESETS, SUPPLEMENT_MORE, MEDICINE_PRESETS, AGES, CONDS } from "../lib/quickCheck";

const noProfile = { age: null, conditions: [] as string[] };

describe("applyRules", () => {
  it("철분 × 갑상선약 → 복용 시간 조정", () => {
    const r = applyRules({ supplements: ["철분"], medicines: ["갑상선약"], profile: noProfile });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ kind: "timing", a: "철분", b: "갑상선약", title: "철분 × 갑상선약", source: "rule", tag: "복용 시간 확인 필요" });
    expect(r[0].message.length).toBeGreaterThan(10);
  });
  it("종합비타민 + 비타민D → 중복 성분", () => {
    const r = applyRules({ supplements: ["종합비타민", "비타민D"], medicines: [], profile: noProfile });
    expect(r.map((f) => f.kind)).toEqual(["overlap"]);
    expect(r[0].tag).toBe("중복 성분 확인");
  });
  it("여드름약 × 종합비타민 → 과다 복용 확인(overlap)", () => {
    const r = applyRules({ supplements: ["종합비타민"], medicines: ["여드름약"], profile: noProfile });
    expect(r[0]).toMatchObject({ kind: "overlap", tag: "과다 복용 확인" });
  });
  it("임신·수유 중 + 여드름약 → 우선 확인", () => {
    const r = applyRules({ supplements: [], medicines: ["여드름약"], profile: { age: null, conditions: ["임신·수유 중"] } });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ kind: "priority", a: "임신·수유 중", b: "여드름약" });
  });
  it("60대 이상 + 알레르기약 → 주의사항", () => {
    const r = applyRules({ supplements: [], medicines: ["알레르기약"], profile: { age: "60대 이상", conditions: [] } });
    expect(r.map((f) => f.kind)).toEqual(["caution"]);
  });
  it("우선 → 시간 → 중복 → 주의 순으로 정렬", () => {
    const r = applyRules({
      supplements: ["철분", "종합비타민", "홍삼"], medicines: ["갑상선약", "혈압약", "통증·소염제"], profile: noProfile,
    });
    const kinds = r.map((f) => f.kind);
    expect(kinds).toContain("priority");
    expect(kinds).toContain("timing");
    expect(kinds).toContain("overlap");
    expect(kinds).toContain("caution");
    const idx = kinds.map((k) => KIND_ORDER.indexOf(k));
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });
  it("같은 조합이 두 번 나오지 않는다", () => {
    const r = applyRules({ supplements: ["철분", "철분"], medicines: ["갑상선약", "갑상선약"], profile: noProfile });
    expect(r).toHaveLength(1);
  });
  it("모르는 이름은 아무것도 내지 않는다", () => {
    expect(applyRules({ supplements: ["노바스크정"], medicines: ["타이레놀정"], profile: noProfile })).toEqual([]);
    expect(applyRules({ supplements: [], medicines: [], profile: noProfile })).toEqual([]);
  });
  it("결정적: 같은 입력이면 같은 출력", () => {
    const i = { supplements: ["오메가3", "마그네슘"], medicines: ["통증·소염제", "갑상선약"], profile: { age: "60대 이상", conditions: ["신장질환"] } };
    expect(applyRules(i)).toEqual(applyRules(i));
  });
});

describe("규칙 데이터 자체", () => {
  const known = new Set<string>([...SUPPLEMENT_PRESETS, ...SUPPLEMENT_MORE, ...MEDICINE_PRESETS, ...AGES, ...CONDS]);
  it("모든 규칙의 라벨은 칩·profile 라벨과 일치한다", () => {
    for (const r of RULES) {
      expect(known.has(r.a)).toBe(true);
      expect(known.has(r.b)).toBe(true);
    }
  });
  it("규칙 쌍은 중복되지 않는다", () => {
    const keys = RULES.map((r) => [r.a, r.b].sort().join("|") + "|" + r.kind);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("문구는 단정하지 않는다(확인/의료진 언급)", () => {
    for (const r of RULES) expect(/확인/.test(r.message)).toBe(true);
  });
  it("라벨·잠금 묶음", () => {
    expect(KIND_LABEL).toEqual({ priority: "우선 확인 필요", timing: "복용 시간 조정", overlap: "중복·과다 확인", caution: "주의사항" });
    expect(LOCKED_GROUPS.map((g) => g.title)).toEqual(["함께 복용 시 주의", "중복 성분 확인", "복용 시간 조정", "추가 확인이 필요한 항목"]);
  });
});

describe("sortFindings", () => {
  const f = (kind: QuickFinding["kind"], a: string): QuickFinding =>
    ({ kind, a, b: "x", title: `${a} × x`, message: "", tag: "", source: "rule" });
  it("kind 순서로, 같은 kind 안에서는 입력 순서를 지킨다", () => {
    const s = sortFindings([f("caution", "c1"), f("timing", "t1"), f("priority", "p1"), f("timing", "t2")]);
    expect(s.map((x) => x.a)).toEqual(["p1", "t1", "t2", "c1"]);
  });
});

// "1분 복용 점검" — 종류명 칩(혈압약, 오메가3 …)과 기본 정보(연령대·해당 항목)에 맞춰
// 돌리는 상식 규칙. 순수 로직(RN/네트워크 의존 없음, jest 대상).
//
// ⚠️ 이 규칙은 널리 알려진 약물 상식을 옮긴 **초안**으로 **약사 검수 전**이다.
// 검수 결과에 따라 문구·등급(kind)·태그를 바꿔야 한다. 전체 표: docs/quick-check-rules.md
//
// 문구 원칙: 어르신용 쉬운 한국어, 단정 대신 "~할 수 있어 확인이 필요해요".
// 진단·처방처럼 읽히는 표현 금지. 결론은 항상 "약사·의료진과 확인".

export type RuleKind = "priority" | "timing" | "overlap" | "caution";
// priority=우선 확인 필요, timing=복용 시간 조정, overlap=중복·과다 확인, caution=주의사항

export type QuickFinding = {
  kind: RuleKind;
  a: string; b: string;          // 표시용 "A × B" (b는 질환·연령 라벨일 수 있다)
  title: string; message: string;
  tag: string;                   // "우선 확인 필요" | "복용 시간 확인 필요" | "중복 성분 확인" | "과다 복용 확인" | "주의사항"
  source: "rule" | "dur";
  notice_no?: string | null;
};

export const KIND_LABEL: Record<RuleKind, string> = {
  priority: "우선 확인 필요",
  timing: "복용 시간 조정",
  overlap: "중복·과다 확인",
  caution: "주의사항",
};

export const KIND_ORDER: RuleKind[] = ["priority", "timing", "overlap", "caution"];

/** 가입 전 잠금 목록의 묶음·순서 (시안 V8 LOCKED 그대로) */
export const LOCKED_GROUPS: { kind: RuleKind; title: string }[] = [
  { kind: "priority", title: "함께 복용 시 주의" },
  { kind: "overlap", title: "중복 성분 확인" },
  { kind: "timing", title: "복용 시간 조정" },
  { kind: "caution", title: "추가 확인이 필요한 항목" },
];

export const TAG = {
  priority: "우선 확인 필요",
  timing: "복용 시간 확인 필요",
  overlap: "중복 성분 확인",
  excess: "과다 복용 확인",
  caution: "주의사항",
} as const;

type Rule = {
  kind: RuleKind;
  a: string; b: string;   // 칩 라벨 또는 profile 라벨("임신·수유 중", "60대 이상")
  tag: string;
  message: string;
  basis: string;          // 약사 검수용 근거 메모(영문 약리 키워드)
};

// 규칙 배열. 같은 kind 안에서는 이 순서대로 보여 준다.
export const RULES: Rule[] = [
  // ── priority: 우선 확인 필요 ──────────────────────────────────────────────
  {
    kind: "priority", a: "통증·소염제", b: "혈압약", tag: TAG.priority,
    message: "진통·소염제를 오래 드시면 혈압약 효과가 줄고 신장에 부담이 갈 수 있어 확인이 필요해요.",
    basis: "NSAID–antihypertensive (ACEi/ARB/diuretic) BP attenuation, renal risk",
  },
  {
    kind: "priority", a: "항우울제", b: "통증·소염제", tag: TAG.priority,
    message: "함께 드시면 위장 출혈 위험이 높아질 수 있어 확인이 필요해요.",
    basis: "SSRI–NSAID GI bleeding risk",
  },
  {
    kind: "priority", a: "임신·수유 중", b: "혈압약", tag: TAG.priority,
    message: "일부 혈압약은 임신 중에 태아에게 위험할 수 있어요. 반드시 의료진과 확인해 주세요.",
    basis: "ACE inhibitors / ARBs fetotoxic (2nd–3rd trimester); many antihypertensives need review in pregnancy",
  },
  {
    kind: "priority", a: "간질환", b: "고지혈증약", tag: TAG.priority,
    message: "간이 좋지 않을 때는 고지혈증약이 간에 부담을 줄 수 있어 확인이 필요해요.",
    basis: "statins contraindicated in active liver disease / unexplained persistent transaminase elevation",
  },
  {
    kind: "priority", a: "임신·수유 중", b: "여드름약", tag: TAG.priority,
    message: "일부 여드름약은 임신·수유 중에 태아나 아기에게 위험할 수 있어요. 반드시 의료진과 확인해 주세요.",
    basis: "isotretinoin teratogenicity; tetracyclines contraindicated in pregnancy",
  },
  {
    kind: "priority", a: "임신·수유 중", b: "고지혈증약", tag: TAG.priority,
    message: "고지혈증약은 임신·수유 중에 권하지 않는 경우가 많아요. 반드시 의료진과 확인해 주세요.",
    basis: "statins contraindicated/not recommended in pregnancy and lactation",
  },
  {
    kind: "priority", a: "신장질환", b: "통증·소염제", tag: TAG.priority,
    message: "신장이 약한 분이 진통·소염제를 드시면 신장 기능이 더 나빠질 수 있어 확인이 필요해요.",
    basis: "NSAID nephrotoxicity in CKD",
  },
  {
    kind: "priority", a: "신장질환", b: "마그네슘", tag: TAG.priority,
    message: "신장이 약하면 마그네슘이 몸에 쌓일 수 있어, 영양제로 드셔도 되는지 확인이 필요해요.",
    basis: "hypermagnesemia risk with reduced renal clearance",
  },
  {
    kind: "priority", a: "간질환", b: "통증·소염제", tag: TAG.priority,
    message: "간이 약한 분은 진통·소염제 종류와 용량을 꼭 확인해야 해요. 특히 아세트아미노펜(타이레놀 계열)은 간에 부담이 될 수 있어요.",
    basis: "acetaminophen hepatotoxicity; NSAID caution in hepatic impairment",
  },

  // ── timing: 복용 시간 조정 ────────────────────────────────────────────────
  {
    kind: "timing", a: "철분", b: "갑상선약", tag: TAG.timing,
    message: "함께 드시면 갑상선약 흡수가 줄 수 있어요. 4시간 이상 간격을 두고 드시는 게 좋은지 확인이 필요해요.",
    basis: "levothyroxine–iron chelation; separate ≥4h",
  },
  {
    kind: "timing", a: "마그네슘", b: "갑상선약", tag: TAG.timing,
    message: "함께 드시면 갑상선약 흡수가 줄 수 있어요. 시간을 나눠 드시는 게 좋은지 확인이 필요해요.",
    basis: "levothyroxine absorption reduced by magnesium salts; separate ≥4h",
  },
  {
    kind: "timing", a: "위장약", b: "갑상선약", tag: TAG.timing,
    message: "제산제나 위산을 줄이는 약은 갑상선약 흡수를 낮출 수 있어요. 복용 간격 확인이 필요해요.",
    basis: "antacids (Al/Mg/Ca) chelate levothyroxine; PPIs reduce absorption",
  },
  {
    kind: "timing", a: "위장약", b: "철분", tag: TAG.timing,
    message: "위산을 줄이는 약과 함께 드시면 철분 흡수가 줄 수 있어요. 시간을 나눠 드시는 게 좋은지 확인이 필요해요.",
    basis: "iron absorption requires gastric acid; antacid/PPI reduce absorption",
  },
  {
    kind: "timing", a: "아연", b: "철분", tag: TAG.timing,
    message: "아연과 철분은 서로 흡수를 방해할 수 있어요. 시간을 나눠 드시는 게 좋은지 확인이 필요해요.",
    basis: "zinc–iron competitive absorption (DMT1)",
  },

  // ── overlap: 중복·과다 확인 ───────────────────────────────────────────────
  {
    kind: "overlap", a: "종합비타민", b: "비타민D", tag: TAG.overlap,
    message: "종합비타민에 비타민D가 이미 들어 있는 경우가 많아요. 성분표를 보고 겹치지 않는지 확인이 필요해요.",
    basis: "multivitamin commonly contains vitamin D — duplicate intake",
  },
  {
    kind: "overlap", a: "종합비타민", b: "철분", tag: TAG.overlap,
    message: "종합비타민에 철분이 이미 들어 있는 경우가 많아요. 성분표를 보고 겹치지 않는지 확인이 필요해요.",
    basis: "multivitamin commonly contains iron — duplicate intake",
  },
  {
    kind: "overlap", a: "종합비타민", b: "마그네슘", tag: TAG.overlap,
    message: "종합비타민에 마그네슘이 이미 들어 있는 경우가 많아요. 성분표를 보고 겹치지 않는지 확인이 필요해요.",
    basis: "multivitamin commonly contains magnesium — duplicate intake",
  },
  {
    kind: "overlap", a: "종합비타민", b: "아연", tag: TAG.overlap,
    message: "종합비타민에 아연이 이미 들어 있는 경우가 많아요. 성분표를 보고 겹치지 않는지 확인이 필요해요.",
    basis: "multivitamin commonly contains zinc — duplicate intake",
  },
  {
    kind: "overlap", a: "종합비타민", b: "루테인", tag: TAG.overlap,
    message: "종합비타민에 루테인이 들어 있는 제품도 있어요. 성분표를 보고 겹치지 않는지 확인이 필요해요.",
    basis: "some multivitamins include lutein — duplicate intake",
  },
  {
    kind: "overlap", a: "위장약", b: "마그네슘", tag: TAG.overlap,
    message: "제산제 중에는 마그네슘이 든 것이 있어요. 마그네슘 영양제와 겹치면 설사 등이 생길 수 있어 확인이 필요해요.",
    basis: "magnesium-containing antacids + magnesium supplement — additive load, diarrhea",
  },
  {
    kind: "overlap", a: "여드름약", b: "종합비타민", tag: TAG.excess,
    message: "일부 여드름약은 비타민A 계열이에요. 종합비타민의 비타민A와 겹치면 과다가 될 수 있어 확인이 필요해요.",
    basis: "isotretinoin + vitamin A supplements — hypervitaminosis A",
  },

  // ── caution: 주의사항 ─────────────────────────────────────────────────────
  {
    kind: "caution", a: "항우울제", b: "알레르기약", tag: TAG.caution,
    message: "함께 드시면 졸음이 더 심해질 수 있어요. 운전이나 외출 전에는 확인이 필요해요.",
    basis: "additive sedation: antidepressants + first-generation antihistamines",
  },
  {
    kind: "caution", a: "60대 이상", b: "알레르기약", tag: TAG.caution,
    message: "알레르기약은 졸음이나 어지럼을 일으킬 수 있어 넘어짐에 주의가 필요해요. 덜 졸린 약이 있는지 확인해 보세요.",
    basis: "Beers criteria: first-generation antihistamines in older adults — sedation, falls",
  },
  {
    kind: "caution", a: "60대 이상", b: "통증·소염제", tag: TAG.caution,
    message: "진통·소염제를 오래 드시면 위장과 신장에 부담이 될 수 있어요. 장기 복용 중이라면 확인이 필요해요.",
    basis: "Beers criteria: chronic NSAID use in older adults — GI bleeding, renal",
  },
  {
    kind: "caution", a: "홍삼", b: "혈압약", tag: TAG.caution,
    message: "홍삼은 사람에 따라 혈압을 변하게 할 수 있어요. 혈압약과 함께 드시면 혈압을 자주 재 보고 확인이 필요해요.",
    basis: "ginseng may alter blood pressure; monitor with antihypertensives",
  },
  {
    kind: "caution", a: "여드름약", b: "피임약", tag: TAG.caution,
    message: "여드름약 종류에 따라 피임약과 함께 드시는 방법이 달라요. 복용 방법 확인이 필요해요.",
    basis: "isotretinoin requires reliable contraception; some antibiotics/OC interaction advice",
  },
  {
    kind: "caution", a: "오메가3", b: "통증·소염제", tag: TAG.caution,
    message: "둘 다 피가 잘 멎지 않게 할 수 있어, 함께 드시면 멍이나 출혈이 잦아지는지 확인해 주세요.",
    basis: "omega-3 mild antiplatelet effect + NSAID bleeding tendency (clinically minor; reviewer downgraded from priority)",
  },
];

export type RuleInput = {
  supplements: string[];
  medicines: string[];
  profile: { age: string | null; conditions: string[] };
};

/** 고른 칩·기본 정보에 맞는 규칙을 찾아 우선 → 시간 → 중복 → 주의 순으로 돌려준다. 결정적·중복 없음. */
export function applyRules(input: RuleInput): QuickFinding[] {
  const labels = new Set<string>([
    ...input.supplements, ...input.medicines, ...input.profile.conditions,
    ...(input.profile.age ? [input.profile.age] : []),
  ]);
  const seen = new Set<string>();
  const out: QuickFinding[] = [];
  for (const r of RULES) {
    if (!labels.has(r.a) || !labels.has(r.b)) continue;
    const key = `${r.kind}|${r.a}|${r.b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      kind: r.kind, a: r.a, b: r.b, title: `${r.a} × ${r.b}`,
      message: r.message, tag: r.tag, source: "rule", notice_no: null,
    });
  }
  return sortFindings(out);
}

/** kind 순서(우선 → 시간 → 중복 → 주의)로 안정 정렬. 같은 kind 안의 순서는 유지. */
export function sortFindings(findings: QuickFinding[]): QuickFinding[] {
  return findings
    .map((f, i) => ({ f, i }))
    .sort((x, y) => (KIND_ORDER.indexOf(x.f.kind) - KIND_ORDER.indexOf(y.f.kind)) || (x.i - y.i))
    .map((x) => x.f);
}

// 저장된 값이 이 빌드의 QuickFinding 모양인지(구버전 DUR Finding[] 구분용).
export function isQuickFinding(v: unknown): v is QuickFinding {
  if (!v || typeof v !== "object") return false;
  const f = v as Partial<QuickFinding>;
  return typeof f.kind === "string" && (KIND_ORDER as readonly string[]).includes(f.kind)
    && typeof f.title === "string" && typeof f.message === "string"
    && (f.source === "rule" || f.source === "dur");
}

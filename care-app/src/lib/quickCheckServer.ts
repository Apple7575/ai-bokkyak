// "1분 복용 점검" — 서버 판정(quick_check_v1 RPC). 회의 결정: 약사 검수를 거친 DB 문구를
// **그대로** 보여 준다(앱에서 덧붙이거나 고쳐 쓰지 않는다).
// 서버가 실패하면 화면(QuickCheckAnalyzingScreen)이 기존 로컬 판정
// (quickCheckRules.applyRules + 식약처 DUR)으로 폴백한다.
//
// serverToFindings는 순수 함수(jest 대상). runServerCheck만 네트워크를 탄다.

import { supabase } from "./supabase";
import { QuickFinding, sortFindings } from "./quickCheckRules";

export type ServerResolved = {
  input: string;
  via: "chip" | "substance" | "hff_product" | "drug_product";
  substance_ids: number[] | null;
};

export type ServerFinding = {
  code: string;
  severity: "contraindicated" | "caution" | "timing" | "monitor" | "info";
  evidence_level: "established" | "limited" | "conflicting" | "theoretical" | "none_known";
  relation_kind: string; // additive|pk|absorption|depletion|lab|masking|beneficial|defer_to_care|limit
  summary: string;                 // 검수 문구 — 그대로 표시 (한 줄 요약)
  what_happens: string | null;     // 무슨 일이 (화면용, 그대로)
  what_to_do: string | null;       // 어떻게 하면 (화면용, 그대로)
  min_separation_hours: number | null;
  stop_days_before: number | null;
  matched: string[];               // 이 규칙에 걸린 입력 이름들
};

export type ServerDur = {
  ingredient_a: string; ingredient_b: string;
  reason: string | null; notice_no: string | null;
};

export type ServerCheckResult = {
  resolved: ServerResolved[];
  unresolved: string[];                                  // 아무 데서도 못 찾은 입력
  unmapped: { product: string; ingredient: string }[];   // 제품은 찾았지만 성분 매핑 없는 기능성 원료
  findings: ServerFinding[];
  dur: ServerDur[];
};

const TIMEOUT_MS = 10_000;

/** 서버 판정 호출. 에러·타임아웃(10초)·빈 응답이면 던진다 — 호출자가 로컬 판정으로 폴백. */
export async function runServerCheck(
  input: { names: string[]; age: string | null; conditions: string[] }
): Promise<ServerCheckResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("quick_check_v1 timeout")), TIMEOUT_MS);
  });
  try {
    const { data, error } = await Promise.race([
      supabase.rpc("quick_check_v1", {
        p_names: input.names, p_age: input.age, p_conditions: input.conditions,
      }),
      timeout,
    ]);
    if (error) throw error;
    if (!data || typeof data !== "object") throw new Error("quick_check_v1: 빈 응답");
    const r = data as Partial<ServerCheckResult>;
    return {
      resolved: Array.isArray(r.resolved) ? r.resolved : [],
      unresolved: Array.isArray(r.unresolved) ? r.unresolved : [],
      unmapped: Array.isArray(r.unmapped) ? r.unmapped : [],
      findings: Array.isArray(r.findings) ? r.findings : [],
      dur: Array.isArray(r.dur) ? r.dur : [],
    };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// severity→kind 매핑. 단, relation_kind가 중복·과다 계열(depletion|limit)이면 severity와
// 무관하게 overlap으로 — 결과 화면의 "중복·과다 확인" 묶음에 들어가야 해서다.
function kindOf(f: Pick<ServerFinding, "severity" | "relation_kind">): QuickFinding["kind"] {
  if (f.relation_kind === "depletion" || f.relation_kind === "limit") return "overlap";
  if (f.severity === "contraindicated" || f.severity === "caution") return "priority";
  if (f.severity === "timing") return "timing";
  return "caution"; // monitor | info
}

function tagOf(f: Pick<ServerFinding, "severity" | "relation_kind">): string {
  if (f.relation_kind === "depletion" || f.relation_kind === "limit") return "중복·과다 확인";
  switch (f.severity) {
    case "contraindicated": return "함께 복용 시 주의";
    case "timing": return "복용 시간 확인 필요";
    case "caution": return "우선 확인 필요";
    default: return "주의사항"; // monitor | info
  }
}

// 검수 문구 그대로 원칙: what_happens·what_to_do를 줄바꿈으로만 잇고, 둘 다 없으면 summary.
// 앱이 문장을 덧붙이지 않는다.
function messageOf(f: Pick<ServerFinding, "summary" | "what_happens" | "what_to_do">): string {
  const parts = [f.what_happens, f.what_to_do].filter((s): s is string => typeof s === "string" && s.length > 0);
  return parts.length > 0 ? parts.join("\n") : f.summary;
}

const UNMAPPED_CAP = 8;
const DUR_FALLBACK_MESSAGE = "식약처 병용금기 고시에 함께 쓰지 말라고 되어 있는 조합이에요.";

/** 서버 응답을 앱의 QuickFinding 목록으로 옮긴다(정렬 포함). 순수 함수. */
export function serverToFindings(
  res: ServerCheckResult
): { findings: QuickFinding[]; unmatched: string[]; unresolved: string[] } {
  const ruleFindings: QuickFinding[] = res.findings.map((f) => ({
    kind: kindOf(f),
    a: f.matched[0] ?? "",
    b: f.matched[1] ?? "",
    title: f.matched.length > 0 ? f.matched.join(" × ") : f.code,
    message: messageOf(f),
    tag: tagOf(f),
    source: "rule",
    notice_no: null,
    evidenceLevel: f.evidence_level,
    minSeparationHours: f.min_separation_hours ?? null,
  }));
  // DUR 행에는 입력 이름이 없다 — 성분명을 제목으로 쓴다.
  const durFindings: QuickFinding[] = res.dur.map((d) => ({
    kind: "priority",
    a: d.ingredient_a,
    b: d.ingredient_b,
    title: `${d.ingredient_a} × ${d.ingredient_b}`,
    message: d.reason ?? DUR_FALLBACK_MESSAGE,
    tag: "함께 복용 시 주의",
    source: "dur",
    notice_no: d.notice_no,
  }));
  // unmapped를 "제품: 원료"로 다 늘어놓으면 너무 길다 — 원료명만 중복 제거해 8개까지.
  const unmatched = [...new Set(res.unmapped.map((u) => u.ingredient))].slice(0, UNMAPPED_CAP);
  return {
    findings: sortFindings([...ruleFindings, ...durFindings]),
    unmatched,
    unresolved: res.unresolved,
  };
}

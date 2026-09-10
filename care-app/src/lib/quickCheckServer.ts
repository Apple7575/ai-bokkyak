// "1분 복용 점검" — 서버 판정(quick_check_v1 RPC). 회의 결정: 약사 검수를 거친 DB 문구를
// **그대로** 보여 준다(앱에서 덧붙이거나 고쳐 쓰지 않는다).
// 서버가 실패하면 화면(QuickCheckAnalyzingScreen)이 기존 로컬 판정
// (quickCheckRules.applyRules + 식약처 DUR)으로 폴백한다.
//
// serverToFindings는 순수 함수(jest 대상). runServerCheck만 네트워크를 탄다.

import { supabase } from "./supabase";
import { QuickFinding, sortFindings } from "./quickCheckRules";
import { substanceName } from "./substanceNames";

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

// 종류명 칩을 "점검하지 못한 항목"으로 내릴 것인가.
//  (a) via hff_product|drug_product — 임의 제품의 성분으로 풀린 것이라 칩의 뜻과 다르다(예: 유산균).
//      규칙에 걸렸어도 내린다.
//  (b) via chip|substance 인데 substance_ids 가 null·빈 배열 — 성분 대조는 못 했지만 RPC가
//      intake_class 로 규칙을 직접 맞출 수 있다. 어떤 규칙의 matched 에도 안 나오면 내리고,
//      나오면 점검한 것으로 친다(예: 알레르기약).
function shouldDemote(r: ServerResolved, matchedAnywhere: ReadonlySet<string>): boolean {
  if (r.via !== "chip" && r.via !== "substance") return true;
  const hasIds = Array.isArray(r.substance_ids) && r.substance_ids.length > 0;
  return !hasIds && !matchedAnywhere.has(r.input);
}

/** 서버 응답을 앱의 QuickFinding 목록으로 옮긴다(정렬 포함). 순수 함수.
 *  · unresolved: 아무 데서도 못 찾은 **입력 이름** — 결과 화면의 "점검하지 못한 항목"이자
 *    checkedCount 계산 단위(입력 이름과 같은 단위여야 한다).
 *    presetLabels를 주면, 그 라벨 중 칩으로 제대로 풀리지 않은 것(shouldDemote 참고)도
 *    서버 unresolved 뒤에 붙이고(중복 제거) 그 이름이 걸린 규칙 결과는 뺀다. 칩이 아닌 입력(제품명)은 그대로.
 *  · unmappedIngredients: 제품은 찾았지만 성분 매핑이 없던 **원료명**(중복 제거, 8개까지) —
 *    입력 이름이 아니므로 unmatched에 섞지 않는다. */
export function serverToFindings(
  res: ServerCheckResult,
  presetLabels?: ReadonlySet<string>
): { findings: QuickFinding[]; unresolved: string[]; unmappedIngredients: string[] } {
  // 칩이 제대로 풀리지 않은 입력(shouldDemote 참고). 이 이름이 걸린 규칙 결과는 버린다 —
  // "유산균 × 혈압약"과 "점검하지 못한 항목: 유산균"이 같이 뜨면 안 된다. DUR 행에는 입력 이름이
  // 없으므로 그대로 둔다.
  // 순서는 presetLabels(앱 버튼 순서)를 따른다 — 서버 resolved 순서에 기대면 화면 순서가 흔들린다.
  const demoted = new Set<string>();
  if (presetLabels) {
    const matchedAnywhere = new Set(res.findings.flatMap((f) => f.matched));
    const byInput = new Map(res.resolved.map((r) => [r.input, r] as const));
    for (const label of presetLabels) {
      const r = byInput.get(label);
      if (r && shouldDemote(r, matchedAnywhere)) demoted.add(label);
    }
  }
  // 감수하는 손실: matched 가 3개 이상인 규칙도 그중 하나가 탈락하면 통째로 버린다. 클라이언트는
  // 어느 이름이 규칙의 어느 역할(object/precipitant)인지 모르므로 부분 유지가 불가능하다.
  // 서버가 matched 를 역할별로 돌려주면 그때 좁힐 수 있다.
  const ruleFindings: QuickFinding[] = res.findings.filter((f) => !f.matched.some((m) => demoted.has(m))).map((f) => ({
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
  // DUR 행에는 입력 이름이 없다 — 성분명을 제목으로 쓴다. 서버는 영문 코드로 주므로
  // 한국어 이름으로 바꿔 보여 준다(모르는 코드는 그대로).
  const durFindings: QuickFinding[] = res.dur.map((d) => {
    const a = substanceName(d.ingredient_a);
    const b = substanceName(d.ingredient_b);
    return {
      kind: "priority" as const,
      a,
      b,
      title: `${a} × ${b}`,
      message: d.reason ?? DUR_FALLBACK_MESSAGE,
      tag: "함께 복용 시 주의",
      source: "dur" as const,
      notice_no: d.notice_no,
    };
  });
  // unmapped를 "제품: 원료"로 다 늘어놓으면 너무 길다 — 원료명만 중복 제거해 8개까지.
  const unmappedIngredients = [...new Set(res.unmapped.map((u) => u.ingredient))].slice(0, UNMAPPED_CAP);
  const unresolved = [...res.unresolved];
  for (const name of demoted) if (!unresolved.includes(name)) unresolved.push(name);
  return {
    findings: sortFindings([...ruleFindings, ...durFindings]),
    unresolved,
    unmappedIngredients,
  };
}

// "1분 복용 점검" — 순수 로직 (RN/네트워크 의존 없음, jest 대상).
//
// 영양제·복용약을 고르게 하고 두 갈래로 점검한다.
//  · 종류명 칩(혈압약, 오메가3 …) + 기본 정보 → 상식 규칙(quickCheckRules.ts, 약사 검수 전)
//  · 검색·사진으로 넣은 제품명 → 식약처 DUR 병용금기(interactions.ts)
// 결과는 QuickFinding 하나로 합쳐 종류별로 전부 보여 준다(회의 2026-09-10: 잠금 없음).

import type { Finding } from "./interactions";
import { QuickFinding, RuleKind, KIND_ORDER, sortFindings } from "./quickCheckRules";

export type { QuickFinding, RuleKind } from "./quickCheckRules";

// 버튼 라벨은 quickCheckLabels.ts에 있다(서버 라벨 대조 스크립트가 읽는 파일). 여기서 재수출.
export { SUPPLEMENT_PRESETS, SUPPLEMENT_MORE, MEDICINE_PRESETS, AGES, CONDS, NONE_CONDITION } from "./quickCheckLabels";
import { PRESET_LABELS } from "./quickCheckLabels";
export { PRESET_LABELS };

export const NONE_SUPPLEMENT = "먹는 영양제 없음";
export const NONE_MEDICINE = "복용 중인 약 없음";

/** 기본 정보. 상식 규칙(연령·질환 조건)에 쓴다. DUR 병용금기에는 조건이 없다. */
export type QuickCheckProfile = { age: string | null; conditions: string[] };

export type QuickCheckDraft = {
  supplements: string[];
  medicines: string[];
  profile: QuickCheckProfile;
  findings: QuickFinding[] | null;   // null = 아직 점검 안 함 (규칙 + DUR 합친 것, 정렬됨)
  /** 직접 입력·검색한 제품명 중 식약처 자료에서 찾지 못한 이름. 종류명 칩은 규칙이 맡으므로 여기 들어오지 않는다.
   *  서버 판정에서는 unresolved(아무 데서도 못 찾은 입력 이름)가 들어온다 — checkedCount와 같은 단위. */
  unmatched: string[];
  /** 서버 판정 전용: 제품은 찾았지만 성분 매핑이 없던 원료명(입력 이름 아님, 8개까지). 없으면 undefined. */
  unmappedIngredients?: string[];
  /** 서버 판정 전용: 사용자가 고른 기본 정보 중 서버가 아직 판정하지 못하는 라벨(신장질환, 60대 이상 …).
   *  로컬 판정은 내장 규칙이 이 라벨을 직접 다루므로 undefined. 매 판정마다 덮어쓴다. */
  uncoveredConditions?: string[];
  analyzedAt: string | null;    // ISO 시각
  /** 제품명 DUR 대조를 네트워크 문제로 못 했지만 규칙 결과는 있어 넘어간 경우 */
  durUnavailable?: boolean;
  /** 판정 주체: server=quick_check_v1 RPC(검수 문구), local=내장 규칙+DUR 폴백. 없으면 구버전 초안. */
  engine?: "server" | "local";
};

export const EMPTY_DRAFT: QuickCheckDraft = {
  supplements: [], medicines: [], profile: { age: null, conditions: [] },
  findings: null, unmatched: [], analyzedAt: null,
};

/** 칩으로 고른 종류명인가. 종류명은 규칙이 맡고, 제품명(검색·사진)은 DUR이 맡는다. */
export function isPreset(name: string): boolean {
  return PRESET_LABELS.has(name);
}

/** 결과 화면 "점검하지 못한 항목" 설명. 전부 종류명 칩이면 제품 검색을 권해도 소용없다(자료 자체가 없다). */
export function unmatchedDescription(unmatched: string[]): string {
  if (unmatched.length > 0 && unmatched.every(isPreset)) {
    return "아직 점검 자료에 없는 종류예요. 약사에게 함께 말씀해 주세요.";
  }
  return "식약처 자료에서 제품을 찾지 못해 성분을 알 수 없었어요. 약 봉투나 통에 적힌 제품 이름으로 검색하면 확인할 수 있어요.";
}

/** 점검 이름 중 제품명(칩이 아닌 것) — DUR 대조 대상 */
export function customNames(names: string[]): string[] {
  return names.filter((n) => !isPreset(n));
}

// lookupIngredients 결과에서 성분을 하나도 못 찾은 이름. 이 이름들은 대조에서 빠졌으므로
// "이상 없음"이 아니라 "점검하지 못함"으로 알려야 한다. 종류명 칩은 규칙이 맡으므로 제외한다.
export function unmatchedNames(names: string[], ingredientsByName: Record<string, string[]>): string[] {
  return customNames(names).filter((n) => !(ingredientsByName[n] && ingredientsByName[n].length > 0));
}

// 칩을 누른다. "없음"은 나머지를 전부 지우고 혼자 남는다(다시 누르면 빈 목록).
// 실제 항목을 고르면 "없음"은 빠지고 그 항목이 토글된다.
export function toggleItem(list: string[], label: string, noneLabel: string): string[] {
  if (label === noneLabel) {
    return list.includes(noneLabel) ? [] : [noneLabel];
  }
  const without = list.filter((x) => x !== noneLabel);
  return without.includes(label) ? without.filter((x) => x !== label) : [...without, label];
}

// 검색·직접 입력으로 추가. 공백을 다듬고, 이미 있으면 그대로, 빈 값은 무시.
export function addItem(list: string[], label: string, noneLabel: string): string[] {
  const name = label.trim();
  if (!name) return list;
  const without = list.filter((x) => x !== noneLabel);
  return without.includes(name) ? without : [...without, name];
}

// 점검할 이름 목록 = 영양제 ∪ 복용약 − "없음" 라벨, 중복 제거.
export function checkItems(draft: Pick<QuickCheckDraft, "supplements" | "medicines">): string[] {
  const out: string[] = [];
  for (const n of [...draft.supplements, ...draft.medicines]) {
    if (n === NONE_SUPPLEMENT || n === NONE_MEDICINE) continue;
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

/** 식약처 DUR 병용금기 → QuickFinding (우선 확인, 태그 "함께 복용 시 주의") */
export function durToQuickFinding(f: Finding): QuickFinding {
  return {
    kind: "priority", a: f.medA, b: f.medB, title: `${f.medA} × ${f.medB}`,
    message: f.reason ?? "식약처 병용금기 고시에 함께 쓰지 말라고 되어 있는 조합이에요.",
    tag: "함께 복용 시 주의", source: "dur", notice_no: f.notice_no,
  };
}

/** 규칙 결과와 DUR 결과를 합쳐 정렬(우선 → 시간 → 중복 → 주의) */
export function mergeFindings(rules: QuickFinding[], dur: Finding[]): QuickFinding[] {
  return sortFindings([...rules, ...dur.map(durToQuickFinding)]);
}

export type Summary = { total: number; byKind: Record<RuleKind, number> };

export function summarize(findings: QuickFinding[]): Summary {
  const byKind: Record<RuleKind, number> = { priority: 0, timing: 0, overlap: 0, caution: 0 };
  for (const f of findings) byKind[f.kind] += 1;
  return { total: findings.length, byKind };
}

/** 가장 먼저 보여 줄 한 건 = 정렬 후 첫 건 */
export function topFinding(findings: QuickFinding[]): QuickFinding | null {
  const s = sortFindings(findings);
  return s.length > 0 ? s[0] : null;
}

/** 결과 화면 전체 보기: kind 순서대로 묶는다(0건 묶음 제외) */
export function groupByKind(findings: QuickFinding[]): { kind: RuleKind; items: QuickFinding[] }[] {
  const s = sortFindings(findings);
  return KIND_ORDER.map((kind) => ({ kind, items: s.filter((f) => f.kind === kind) })).filter((g) => g.items.length > 0);
}

/** 결과 화면 부제 "혈압약 · 오메가3 · 비타민D 를 대조했어요" — 4개 이상이면 앞 3개 + "외 N개". 0개면 빈 문자열. */
export function checkedNamesLine(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length <= 3) return `${names.join(" · ")} 를 대조했어요`;
  return `${names.slice(0, 3).join(" · ")} 외 ${names.length - 3}개를 대조했어요`;
}

// 실제로 대조한 이름 수 = 고른 이름 − 자료에서 못 찾은 제품명. 결과 화면이 "이상 없음"을
// 말해도 되는지(2개 이상 대조했는지) 판단하는 데 쓴다. 종류명 칩은 항상 대조한 것으로 친다.
export function checkedCount(draft: Pick<QuickCheckDraft, "supplements" | "medicines" | "unmatched">): number {
  return Math.max(0, checkItems(draft).length - draft.unmatched.length);
}

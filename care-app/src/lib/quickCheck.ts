// "1분 복용 점검" — 순수 로직 (RN/네트워크 의존 없음, jest 대상).
//
// 가입 전에 영양제·복용약을 고르게 하고 두 갈래로 점검한다.
//  · 종류명 칩(혈압약, 오메가3 …) + 기본 정보 → 상식 규칙(quickCheckRules.ts, 약사 검수 전)
//  · 검색·사진으로 넣은 제품명 → 식약처 DUR 병용금기(interactions.ts)
// 결과는 QuickFinding 하나로 합쳐 첫 건만 보여 주고 나머지는 가입하면 열린다(잠금).

import type { Finding } from "./interactions";
import { QuickFinding, RuleKind, KIND_ORDER, LOCKED_GROUPS, sortFindings } from "./quickCheckRules";

export type { QuickFinding, RuleKind } from "./quickCheckRules";

// 칩 목록은 시안 V8 그대로 (PM 결정).
export const SUPPLEMENT_PRESETS = [
  "오메가3", "비타민D", "마그네슘", "유산균", "종합비타민", "철분", "루테인", "밀크씨슬",
] as const;
/** "더 보기"를 누르면 SUPPLEMENT_PRESETS 뒤에 이어 붙는 영양제 */
export const SUPPLEMENT_MORE = ["콜라겐", "아연", "홍삼", "단백질보충제"] as const;

export const MEDICINE_PRESETS = [
  "갑상선약", "혈압약", "고지혈증약", "위장약", "통증·소염제", "알레르기약", "피임약", "항우울제", "여드름약",
] as const;

export const NONE_SUPPLEMENT = "먹는 영양제 없음";
export const NONE_MEDICINE = "복용 중인 약 없음";

// 3/3 기본 정보 — 연령대(단일 선택), 해당 항목(복수 선택, "해당 없음"은 나머지를 밀어낸다).
export const AGES = ["20대", "30대", "40대", "50대", "60대 이상"] as const;
export const CONDS = ["임신·수유 중", "신장질환", "간질환", "해당 없음"] as const;
export const NONE_CONDITION = "해당 없음";

/** 기본 정보. 상식 규칙(연령·질환 조건)에 쓴다. DUR 병용금기에는 조건이 없다. */
export type QuickCheckProfile = { age: string | null; conditions: string[] };

export type QuickCheckDraft = {
  supplements: string[];
  medicines: string[];
  profile: QuickCheckProfile;
  findings: QuickFinding[] | null;   // null = 아직 점검 안 함 (규칙 + DUR 합친 것, 정렬됨)
  /** 직접 입력·검색한 제품명 중 식약처 자료에서 찾지 못한 이름. 종류명 칩은 규칙이 맡으므로 여기 들어오지 않는다. */
  unmatched: string[];
  analyzedAt: string | null;    // ISO 시각
  /** 제품명 DUR 대조를 네트워크 문제로 못 했지만 규칙 결과는 있어 넘어간 경우 */
  durUnavailable?: boolean;
};

export const EMPTY_DRAFT: QuickCheckDraft = {
  supplements: [], medicines: [], profile: { age: null, conditions: [] },
  findings: null, unmatched: [], analyzedAt: null,
};

const PRESET_SET = new Set<string>([...SUPPLEMENT_PRESETS, ...SUPPLEMENT_MORE, ...MEDICINE_PRESETS]);

/** 칩으로 고른 종류명인가. 종류명은 규칙이 맡고, 제품명(검색·사진)은 DUR이 맡는다. */
export function isPreset(name: string): boolean {
  return PRESET_SET.has(name);
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

/** 가입 전 잠금 목록: 첫 건을 뺀 나머지를 V8 LOCKED 순서로 묶고, 0건 묶음은 뺀다. */
export function lockedGroups(findings: QuickFinding[]): { kind: RuleKind; title: string; count: number }[] {
  const rest = sortFindings(findings).slice(1);
  const { byKind } = summarize(rest);
  return LOCKED_GROUPS.map((g) => ({ ...g, count: byKind[g.kind] })).filter((g) => g.count > 0);
}

/** 가입 후 전체 보기: kind 순서대로 묶는다(0건 묶음 제외) */
export function groupByKind(findings: QuickFinding[]): { kind: RuleKind; items: QuickFinding[] }[] {
  const s = sortFindings(findings);
  return KIND_ORDER.map((kind) => ({ kind, items: s.filter((f) => f.kind === kind) })).filter((g) => g.items.length > 0);
}

// 가입 전 결과 화면: 첫 건은 보여 주고, 나머지는 잠근다.
export function splitResult(findings: QuickFinding[]): { shown: QuickFinding | null; lockedCount: number } {
  return {
    shown: topFinding(findings),
    lockedCount: Math.max(0, findings.length - 1),
  };
}

// 실제로 대조한 이름 수 = 고른 이름 − 자료에서 못 찾은 제품명. 결과 화면이 "이상 없음"을
// 말해도 되는지(2개 이상 대조했는지) 판단하는 데 쓴다. 종류명 칩은 항상 대조한 것으로 친다.
export function checkedCount(draft: Pick<QuickCheckDraft, "supplements" | "medicines" | "unmatched">): number {
  return Math.max(0, checkItems(draft).length - draft.unmatched.length);
}

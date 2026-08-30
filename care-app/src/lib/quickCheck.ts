// "1분 복용 점검" — 순수 로직 (RN/네트워크 의존 없음, jest 대상).
//
// 가입 전에 영양제·복용약을 고르게 하고, 식약처 DUR 병용금기(interactions.ts)로만
// 점검한다. 결과는 첫 건만 보여 주고 나머지는 가입하면 열린다(잠금).
// 다른 분석 항목(중복 성분·과다 복용 등)은 만들지 않는다 — 근거 데이터가 없다.

import type { Finding } from "./interactions";

export const SUPPLEMENT_PRESETS = [
  "오메가3", "비타민D", "칼슘", "종합비타민", "철분", "루테인", "홍삼", "유산균", "마그네슘",
] as const;

export const MEDICINE_PRESETS = [
  "혈압약", "당뇨약", "고지혈증약", "갑상선약", "위장약", "관절염약", "수면제", "진통·소염제", "알레르기약",
] as const;

export const NONE_SUPPLEMENT = "먹는 영양제 없음";
export const NONE_MEDICINE = "복용 중인 약 없음";

export type QuickCheckDraft = {
  supplements: string[];
  medicines: string[];
  findings: Finding[] | null;   // null = 아직 점검 안 함
  /** 식약처 자료에서 제품을 찾지 못해 점검하지 못한 이름들 ("혈압약" 같은 종류명 등) */
  unmatched: string[];
  analyzedAt: string | null;    // ISO 시각
};

export const EMPTY_DRAFT: QuickCheckDraft = {
  supplements: [], medicines: [], findings: null, unmatched: [], analyzedAt: null,
};

// lookupIngredients 결과에서 성분을 하나도 못 찾은 이름. 이 이름들은 대조에서 빠졌으므로
// "이상 없음"이 아니라 "점검하지 못함"으로 알려야 한다 — 종류명 프리셋은 대부분 여기 걸린다.
export function unmatchedNames(names: string[], ingredientsByName: Record<string, string[]>): string[] {
  return names.filter((n) => !(ingredientsByName[n] && ingredientsByName[n].length > 0));
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

// 가입 전 결과 화면: 첫 건은 보여 주고, 나머지는 잠근다.
export function splitResult(findings: Finding[]): { shown: Finding | null; lockedCount: number } {
  return {
    shown: findings.length > 0 ? findings[0] : null,
    lockedCount: Math.max(0, findings.length - 1),
  };
}

// 실제로 대조한 이름 수 = 고른 이름 − 자료에서 못 찾은 이름. 결과 화면이 "이상 없음"을
// 말해도 되는지(2개 이상 대조했는지) 판단하는 데 쓴다.
export function checkedCount(draft: QuickCheckDraft): number {
  return Math.max(0, checkItems(draft).length - draft.unmatched.length);
}

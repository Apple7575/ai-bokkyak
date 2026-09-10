// 기본 정보 라벨(임신·수유 중, 신장질환 …) → 서버 quick_check_v1이 아는 조건명(condition.name_ko).
// 순수 로직(RN/네트워크 없음, jest 대상).
//
// 배포된 서버는 p_conditions를 name_ko와 **문자열 그대로** 비교한다. 검수된 DB의 조건 규칙은
// 임신 / 만성콩팥병(3~4기·중증) / 혈액투석 / 흡연 / 수술 예정 뿐이다(2026-09-10 확인).
// 앱 라벨과 이름이 다르면 규칙이 하나도 안 걸리므로 여기서 별칭을 붙여 보낸다.
// 별칭을 추가하면 scripts/check-server-labels.mjs의 SENTINELS에도 살아 있는 증거를 넣어야 한다.

import { AGES, CONDS, NONE_CONDITION } from "./quickCheckLabels";

type ConditionLabel = Exclude<(typeof CONDS)[number], typeof NONE_CONDITION> | (typeof AGES)[number];

export const CONDITION_ALIASES: Readonly<Record<ConditionLabel, readonly string[]>> = {
  // DB에는 "임신"만 있다. 수유만 해당하는 사용자도 임신 규칙을 받게 된다(과잉 경고) —
  // MVP에서는 감수하고 약사 확인을 받는다. 없는 수유 조건명을 지어내지 말 것.
  "임신·수유 중": ["임신"],
  // DB에는 만성콩팥병(3~4기·중증) / 혈액투석만 있어 뜻이 다르다(모든 신장질환이 3~4기가 아니다).
  // 약사가 정할 때까지 일부러 매핑하지 않는다.
  "신장질환": [],
  // 서버에 간질환 조건 규칙이 없다.
  "간질환": [],
  // 서버에 연령·고령 조건 규칙이 없다.
  "20대": [],
  "30대": [],
  "40대": [],
  "50대": [],
  "60대 이상": [],
};

/** 서버가 아는 조건명 전체(별칭 값의 합집합). */
const SERVER_NAMES: ReadonlySet<string> = new Set(Object.values(CONDITION_ALIASES).flat());

function aliasesOf(label: string): readonly string[] {
  return Object.prototype.hasOwnProperty.call(CONDITION_ALIASES, label)
    ? CONDITION_ALIASES[label as ConditionLabel]
    : [];
}

/** 서버가 이 라벨을 판정할 수 있는가 — 별칭이 있거나, 라벨 자체가 서버 조건명이면 된다. */
function coveredByServer(label: string): boolean {
  return aliasesOf(label).length > 0 || SERVER_NAMES.has(label);
}

/** 서버에 보낼 조건 입력.
 *  · conditions: 원래 라벨("해당 없음" 제외) + 별칭, 중복 제거, 순서 유지. 원래 라벨을 남기는 건
 *    나중에 DB 이름이 앱 라벨로 바뀌어도 그대로 걸리게 하려는 뜻.
 *  · age: 그대로.
 *  · uncovered: 사용자가 고른 것 중 서버가 판정하지 못하는 라벨 — 별칭이 없고 라벨 자체도
 *    서버 조건명이 아닌 것(표에 없는 구버전 라벨 포함).
 *    조건 먼저, 연령 나중. 결과 화면이 "반영되지 않은 항목"으로 보여 준다. */
export function serverConditionInput(
  profile: { age: string | null; conditions: string[] }
): { age: string | null; conditions: string[]; uncovered: string[] } {
  const conditions: string[] = [];
  const uncovered: string[] = [];
  const push = (s: string) => { if (!conditions.includes(s)) conditions.push(s); };
  for (const label of profile.conditions) {
    if (label === NONE_CONDITION) continue;
    push(label);
    for (const a of aliasesOf(label)) push(a);
    if (!coveredByServer(label) && !uncovered.includes(label)) uncovered.push(label);
  }
  if (profile.age !== null && !coveredByServer(profile.age) && !uncovered.includes(profile.age)) {
    uncovered.push(profile.age);
  }
  return { age: profile.age, conditions, uncovered };
}

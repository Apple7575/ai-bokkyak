// 종류명 칩(혈압약, 유산균 …) → 서버 quick_check_v1이 아는 이름 별칭. 순수 로직(RN/네트워크 없음, jest 대상).
//
// 왜 필요한가(2026-09-17 라이브 RPC로 확인):
//  · 서버는 이름을 intake_class 라벨(칩) / substance.name_ko / 제품명 부분일치로 푼다. 검수된 규칙은
//    대부분 **계열·성분 이름**(칼슘통로차단제, RAS차단제, SSRI, 인삼, 콩 …)에 걸려 있어서, 앱 칩 이름만
//    보내면 성분은 풀리는데 규칙에는 안 걸린다(혈압약 → 9개 성분, 규칙 0건). 칩 뒤에 별칭을 덧붙여
//    보내면 걸린다. 서버는 같은 규칙을 한 번만 돌려주므로 칩+별칭을 함께 보내도 결과가 겹치지 않는다.
//  · "유산균"은 서버에서 임의의 건강기능식품 제품(via hff_product)으로 풀려 엉뚱한 성분이 된다.
//    DB 이름은 "프로바이오틱스"라서, 칩을 빼고 별칭만 보낸다(replace).
//  · 고지혈증약→스타틴처럼 이미 풀리는 칩의 별칭은 지금은 없어도 되지만, DB 이름이 바뀌어도
//    그대로 걸리게 하려는 뜻으로 둔다.
// 별칭은 **서버 응답을 앱으로 되돌릴 때** 원래 칩 이름으로 바꿔 보여 준다(quickCheckServer.serverToFindings의
// aliasOf). 사용자는 별칭 이름을 본 적이 없다.
//
// ⚠️ 형식 규칙: scripts/check-server-labels.mjs가 이 파일을 정규식으로 읽는다. CHIP_ALIASES 항목은
// 한 줄에 하나, `"칩": { names: ["별칭", …] }` 또는 `"칩": { names: [...], replace: true }` 꼴만 쓸 것.
// 별칭을 추가하면 그 스크립트의 [1b]가 라이브 서버에서 chip|substance로 풀리는지 검사한다.

import { PRESET_LABELS } from "./quickCheckLabels";

/** replace: 칩 자체는 보내지 않고 별칭만 보낸다(칩이 서버에서 엉뚱하게 풀릴 때). */
export type ChipAlias = { names: string[]; replace?: boolean };

export const CHIP_ALIASES: Partial<Record<string, ChipAlias>> = {
  "혈압약": { names: ["칼슘통로차단제", "RAS차단제", "칼륨보존이뇨제"] },
  "항우울제": { names: ["SSRI", "SNRI"] },
  "홍삼": { names: ["인삼"] },
  "단백질보충제": { names: ["콩"] },
  "유산균": { names: ["프로바이오틱스"], replace: true },
  "고지혈증약": { names: ["스타틴"] },
  "위장약": { names: ["PPI"] },
  "갑상선약": { names: ["레보티록신"] },
  "오메가3": { names: ["오메가-3"] },
  "비타민D": { names: ["비타민 D"] },
};

function aliasFor(name: string): ChipAlias | undefined {
  // 칩 라벨에만 별칭을 붙인다 — 자유 입력(제품명)은 그대로.
  if (!PRESET_LABELS.has(name)) return undefined;
  return Object.prototype.hasOwnProperty.call(CHIP_ALIASES, name) ? CHIP_ALIASES[name] : undefined;
}

/** 서버로 보낼 이름 목록과, 별칭→원래 칩 역매핑.
 *  · send: 입력 순서대로 칩 다음에 그 별칭. 중복 제거. replace 칩은 칩을 빼고 별칭만.
 *  · aliasOf: 별칭 → 칩. 사용자가 별칭과 같은 이름을 직접 넣었으면 그 이름은 사용자 입력이므로
 *    역매핑에 넣지 않는다(결과에서 지워지거나 다른 칩 이름으로 바뀌면 안 된다). */
export function expandChipNames(names: string[]): { send: string[]; aliasOf: Map<string, string> } {
  const send: string[] = [];
  const aliasOf = new Map<string, string>();
  const userNames = new Set(names);
  const push = (s: string) => { if (!send.includes(s)) send.push(s); };
  for (const n of names) {
    const a = aliasFor(n);
    if (!a) { push(n); continue; }
    if (!a.replace) push(n);
    for (const alias of a.names) {
      push(alias);
      if (!userNames.has(alias) && !aliasOf.has(alias)) aliasOf.set(alias, n);
    }
  }
  return { send, aliasOf };
}

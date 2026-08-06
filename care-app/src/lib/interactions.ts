// 병용금기(약물 상호작용) 판정 — 순수 로직 (RN/네트워크 의존 없음, jest 대상).
//
// 데이터는 supabase/migrate-drug-data.sql 의 두 테이블에서 온다:
//   dur_product_ingredient : 제품명 → 성분
//   dur_contraindication   : 성분 쌍 금기 규칙 (ingredient_a < ingredient_b 로 정렬 저장)
//
// 이 파일은 조회 결과를 조합·대조하는 부분만 담당한다. 네트워크는 화면이 한다.

export type MedIngredients = {
  scheduleId: string;
  name: string;
  ingredients: string[]; // 정규화된 성분명(소문자)
};

export type Rule = {
  ingredient_a: string;
  ingredient_b: string;
  reason: string | null;
  notice_no: string | null;
};

export type Finding = {
  medA: string;      // 약 이름 (사용자에게 보여줄 것)
  medB: string;
  ingredientA: string;
  ingredientB: string;
  reason: string | null;
  notice_no: string | null;
};

// 사전순 정렬 — 테이블이 (a<b)로 저장돼 있어 조회 키도 같은 순서로 맞춘다.
function ordered(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

// 조회에 쓸 성분 목록(중복 제거). 규칙 테이블을 한 번만 조회하기 위한 IN 절 재료.
export function allIngredients(meds: MedIngredients[]): string[] {
  const s = new Set<string>();
  for (const m of meds) for (const g of m.ingredients) if (g) s.add(g);
  return [...s];
}

// 서로 다른 약 사이의 성분 쌍만 만든다.
// 같은 약 안의 성분 조합(복합제 내부)은 제조사가 이미 함께 넣은 것이라 경고 대상이 아니다.
export function crossPairs(meds: MedIngredients[]): { a: string; b: string }[] {
  const seen = new Set<string>();
  const out: { a: string; b: string }[] = [];
  for (let i = 0; i < meds.length; i++) {
    for (let j = i + 1; j < meds.length; j++) {
      for (const ga of meds[i].ingredients) {
        for (const gb of meds[j].ingredients) {
          if (!ga || !gb || ga === gb) continue;
          const [a, b] = ordered(ga, gb);
          const k = a + "|" + b;
          if (seen.has(k)) continue;
          seen.add(k);
          out.push({ a, b });
        }
      }
    }
  }
  return out;
}

// 규칙 목록을 사용자의 약과 대조해, "어떤 약과 어떤 약이 왜 걸리는지"로 바꾼다.
// 같은 약 쌍에 규칙이 여러 개면 각각 남긴다(이유가 다르므로).
// 같은 (약쌍 + 성분쌍) 중복은 제거한다.
export function matchFindings(meds: MedIngredients[], rules: Rule[]): Finding[] {
  const index = new Map<string, Rule>();
  for (const r of rules) {
    const [a, b] = ordered(r.ingredient_a, r.ingredient_b);
    index.set(a + "|" + b, r);
  }
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (let i = 0; i < meds.length; i++) {
    for (let j = i + 1; j < meds.length; j++) {
      const mA = meds[i], mB = meds[j];
      for (const ga of mA.ingredients) {
        for (const gb of mB.ingredients) {
          if (!ga || !gb || ga === gb) continue;
          const [a, b] = ordered(ga, gb);
          const rule = index.get(a + "|" + b);
          if (!rule) continue;
          const k = mA.scheduleId + "|" + mB.scheduleId + "|" + a + "|" + b;
          if (seen.has(k)) continue;
          seen.add(k);
          out.push({
            medA: mA.name, medB: mB.name,
            ingredientA: a, ingredientB: b,
            reason: rule.reason, notice_no: rule.notice_no,
          });
        }
      }
    }
  }
  return out;
}

import Constants from "expo-constants";
import { supabase } from "./supabase";
import { Rule } from "./interactions";
import { cachedIngredients, getIngredientCache, setIngredients } from "./medStore";

// 의약품 참조 데이터 조회 (supabase/migrate-drug-data.sql 의 테이블들).
//
// 이 테이블들은 공공데이터 적재 후에만 존재한다. 아직 안 넣었으면 조회가 실패하는데,
// 그때 무서운 에러를 띄우는 대신 "준비 중"으로 조용히 물러난다 — 복약 관리라는
// 본래 기능은 이 데이터 없이도 온전히 동작해야 한다.

const extra = Constants.expoConfig?.extra ?? {};
const FN = `${(extra.supabaseUrl as string) ?? ""}/functions/v1/ai`;
const ANON = (extra.supabaseAnonKey as string) ?? "";

export type Ready<T> = { ready: true; data: T } | { ready: false };

// 약 이름으로 성분을 찾는다. 사용자가 적은 이름("혈압약")은 제품명과 정확히 같지
// 않으므로 부분일치로 찾고, 여러 제품이 걸리면 성분을 모아 합집합으로 쓴다.
// 결과는 기기에 캐시해 매번 왕복하지 않는다.
async function ingredientsOf(name: string): Promise<string[] | null> {
  const trimmed = name.trim();
  if (trimmed.length < 2) return []; // 한 글자로는 아무 제품이나 걸린다
  const { data, error } = await supabase
    .from("dur_product_ingredient")
    .select("ingredient")
    .ilike("product_name", `%${trimmed}%`)
    .limit(40);
  if (error) return null; // 테이블 없음/네트워크 실패 → 준비 안 됨
  const s = new Set<string>();
  for (const r of data ?? []) {
    const g = (r as { ingredient?: unknown }).ingredient;
    if (typeof g === "string" && g) s.add(g);
  }
  return [...s];
}

// 여러 약의 성분을 한 번에. 캐시에 있으면 네트워크를 건너뛴다.
// 한 건이라도 조회 자체가 불가능하면(테이블 없음) ready:false 로 알린다.
export async function lookupIngredients(names: string[]): Promise<Ready<Record<string, string[]>>> {
  const cache = await getIngredientCache();
  const out: Record<string, string[]> = {};
  let tableMissing = false;
  for (const name of names) {
    const hit = cachedIngredients(name, cache);
    if (hit) { out[name] = hit; continue; }
    const found = await ingredientsOf(name);
    if (found === null) { tableMissing = true; continue; }
    out[name] = found;
    void setIngredients(name, found);
  }
  // 캐시로 전부 채워졌다면 테이블이 없어도 판정은 가능하다.
  if (tableMissing && Object.keys(out).length === 0) return { ready: false };
  return { ready: true, data: out };
}

// 성분 목록에 걸리는 병용금기 규칙을 한 번의 조회로 가져온다.
// (a,b) 양쪽이 모두 사용자 성분 안에 있는 규칙만 남긴다.
export async function fetchContraindications(ingredients: string[]): Promise<Ready<Rule[]>> {
  if (ingredients.length < 2) return { ready: true, data: [] };
  const { data, error } = await supabase
    .from("dur_contraindication")
    .select("ingredient_a,ingredient_b,reason,notice_no")
    .in("ingredient_a", ingredients)
    .in("ingredient_b", ingredients);
  if (error) return { ready: false };
  return { ready: true, data: (data ?? []) as Rule[] };
}

// 제품명 부분검색 — 약 이름으로 등록할 때 후보를 보여주는 용도 (C-07).
export type ProductHit = { product_code: string; product_name: string; company: string | null };

export async function searchProducts(q: string, limit = 20): Promise<Ready<ProductHit[]>> {
  const s = q.trim();
  if (s.length < 2) return { ready: true, data: [] };
  const { data, error } = await supabase
    .from("drug_product")
    .select("product_code,product_name,company")
    .ilike("product_name", `%${s}%`)
    .limit(limit);
  if (error) return { ready: false };
  return { ready: true, data: (data ?? []) as ProductHit[] };
}

// 약 상세 설명(D-02) — 서버에 없는 약은 AI에게 물어 짧게 받아온다.
// 엣지 함수에 ?op=druginfo 가 배포돼 있어야 동작한다. 없으면 null.
export async function fetchDrugInfo(name: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    let res: Response;
    try {
      res = await fetch(`${FN}?op=druginfo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return null;
    const j = (await res.json().catch(() => null)) as { content?: unknown } | null;
    const c = j?.content;
    return typeof c === "string" && c.trim() ? c.trim() : null;
  } catch {
    return null;
  }
}

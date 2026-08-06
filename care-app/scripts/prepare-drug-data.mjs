// 의약품 데이터 정제 — 공공데이터 CSV 2개 → Supabase에 넣을 크기로 축약한다.
//
// 입력 (CP949 인코딩, 심평원/식약처 공개자료):
//   1) 건강보험심사평가원_ATC코드 매핑 목록
//      식약분류,주성분코드,제품코드,제품명,업체명,ATC코드,ATC코드 명칭
//   2) 의약품안전사용서비스(DUR)_병용금기 품목리스트
//      성분명A,제품코드A,제품명A,업체명A,성분명B,제품코드B,제품명B,업체명B,고시번호,상세정보,비고
//
// 왜 축약하나:
//   DUR 원본은 87만 행(218MB)인데 실제 의학적 규칙은 성분 쌍 1,808건뿐이다.
//   "규칙 1건 × 그 성분을 담은 모든 제품 조합"으로 부풀려져 있다. 제품은 계속
//   나오고 단종되지만 성분 조합의 금기는 변하지 않으므로 규칙은 성분 단위로 둔다.
//
// 왜 제품→성분 매핑을 DUR에서 뽑나 (ATC가 아니라):
//   ATC의 "ATC코드 명칭"은 성분명이 아니라 분류명이다("other hypnotics and
//   sedatives"). 이름으로 DUR과 이으면 41%가 유실된다. 반면 DUR 원본은 제품코드와
//   성분명을 같은 행에 갖고 있어 어휘가 정확히 맞고, DUR에 없는 제품은 애초에
//   병용금기 규칙이 없으므로 금기 조회 목적으로는 이것으로 충분하다.
//
// 출력 3종:
//   drug_product.csv           제품 검색·등록용 전체 목록 (ATC 기반)
//   dur_product_ingredient.csv 제품 → 성분 (DUR 기반, 금기 조회용)
//   dur_contraindication.csv   성분 쌍 금기 규칙
//
// 실행:
//   node scripts/prepare-drug-data.mjs <ATC.csv> <DUR.csv> [출력디렉터리]

import { createReadStream, mkdirSync, writeFileSync, statSync } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";

const [atcPath, durPath, outDirArg] = process.argv.slice(2);
if (!atcPath || !durPath) {
  console.error("사용법: node scripts/prepare-drug-data.mjs <ATC.csv> <DUR.csv> [출력디렉터리]");
  process.exit(1);
}
const outDir = outDirArg ?? "supabase/seed";

// ── CSV 파싱 ───────────────────────────────────────────────────────────
// 원본에 따옴표로 감싼 필드(상세정보에 쉼표 포함)가 있어 split(",")로는 깨진다.
function parseRow(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// CP949 파일을 줄 단위로 읽는다. Node 24는 full ICU라 euc-kr 디코딩이 된다.
async function* rows(file) {
  const rl = createInterface({
    input: createReadStream(file).setEncoding("latin1"),
    crlfDelay: Infinity,
  });
  const dec = new TextDecoder("euc-kr");
  let first = true;
  for await (const raw of rl) {
    if (first) { first = false; continue; } // 헤더 버림
    if (!raw.trim()) continue;
    // latin1로 읽은 바이트를 CP949로 다시 해석 (한글 필드 복원)
    yield parseRow(dec.decode(Uint8Array.from(raw, (ch) => ch.charCodeAt(0) & 0xff)));
  }
}

// ── 성분명 정규화 ──────────────────────────────────────────────────────
// 같은 성분이 염(salt)·수화물 표기 차이로 갈라지는 것을 합친다.
//   "rosuvastatin calcium (as rosuvastatin)" → "rosuvastatin"
//   "gemigliptin tartrate sesquihydrate"     → "gemigliptin"
// 규칙을 성분 단위로 합치는 것이 목적이므로, 제품→성분 매핑도 같은 함수를 통과시켜
// 양쪽 어휘가 항상 일치하게 한다.
const SALTS = [
  "hydrochloride", "hydrobromide", "hydrate", "dihydrate", "monohydrate",
  "trihydrate", "sesquihydrate", "hemihydrate", "anhydrous",
  "sodium", "potassium", "calcium", "magnesium", "zinc", "monosodium", "disodium",
  "sulfate", "sulphate", "phosphate", "diphosphate", "nitrate", "acetate", "citrate",
  "maleate", "mesylate", "mesilate", "besylate", "besilate", "tartrate", "bitartrate",
  "succinate", "fumarate", "malate", "oxalate", "tosylate", "ditosylate", "napsylate",
  "carbonate", "chloride", "bromide", "iodide", "lactate", "gluconate", "benzoate",
  "stearate", "palmitate", "propionate", "valerate", "pivalate", "embonate",
  "l-proline", "propanediol", "bis l-proline", "silicon dioxide",
  "granule", "microemulsion",
];

export function normalizeIngredient(raw) {
  let s = String(raw ?? "").toLowerCase().trim();
  s = s.replace(/\([^)]*\)/g, " ");   // 괄호 주석 제거: (as rosuvastatin)
  s = s.replace(/\(.*$/, " ");        // 닫는 괄호가 없는 잘린 표기도 처리
  s = s.replace(/[.,;]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  // 앞쪽 수식어 제거 ("microemulsion cyclosporine")
  for (const w of ["microemulsion", "anhydrous"]) {
    if (s.startsWith(w + " ")) s = s.slice(w.length + 1).trim();
  }
  // 뒤쪽 염 표기를 반복 제거 ("calcium trihydrate" 처럼 겹쳐 붙는다)
  let changed = true;
  while (changed) {
    changed = false;
    for (const salt of SALTS) {
      if (s.endsWith(" " + salt)) { s = s.slice(0, -(salt.length + 1)).trim(); changed = true; }
    }
  }
  return s;
}

// 쌍은 항상 사전순으로 저장 — (a,b)와 (b,a)를 한 행으로 합쳐 양방향 조회를 단순화.
function pairKey(a, b) { return a < b ? [a, b] : [b, a]; }

// ── 1) ATC → 제품 검색·등록용 목록 ────────────────────────────────────
// atc_name은 분류명일 수 있으므로 성분으로 쓰지 않는다(이름을 정직하게 둔다).
async function buildProducts() {
  const byCode = new Map();
  let rowCount = 0;
  for await (const f of rows(atcPath)) {
    rowCount++;
    const [category, mainCode, productCode, productName, company, atcCode, atcName] = f;
    if (!productCode || !productName) continue;
    const code = productCode.trim();
    if (byCode.has(code)) continue; // 복합제는 성분별로 여러 줄 — 제품 1행으로 축약
    byCode.set(code, {
      product_code: code,
      product_name: productName.trim(),
      company: (company ?? "").trim(),
      atc_code: (atcCode ?? "").trim(),
      atc_name: (atcName ?? "").trim(),
      category_code: (category ?? "").trim(),
      main_ingredient_code: (mainCode ?? "").trim(),
    });
  }
  return { rowCount, products: [...byCode.values()] };
}

// ── 2·3) DUR → 성분 쌍 규칙 + 제품→성분 매핑 (한 번에) ────────────────
async function buildDur() {
  const rules = new Map();       // "a|b" → 규칙
  const prodIng = new Map();     // "code|ingredient" → 행
  let rowCount = 0;
  for await (const f of rows(durPath)) {
    rowCount++;
    const a = normalizeIngredient(f[0]);
    const b = normalizeIngredient(f[4]);

    // 제품 → 성분 (양쪽 다 수집)
    for (const [rawName, code, name] of [[f[0], f[1], f[2]], [f[4], f[5], f[6]]]) {
      const ing = normalizeIngredient(rawName);
      const c = (code ?? "").trim();
      if (!ing || !c) continue;
      const k = c + "|" + ing;
      if (!prodIng.has(k)) {
        prodIng.set(k, { product_code: c, product_name: (name ?? "").trim(), ingredient: ing });
      }
    }

    if (!a || !b || a === b) continue;
    const [x, y] = pairKey(a, b);
    const k = x + "|" + y;
    const reason = (f[9] ?? "").trim();
    const notice = (f[8] ?? "").trim();
    const prev = rules.get(k);
    if (!prev) {
      rules.set(k, { ingredient_a: x, ingredient_b: y, reason, notice_no: notice, product_rows: 1 });
    } else {
      prev.product_rows++;
      // 같은 쌍이 여러 고시로 등장하면 더 긴 설명을 남긴다(정보량이 많은 쪽).
      if (reason.length > prev.reason.length) { prev.reason = reason; prev.notice_no = notice; }
    }
  }
  return { rowCount, rules: [...rules.values()], prodIng: [...prodIng.values()] };
}

function writeCsv(file, header, records) {
  const lines = [header.join(",")];
  for (const r of records) lines.push(header.map((h) => csvCell(r[h])).join(","));
  writeFileSync(file, lines.join("\n") + "\n", "utf8");
  return statSync(file).size;
}

function kb(n) { return (n / 1024).toFixed(0) + "KB"; }

const t0 = Date.now();
mkdirSync(outDir, { recursive: true });

console.log("ATC 매핑 읽는 중…");
const atc = await buildProducts();
console.log("DUR 병용금기 읽는 중… (87만 행, 1분 남짓)");
const dur = await buildDur();

// 규칙에 쓰인 성분이 제품→성분 매핑에 다 있는지 — 조회가 실제로 되는지의 지표.
// 같은 파일에서 뽑았으니 100%여야 한다. 아니면 정규화가 비대칭이라는 뜻이다.
const ruleIngredients = new Set();
for (const r of dur.rules) { ruleIngredients.add(r.ingredient_a); ruleIngredients.add(r.ingredient_b); }
const mappedIngredients = new Set(dur.prodIng.map((r) => r.ingredient));
const unmapped = [...ruleIngredients].filter((g) => !mappedIngredients.has(g));

// 검색(ATC)에서 고른 제품이 금기 조회(DUR)로 이어지는 비율.
const atcCodes = new Set(atc.products.map((p) => p.product_code));
const durCodes = new Set(dur.prodIng.map((r) => r.product_code));
const linked = [...durCodes].filter((c) => atcCodes.has(c)).length;

const s1 = writeCsv(
  path.join(outDir, "drug_product.csv"),
  ["product_code", "product_name", "company", "atc_code", "atc_name", "category_code", "main_ingredient_code"],
  atc.products
);
const s2 = writeCsv(
  path.join(outDir, "dur_product_ingredient.csv"),
  ["product_code", "product_name", "ingredient"],
  dur.prodIng
);
const s3 = writeCsv(
  path.join(outDir, "dur_contraindication.csv"),
  ["ingredient_a", "ingredient_b", "reason", "notice_no", "product_rows"],
  dur.rules
);

console.log(`
── 결과 ──────────────────────────────────────────
ATC 원본 ${atc.rowCount.toLocaleString()}행
  → drug_product           ${atc.products.length.toLocaleString()}행  ${kb(s1)}

DUR 원본 ${dur.rowCount.toLocaleString()}행
  → dur_product_ingredient ${dur.prodIng.length.toLocaleString()}행  ${kb(s2)}
  → dur_contraindication   ${dur.rules.length.toLocaleString()}행  ${kb(s3)}   (약 ${Math.round(dur.rowCount / Math.max(1, dur.rules.length))}배 압축)

정합성
  규칙 성분 ${ruleIngredients.size}개 중 매핑 없는 것: ${unmapped.length}개${unmapped.length ? " → " + unmapped.slice(0, 5).join(", ") : " (완전)"}
  DUR 제품 ${durCodes.size.toLocaleString()}개 중 ATC 목록에도 있는 것: ${linked.toLocaleString()}개 (${Math.round((linked / Math.max(1, durCodes.size)) * 100)}%)

출력 ${outDir}/  ·  소요 ${((Date.now() - t0) / 1000).toFixed(1)}초
──────────────────────────────────────────────────`);

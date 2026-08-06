// supabase/seed/*.csv → Supabase 적재.
//
// Supabase Management API의 SQL 실행 엔드포인트를 쓴다(소유자 권한). 참조 테이블은
// RLS가 읽기 전용이라 anon 키로는 넣을 수 없다.
//
// 재실행 안전: 각 테이블을 truncate 한 뒤 다시 넣는다(공공데이터 갱신 시 그대로 재적재).
//
// 실행:
//   SUPABASE_ACCESS_TOKEN=<개인 액세스 토큰> \
//   node scripts/load-drug-data.mjs [프로젝트ref] [시드디렉터리]

import { readFileSync } from "node:fs";
import path from "node:path";

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.argv[2] ?? "atzosfqrzsfrveympcfj";
const SEED = process.argv[3] ?? "supabase/seed";
if (!TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN 환경변수가 필요합니다.");
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function sql(query) {
  const r = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 400)}`);
  try { return JSON.parse(text); } catch { return text; }
}

// CSV 파싱 — 따옴표 안의 쉼표·줄바꿈까지 처리한다(reason 필드에 둘 다 들어 있다).
function parseCsv(text) {
  const rows = [];
  let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  const header = rows.shift();
  return rows
    .filter((r) => r.length === header.length && r.some((v) => v !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

// SQL 리터럴 — 작은따옴표만 이스케이프하면 되고, 빈 값은 NULL로 넣는다.
function lit(v, numeric = false) {
  if (v === undefined || v === null || v === "") return "NULL";
  if (numeric) {
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : "NULL";
  }
  return "'" + String(v).replace(/'/g, "''") + "'";
}

const TABLES = [
  {
    file: "drug_product.csv",
    table: "drug_product",
    cols: ["product_code", "product_name", "company", "atc_code", "atc_name", "category_code", "main_ingredient_code"],
    numeric: [],
  },
  {
    file: "dur_product_ingredient.csv",
    table: "dur_product_ingredient",
    cols: ["product_code", "product_name", "ingredient"],
    numeric: [],
  },
  {
    file: "dur_contraindication.csv",
    table: "dur_contraindication",
    cols: ["ingredient_a", "ingredient_b", "reason", "notice_no", "product_rows"],
    numeric: ["product_rows"],
  },
];

const CHUNK = 500; // 한 요청에 넣는 행 수 — 너무 크면 요청 본문 한도에 걸린다

for (const t of TABLES) {
  const recs = parseCsv(readFileSync(path.join(SEED, t.file), "utf8"));
  process.stdout.write(`${t.table}: ${recs.length.toLocaleString()}행 `);
  await sql(`truncate table ${t.table};`);
  for (let i = 0; i < recs.length; i += CHUNK) {
    const slice = recs.slice(i, i + CHUNK);
    const values = slice
      .map((r) => "(" + t.cols.map((c) => lit(r[c], t.numeric.includes(c))).join(",") + ")")
      .join(",");
    // 원본에 같은 키가 중복으로 있을 수 있어 충돌은 무시한다(먼저 들어온 값 유지).
    await sql(`insert into ${t.table} (${t.cols.join(",")}) values ${values} on conflict do nothing;`);
    process.stdout.write(".");
  }
  const [{ count }] = await sql(`select count(*)::int as count from ${t.table};`);
  console.log(` → ${Number(count).toLocaleString()}행 적재 완료`);
}

console.log("\n모두 완료.");

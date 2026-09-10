// 앱의 "1분 복용 점검" 라벨이 **라이브** 서버(quick_check_v1 RPC)와 어긋나지 않았는지 대조한다.
// 네트워크가 필요하고 실제 DB를 읽는다(읽기 전용 RPC, anon 키). jest는 오프라인이어야 하므로
// 일부러 jest 테스트가 아니다. 하나라도 ✖이면 exit 1.
//
// 실행: npm run check:server   (URL·키는 app.json → expo.extra 에서 읽는다)
//
// 검사:
//  1. 종류명 칩(영양제·더 보기·복용약)을 하나씩 보내면 via chip|substance 로 풀리고 substance_ids 가
//     비어 있지 않아야 한다. (2026-09-10 기준 유산균·알레르기약·여드름약은 ✖ — 서버 쪽 데이터 공백)
//  2. CONDITION_ALIASES 의 모든 별칭은 SENTINELS 로 살아 있음을 증명해야 한다(증거 없는 별칭은 ✖).
//  3. 조합 센티널(철분+갑상선약 → iron_levothyroxine_absorption).
//  4. 앱 라벨 "임신·수유 중" 만 보내면 아무것도 안 걸린다는 사실(ℹ, 실패 아님) — 별칭이 필요한 이유.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");

if (typeof fetch !== "function") {
  console.error("Node 18 이상이 필요합니다 (전역 fetch 없음).");
  process.exit(1);
}

// --- 설정 ------------------------------------------------------------------
const extra = JSON.parse(read("app.json")).expo?.extra ?? {};
const URL_ = extra.supabaseUrl;
const KEY = extra.supabaseAnonKey;
if (!URL_ || !KEY) {
  console.error("app.json → expo.extra.supabaseUrl / supabaseAnonKey 가 필요합니다.");
  process.exit(1);
}

// --- 라벨 읽기 -------------------------------------------------------------
// quickCheckLabels.ts 는 문자열 배열 상수만 담는 파일이다(파일 머리 주석 참고). 그래서 정규식으로 읽는다.
// conditionAliases.ts 의 CONDITION_ALIASES 도 `"라벨": ["별칭", …]` 꼴만 담는다.
function stringArrayConst(src, name) {
  const m = src.match(new RegExp("export const " + name + /\s*=\s*\[([^\]]*)\]/.source));
  if (!m) throw new Error(`${name} 을(를) 찾지 못했습니다`);
  const out = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  if (out.length === 0) throw new Error(`${name} 이(가) 비어 있습니다 — 파일 형식이 바뀌었는지 확인`);
  return out;
}
function parseLabels() {
  const labelsSrc = read("src/lib/quickCheckLabels.ts");
  const supplements = [...stringArrayConst(labelsSrc, "SUPPLEMENT_PRESETS"), ...stringArrayConst(labelsSrc, "SUPPLEMENT_MORE")];
  const medicines = stringArrayConst(labelsSrc, "MEDICINE_PRESETS");

  const aliasesSrc = read("src/lib/conditionAliases.ts");
  const aliasBody = aliasesSrc.match(/CONDITION_ALIASES[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!aliasBody) throw new Error("CONDITION_ALIASES 를 찾지 못했습니다");
  const aliases = {};
  for (const m of aliasBody[1].matchAll(/"([^"]+)":\s*\[([^\]]*)\]/g)) {
    aliases[m[1]] = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  }
  if (Object.keys(aliases).length === 0) throw new Error("CONDITION_ALIASES 에서 항목을 하나도 읽지 못했습니다 — 파일 형식이 바뀌었는지 확인");
  return { supplements, medicines, aliases };
}

let SUPPLEMENTS, MEDICINES, ALIASES;
try {
  ({ supplements: SUPPLEMENTS, medicines: MEDICINES, aliases: ALIASES } = parseLabels());
} catch (e) {
  console.error(`✖ 라벨 파일 파싱 실패: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
const ALL_ALIASES = [...new Set(Object.values(ALIASES).flat())];

// 별칭이 살아 있다는 증거. 별칭을 추가하면 여기에도 한 줄 넣어야 한다(없으면 ✖).
const SENTINELS = [
  { alias: "임신", names: ["홍국"], expectCode: "pregnancy_red_yeast_rice" },
];
// 조합 센티널 — 라벨 두 개가 실제 규칙에 걸리는지.
const COMBOS = [
  { names: ["철분", "갑상선약"], expectCode: "iron_levothyroxine_absorption" },
];

// --- RPC ---------------------------------------------------------------------
async function rpc(names, conditions = [], age = null) {
  const r = await fetch(`${URL_}/rest/v1/rpc/quick_check_v1`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_names: names, p_age: age, p_conditions: conditions }),
  });
  if (!r.ok) throw new Error(`quick_check_v1 HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return {
    resolved: Array.isArray(d?.resolved) ? d.resolved : [],
    unresolved: Array.isArray(d?.unresolved) ? d.unresolved : [],
    findings: Array.isArray(d?.findings) ? d.findings : [],
  };
}

let pass = 0, fail = 0;
const ok = (msg) => { pass++; console.log(`✔ ${msg}`); };
const bad = (msg) => { fail++; console.log(`✖ ${msg}`); };
const info = (msg) => console.log(`ℹ ${msg}`);

// 1. 칩 해석
async function checkChip(label) {
  const res = await rpc([label]);
  const r = res.resolved.find((x) => x.input === label);
  if (!r) return bad(`칩 "${label}": 해석 안 됨 (unresolved=${JSON.stringify(res.unresolved)})`);
  const ids = Array.isArray(r.substance_ids) ? r.substance_ids : [];
  const viaOk = r.via === "chip" || r.via === "substance";
  if (viaOk && ids.length > 0) return ok(`칩 "${label}": via=${r.via}, substance_ids=${ids.length}개`);
  bad(`칩 "${label}": via=${r.via}, substance_ids=${JSON.stringify(r.substance_ids)} (chip|substance + id 1개 이상이어야 함)`);
}

async function main() {
  console.log(`서버: ${URL_}\n`);
  console.log("[1] 종류명 칩 해석");
  for (const label of [...SUPPLEMENTS, ...MEDICINES]) await checkChip(label);

  console.log("\n[2] 조건 별칭 증거");
  for (const alias of ALL_ALIASES) {
    const s = SENTINELS.find((x) => x.alias === alias);
    if (!s) { bad(`별칭 "${alias}": SENTINELS 에 증거가 없음 — 살아 있는 규칙 조합을 추가할 것`); continue; }
    const res = await rpc(s.names, [alias]);
    const codes = res.findings.map((f) => f.code);
    if (codes.includes(s.expectCode)) ok(`별칭 "${alias}" + ${s.names.join("+")} → ${s.expectCode}`);
    else bad(`별칭 "${alias}" + ${s.names.join("+")}: ${s.expectCode} 없음 (findings=${JSON.stringify(codes)})`);
  }
  for (const s of SENTINELS) {
    if (!ALL_ALIASES.includes(s.alias)) bad(`SENTINELS 의 "${s.alias}" 이(가) CONDITION_ALIASES 에 없음`);
  }

  console.log("\n[3] 조합 센티널");
  for (const c of COMBOS) {
    const res = await rpc(c.names);
    const codes = res.findings.map((f) => f.code);
    if (codes.includes(c.expectCode)) ok(`${c.names.join("+")} → ${c.expectCode}`);
    else bad(`${c.names.join("+")}: ${c.expectCode} 없음 (findings=${JSON.stringify(codes)})`);
  }

  console.log("\n[4] 앱 라벨 그대로 보냈을 때(정보)");
  for (const [label, aliases] of Object.entries(ALIASES)) {
    if (aliases.length === 0) continue;
    const s = SENTINELS.find((x) => x.alias === aliases[0]);
    const names = s ? s.names : ["홍국"];
    const res = await rpc(names, [label]);
    const codes = res.findings.map((f) => f.code);
    if (codes.length === 0) info(`"${label}" 만 보내면 아무 규칙도 안 걸림 → 별칭 ${JSON.stringify(aliases)} 이(가) 필요한 이유`);
    else info(`"${label}" 만 보내도 걸림: ${JSON.stringify(codes)} — 서버가 앱 라벨을 알게 됐다면 별칭을 정리해도 된다`);
  }

  if (pass + fail === 0) {
    console.error("✖ 검사가 하나도 실행되지 않았습니다 — 라벨 파싱을 확인하세요.");
    process.exit(1);
  }
  console.log(`\n결과: ✔ ${pass}  ✖ ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(`✖ 실행 실패: ${e.message}`); process.exit(1); });

// 음성 가이드 멘트 파일 생성 — 개발용 임시(placeholder) 음성.
//
// ⚠️ 이 파일이 만드는 mp3는 성우 녹음이 아니다. 제품에 나갈 음성이 아니다.
//    문서(§1, §6)는 "전량 사전 녹음 인출, 생성형 TTS 미사용"을 원칙으로 정했다.
//    다만 성우 녹음이 나오기 전까지 플로우를 손으로 확인할 수 없어, 같은 파일명·
//    같은 경로로 임시 음성을 채워 둔다. 녹음본이 오면 파일만 덮어쓰면 된다.
//
// 대본은 src/lib/voiceScript.ts 한 곳에서만 읽는다.
//    문서 §7: "코드 내 하드코딩 문구와 녹음 파일 불일치 금지."
//    여기서 문구를 다시 적으면 그 규칙이 깨지므로 절대 복사하지 않는다.
//
// 실행: node scripts/generate-voice-cues.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const OUT_DIR = "assets/voice";
const SRC = "src/lib/voiceScript.ts";

// 문서 §7 녹음 가이드: 40~50대 여성, 표준 대비 85~90% 속도.
// 임시 음성도 최대한 근접시켜 플로우 감각(길이·호흡)을 확인할 수 있게 한다.
// 이 앱의 페르소나 음성. AI 건강전화와 통화 인사말(call-greeting.mp3)이 쓰는 것과 같다.
// 안내 음성이 화면마다 다른 사람처럼 들리면 어르신에게 혼란스럽다.
const VOICE = "marin";
const SPEED = 0.87;

const cfg = JSON.parse(readFileSync("app.json", "utf8")).expo;
const FN = `${cfg.extra.supabaseUrl}/functions/v1/ai`;
const ANON = cfg.extra.supabaseAnonKey;

// voiceScript.ts에서 { id: "V01", kind: "...", text: "..." } 블록을 읽는다.
function readCues() {
  const s = readFileSync(SRC, "utf8");
  const out = [];
  const re = /id:\s*"(V\d{2})"[\s\S]*?text:\s*\n?\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const text = m[2].replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
    out.push({ id: m[1], text });
  }
  return out;
}

const cues = readCues();
if (cues.length === 0) {
  console.error("voiceScript.ts에서 멘트를 읽지 못했습니다. 형식이 바뀌었는지 확인하세요.");
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
const force = process.argv.includes("--force");
let made = 0, skipped = 0;

for (const c of cues) {
  const file = path.join(OUT_DIR, `${c.id}.mp3`);
  // 성우 녹음으로 교체된 파일을 실수로 덮어쓰지 않게, 있으면 건너뛴다.
  if (existsSync(file) && !force) {
    console.log(`  건너뜀 ${c.id} (이미 있음)`);
    skipped++;
    continue;
  }
  const r = await fetch(`${FN}?op=tts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ text: c.text, speed: SPEED, voice: VOICE, model: "gpt-4o-mini-tts" }),
  });
  if (!r.ok) {
    console.error(`  실패 ${c.id}: HTTP ${r.status} ${(await r.text()).slice(0, 120)}`);
    continue;
  }
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  const kb = (Buffer.byteLength(readFileSync(file)) / 1024).toFixed(0);
  console.log(`  생성 ${c.id}  ${kb}KB  ${c.text.slice(0, 28)}…`);
  made++;
}

console.log(`\n생성 ${made}개 · 건너뜀 ${skipped}개 · 총 ${cues.length}개`);
console.log("※ 임시 음성입니다. 성우 녹음이 나오면 같은 파일명으로 덮어쓰세요.");

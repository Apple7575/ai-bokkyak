// 통화 연결 대기 인사말을 엣지 함수 op=tts로 생성해 assets/sounds/에 저장.
// 통화(Realtime) 목소리와 같은 marin 보이스를 사용한다 (gpt-4o-mini-tts).
import { writeFileSync, mkdirSync } from "node:fs";
const URL = "https://atzosfqrzsfrveympcfj.supabase.co/functions/v1/ai?op=tts";
const ANON = "sb_publishable_IxiFvJXOgllELr1E69-u-Q_34H6Oz8a";
const TEXT = "안녕하세요, 모두의 복약입니다.";
mkdirSync("assets/sounds", { recursive: true });
const res = await fetch(URL, {
  method: "POST",
  headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ text: TEXT, speed: 1.0, voice: "marin", model: "gpt-4o-mini-tts" }),
});
if (!res.ok) throw new Error(`call-greeting: ${res.status} ${(await res.text()).slice(0, 200)}`);
const buf = Buffer.from(await res.arrayBuffer());
writeFileSync("assets/sounds/call-greeting.mp3", buf);
console.log(`saved call-greeting.mp3 (${buf.length} bytes)`);

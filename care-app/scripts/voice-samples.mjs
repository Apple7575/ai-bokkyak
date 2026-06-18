import { writeFileSync, mkdirSync } from "node:fs";
const URL = "https://atzosfqrzsfrveympcfj.supabase.co/functions/v1/ai?op=tts";
const ANON = "sb_publishable_IxiFvJXOgllELr1E69-u-Q_34H6Oz8a";
const TEXT = "아침 약 복용 시간입니다. 약을 드신 후 복용 완료를 눌러주세요.";
// [파일명, voice, model]
const candidates = [
  ["nova", "nova", "tts-1"],
  ["alloy", "alloy", "tts-1"],
  ["echo", "echo", "tts-1"],
  ["onyx", "onyx", "tts-1"],
  ["fable", "fable", "tts-1"],
  ["shimmer", "shimmer", "tts-1"],
  ["coral_4omini", "coral", "gpt-4o-mini-tts"],
  ["sage_4omini", "sage", "gpt-4o-mini-tts"],
];
mkdirSync("sound-samples", { recursive: true });
for (const [name, voice, model] of candidates) {
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ text: TEXT, speed: 1.0, voice, model }),
    });
    if (!res.ok) { console.log(`${name}: FAIL ${res.status} ${(await res.text()).slice(0,120)}`); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(`sound-samples/${name}.mp3`, buf);
    console.log(`saved sound-samples/${name}.mp3 (${buf.length} bytes)`);
  } catch (e) { console.log(`${name}: ERR ${String(e)}`); }
}

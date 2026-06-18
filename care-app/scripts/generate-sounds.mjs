// 시간대별 고정 멘트를 엣지 함수 op=tts로 생성해 assets/sounds/에 저장.
import { writeFileSync, mkdirSync } from "node:fs";
const URL = "https://atzosfqrzsfrveympcfj.supabase.co/functions/v1/ai?op=tts";
const ANON = "sb_publishable_IxiFvJXOgllELr1E69-u-Q_34H6Oz8a";
const ments = {
  morning: "아침 약 복용 시간입니다. 약을 드신 후 복용 완료를 눌러주세요.",
  noon: "점심 약 복용 시간입니다. 약을 드신 후 복용 완료를 눌러주세요.",
  evening: "저녁 약 복용 시간입니다. 약을 드신 후 복용 완료를 눌러주세요.",
  night: "취침 약 복용 시간입니다. 약을 드신 후 복용 완료를 눌러주세요.",
};
mkdirSync("assets/sounds", { recursive: true });
for (const [key, text] of Object.entries(ments)) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice: "nova", speed: 0.95 }),
  });
  if (!res.ok) throw new Error(`${key}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(`assets/sounds/${key}.mp3`, buf);
  console.log(`saved ${key}.mp3 (${buf.length} bytes)`);
}

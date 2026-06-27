// 케어(CARE) AI 프록시 — Supabase Edge Function
//
// OpenAI 키를 클라이언트에 노출하지 않기 위한 서버 프록시.
// 앱은 Supabase anon 키로 이 함수를 호출하고, 함수가 서버 시크릿
// OPENAI_API_KEY 로 OpenAI를 대신 호출한다.
//
// 엔드포인트(POST):
//   ?op=tts         — JSON { text, speed? } → OpenAI TTS → mp3 바이너리(audio/mpeg)
//   ?op=parse       — JSON { text } → gpt-4o-mini 복약 파싱 → { content }(JSON 문자열)
//   ?op=ocr         — JSON { image }(base64 jpeg) → gpt-4o-mini 비전 약봉투 인식 → { content }(JSON 문자열)
//
// 배포: supabase functions deploy ai --project-ref <ref>
// 시크릿: supabase secrets set OPENAI_API_KEY=<키> --project-ref <ref>

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const PARSE_SYSTEM =
  '복약 문장에서 다음 JSON만 출력하세요. repeat_days는 매일이면 문자열 "매일", 특정 요일이면 정수 배열을 사용하고 0=일,1=월,2=화,3=수,4=목,5=금,6=토 규칙을 따르세요 (예: 월수금 → [1,3,5]). 형식: {"medicine_name":string,"time_of_day":"아침|점심|저녁|취침","hour":0-23,"minute":0-59,"repeat_days":"매일" 또는 number[]}.';

const OCR_SYSTEM =
  '약봉투/처방전/약 포장 사진에서 복약 일정을 읽어 JSON으로만 출력하세요. ' +
  '여러 약이 있으면 모두 추출합니다. 하루 여러 번 복용이면 시간대별로 항목을 나눕니다(예: 아침·저녁 → 2개 항목). ' +
  'time_of_day는 "아침|점심|저녁|취침" 중 하나로, 복용 시각이 불명확하면 아침=8시,점심=13시,저녁=19시,취침=21시를 기본값으로 추정합니다. ' +
  'repeat_days는 매일이면 문자열 "매일", 특정 요일이면 정수 배열(0=일…6=토). ' +
  '글자가 안 보이거나 약이 없으면 medicines를 빈 배열로 두세요. ' +
  '형식: {"medicines":[{"medicine_name":string,"time_of_day":"아침|점심|저녁|취침","hour":0-23,"minute":0-59,"repeat_days":"매일" 또는 number[]}]}';

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!OPENAI_KEY) return json({ error: "server missing OPENAI_API_KEY" }, 500);

  const op = new URL(req.url).searchParams.get("op");
  try {
    if (op === "tts") {
      const { text, speed, voice, model } = await req.json().catch(() => ({ text: "" }));
      if (!text) return json({ error: "no text" }, 400);
      const r = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: typeof model === "string" ? model : "tts-1",
          voice: typeof voice === "string" ? voice : "nova",
          input: text,
          response_format: "mp3",
          speed: typeof speed === "number" ? speed : 0.9,
        }),
      });
      if (!r.ok) { const detail = await r.text(); return json({ error: "tts failed", detail }, 502); }
      const audio = await r.arrayBuffer();
      return new Response(audio, { status: 200, headers: { ...CORS, "Content-Type": "audio/mpeg" } });
    }

    if (op === "parse") {
      const { text } = await req.json().catch(() => ({ text: "" }));
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: PARSE_SYSTEM },
            { role: "user", content: text ?? "" },
          ],
        }),
      });
      const j = await r.json();
      if (!r.ok) return json({ error: "gpt failed", detail: j }, 502);
      return json({ content: j.choices?.[0]?.message?.content ?? "{}" });
    }

    if (op === "ocr") {
      const { image } = await req.json().catch(() => ({ image: "" }));
      if (!image || typeof image !== "string") return json({ error: "no image" }, 400);
      const dataUrl = image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`;
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: OCR_SYSTEM },
            {
              role: "user",
              content: [
                { type: "text", text: "이 사진의 복약 정보를 추출해 주세요." },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      });
      const j = await r.json();
      if (!r.ok) return json({ error: "gpt failed", detail: j }, 502);
      return json({ content: j.choices?.[0]?.message?.content ?? '{"medicines":[]}' });
    }

    return json({ error: "unknown op (use ?op=tts, ?op=parse, or ?op=ocr)" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

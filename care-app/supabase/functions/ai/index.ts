// 케어(CARE) AI 프록시 — Supabase Edge Function
//
// OpenAI 키를 클라이언트에 노출하지 않기 위한 서버 프록시.
// 앱은 Supabase anon 키로 이 함수를 호출하고, 함수가 서버 시크릿
// OPENAI_API_KEY 로 OpenAI를 대신 호출한다.
//
// 엔드포인트(POST):
//   ?op=transcribe  — multipart(file) 음성 → Whisper 전사 → { text }
//   ?op=parse       — JSON { text } → gpt-4o-mini 복약 파싱 → { content }(JSON 문자열)
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!OPENAI_KEY) return json({ error: "server missing OPENAI_API_KEY" }, 500);

  const op = new URL(req.url).searchParams.get("op");
  try {
    if (op === "transcribe") {
      const inForm = await req.formData();
      const file = inForm.get("file");
      if (!(file instanceof File)) return json({ error: "no file" }, 400);
      const outForm = new FormData();
      outForm.append("file", file, file.name || "audio.m4a");
      outForm.append("model", "whisper-1");
      outForm.append("language", "ko");
      const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_KEY}` },
        body: outForm,
      });
      const j = await r.json();
      if (!r.ok) return json({ error: "whisper failed", detail: j }, 502);
      return json({ text: j.text ?? "" });
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

    return json({ error: "unknown op (use ?op=transcribe or ?op=parse)" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

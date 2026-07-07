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
//   ?op=realtime-token — JSON { patientName?, meds?, model?, voice? } → Realtime 임시 클라이언트 시크릿 → { value, model }
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

// AI 건강전화(Realtime 통화)에서 어르신이 답한 복약 여부를 기록하는 도구 정의.
// Realtime GA 세션 형식: top-level type/name/description/parameters.
const CALL_TOOLS = [
  {
    type: "function",
    name: "record_medication",
    description: "어르신이 특정 약을 드셨는지/안 드셨는지 답하면 즉시 호출한다.",
    parameters: {
      type: "object",
      properties: {
        medicine_name: { type: "string" },
        time_of_day: { type: "string", enum: ["아침", "점심", "저녁", "취침"] },
        status: { type: "string", enum: ["복용함", "안먹음"] },
      },
      required: ["medicine_name", "time_of_day", "status"],
    },
  },
  {
    type: "function",
    name: "end_call",
    description: "마무리 인사를 마친 뒤 통화를 끝낼 때 호출한다.",
    parameters: { type: "object", properties: {} },
  },
];

type CallMed = { medicine_name: string; time_of_day: string; taken?: boolean };

// AI 건강전화 시스템 프롬프트 빌더 (순수 함수).
function buildCallInstructions(patientName: string, meds: CallMed[]): string {
  const 호칭 = patientName ? `${patientName}님` : "어르신";
  const toCheck = meds.filter((m) => m.taken !== true);
  const takenList = meds.filter((m) => m.taken === true);
  const medLines =
    toCheck.length > 0
      ? toCheck.map((m) => `- ${m.time_of_day} ${m.medicine_name}`).join("\n")
      : "- (오늘 확인할 약 없음)";
  const takenLine =
    takenList.length > 0
      ? `다음 약은 이미 드신 것으로 기록되어 있으니 다시 확인하지 마세요: ${
        takenList.map((m) => `${m.time_of_day} ${m.medicine_name}`).join(", ")
      }.`
      : "";
  return [
    "당신은 고령 어르신께 하루 안부 전화를 드리는 다정한 AI 상담원입니다.",
    "항상 존댓말을 쓰고, 짧은 문장으로, 천천히 또박또박, 쉬운 단어로 말합니다.",
    "모든 발화는 한국어로 합니다.",
    "",
    "통화 흐름:",
    `1. 인사 — "${호칭}" 하고 다정하게 인사합니다.`,
    "2. 오늘 복용할 약을 하나씩 확인합니다:",
    medLines,
    ...(takenLine ? [takenLine] : []),
    "3. 안부와 오늘 컨디션을 한두 마디 여쭙습니다.",
    "4. 마무리 인사를 합니다.",
    "",
    "반드시 지킬 것:",
    "- 복약 여부 답을 들으면 반드시 record_medication 도구를 호출합니다.",
    "- 통화를 끝낼 때는 마무리 인사를 한 뒤 end_call 도구를 호출합니다.",
    "- 전체 통화는 3분 이내로 마무리합니다.",
  ].join("\n");
}

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

    if (op === "realtime-token") {
      const body = await req.json().catch(() => ({}));
      const patientName = typeof body.patientName === "string" ? body.patientName : "";
      // meds는 방어적으로 정제: 배열이 아니면 [], 문자열 필드만 채택, 최대 20개.
      const rawMeds = Array.isArray(body.meds) ? body.meds : [];
      const meds: CallMed[] = rawMeds
        .filter((m: unknown) => m && typeof m === "object")
        .map((m: Record<string, unknown>) => ({
          medicine_name: typeof m.medicine_name === "string" ? m.medicine_name : "",
          time_of_day: typeof m.time_of_day === "string" ? m.time_of_day : "",
          taken: m.taken === true,
        }))
        .filter((m: CallMed) => m.medicine_name !== "" && m.time_of_day !== "")
        .slice(0, 20);
      const model = typeof body.model === "string" ? body.model : "gpt-realtime-2.1";
      const voice = typeof body.voice === "string" ? body.voice : "marin";
      const r = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          session: {
            type: "realtime",
            model,
            instructions: buildCallInstructions(patientName, meds),
            audio: { output: { voice } },
            tools: CALL_TOOLS,
          },
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || typeof j.value !== "string" || !j.value) {
        return json({ error: "realtime token failed", detail: j }, 502);
      }
      return json({ value: j.value, model });
    }

    return json({ error: "unknown op (use ?op=tts, ?op=parse, ?op=ocr, or ?op=realtime-token)" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

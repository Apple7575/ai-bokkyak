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
// 카카오 로그인 토큰 교환용 — 앱에 두면 APK에서 꺼낼 수 있으므로 서버 시크릿으로만 둔다.
const KAKAO_REST_KEY = Deno.env.get("KAKAO_REST_KEY") ?? "";
const KAKAO_CLIENT_SECRET = Deno.env.get("KAKAO_CLIENT_SECRET") ?? "";

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

const DRUGINFO_SYSTEM = [
  "고령 어르신이 읽을 약 설명을 씁니다. 한국어 존댓말, 쉬운 단어, 짧은 문장.",
  "형식은 아래 세 줄만. 각 줄은 한두 문장으로 끝냅니다.",
  "무슨 약인가요: (어떤 증상·질환에 쓰는 약인지)",
  "이렇게 드세요: (복용 시 일반적으로 알아두면 좋은 점. 용량은 말하지 않습니다)",
  "조심할 점: (흔한 주의사항. 없으면 '특별히 알려진 건 없어요')",
  "",
  "반드시 지킬 것:",
  "- 용량·복용 횟수를 정하거나 바꾸라고 말하지 않습니다.",
  "- 진단하지 않습니다. 특정 질병이 있다고 단정하지 않습니다.",
  "- 모르는 약이면 추측하지 말고 '이 약은 정보를 찾지 못했어요'라고만 씁니다.",
  "- 마지막 줄에 반드시 '자세한 것은 약사나 의사에게 확인해 주세요.'를 붙입니다.",
].join("\n");

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

// 모든 통화에 공통으로 붙는 안전 가드레일.
// 이 앱은 의료기기가 아니고 대상이 고령 어르신이므로, 모델이 진단·용량 조정 같은
// 의료 조언을 하거나 복약과 무관한 주제로 끌려가지 않도록 명시적으로 제한한다.
const GUARDRAILS = [
  "",
  "반드시 지킬 안전 규칙:",
  "- 역할 한정: 복약 일정의 등록·변경·확인과 간단한 안부 인사만 합니다.",
  "- 의료 조언 금지: 질병 진단, 치료법, 약의 효능·부작용·용량 변경을 권고하지 않습니다.",
  "  그런 질문에는 \"약에 대한 자세한 상담은 의사나 약사와 상의해 주세요\"라고 안내하고",
  "  복약 일정 이야기로 돌아옵니다.",
  "- 응급 상황(가슴 통증, 호흡 곤란, 의식 저하 등)을 말씀하시면 즉시",
  "  \"119에 전화해 주세요\"라고 안내하고 통화를 마무리합니다.",
  "- 주제 이탈 처리: 복약과 무관한 요청(일반 상식, 금융, 다른 앱 조작 등)은 정중히 거절하고",
  "  대화를 복약으로 되돌립니다.",
  "- 사실성: 아래 목록과 도구 결과에 있는 정보만 사실로 말합니다. 모르는 것은 모른다고 합니다.",
  "  약 이름·시간을 지어내지 않습니다.",
  "- 태도: 어르신이 화를 내시거나 부적절한 말씀을 하셔도 차분하고 정중하게 응대합니다.",
  "- 개인정보: 주민등록번호, 계좌번호, 비밀번호는 절대 묻지 않습니다.",
].join("\n");

// 가입 직후 setup 통화 도구 — 생년월일과 복약 정보를 음성으로 받아 저장한다.
const SETUP_TOOLS = [
  {
    type: "function",
    name: "set_birth_date",
    description: "어르신이 태어난 연도·월·일을 답하면 즉시 호출한다. 연도는 네 자리(예: 1948).",
    parameters: {
      type: "object",
      properties: {
        year: { type: "integer" },
        month: { type: "integer" },
        day: { type: "integer" },
      },
      required: ["year", "month", "day"],
    },
  },
  {
    type: "function",
    name: "add_medication",
    description:
      "어르신이 드시는 약과 복용 시간을 말하면 약 하나마다 한 번씩 호출한다. hour는 24시간제(예: 저녁 8시 → 20).",
    parameters: {
      type: "object",
      properties: {
        medicine_name: { type: "string" },
        time_of_day: { type: "string", enum: ["아침", "점심", "저녁", "취침"] },
        hour: { type: "integer" },
        minute: { type: "integer" },
      },
      required: ["medicine_name", "time_of_day", "hour"],
    },
  },
  {
    type: "function",
    name: "update_medication",
    description:
      "이미 등록한 약의 이름이나 시간을 어르신이 정정하면 호출한다. " +
      "index는 add_medication을 호출한 순서(0부터). 바꿀 항목만 채운다.",
    parameters: {
      type: "object",
      properties: {
        index: { type: "integer" },
        medicine_name: { type: "string" },
        time_of_day: { type: "string", enum: ["아침", "점심", "저녁", "취침"] },
        hour: { type: "integer" },
        minute: { type: "integer" },
      },
      required: ["index"],
    },
  },
  {
    type: "function",
    name: "remove_medication",
    description:
      "이미 등록한 약을 빼 달라고 하면 호출한다. index는 add_medication을 호출한 순서(0부터).",
    parameters: {
      type: "object",
      properties: { index: { type: "integer" } },
      required: ["index"],
    },
  },
  {
    type: "function",
    name: "end_call",
    description: "마무리 인사를 마친 뒤 통화를 끝낼 때 호출한다.",
    parameters: { type: "object", properties: {} },
  },
];

// 가입 직후 setup 통화 시스템 프롬프트 (순수 함수).
function buildSetupInstructions(patientName: string, gender: string): string {
  const 호칭 = patientName ? `${patientName}님` : "어르신";
  const 성별 = gender ? `(성별: ${gender})` : "";
  return [
    "당신은 고령 어르신의 복약 관리를 처음 도와드리는 다정한 AI 상담원입니다.",
    `방금 가입한 ${호칭}${성별}께 첫 안내 전화를 드립니다.`,
    "항상 존댓말을 쓰고, 짧은 문장으로, 천천히 또박또박, 쉬운 단어로 말합니다.",
    "모든 발화는 한국어로 합니다.",
    "",
    "통화 흐름:",
    `1. 인사 — "${호칭}" 하고 다정하게 인사하고, 몇 가지만 여쭙겠다고 안내합니다.`,
    "2. 생년월일을 여쭙습니다. 답을 들으면 반드시 set_birth_date 도구를 호출합니다.",
    "3. 어떤 약을 드시는지, 그리고 각각 언제(아침/점심/저녁/취침, 몇 시) 드시는지 하나씩 여쭙습니다.",
    "   약을 하나 확인할 때마다 반드시 add_medication 도구를 호출합니다.",
    "   시간이 애매하면 아침 8시, 점심 1시(13시), 저녁 7시(19시), 취침 9시(21시)를 기본으로 제안해 확인받습니다.",
    "4. 더 등록할 약이 없는지 확인하고, 다 되면 마무리 인사를 한 뒤 end_call 도구를 호출합니다.",
    "",
    "등록한 약을 고칠 때:",
    "- add_medication을 호출한 순서대로 0번부터 번호가 매겨집니다(첫 약=0, 두 번째=1 …).",
    "- 어르신이 이름이나 시간을 정정하시면 update_medication을 호출합니다(바꿀 항목만 채움).",
    "- 빼 달라고 하시면 remove_medication을 호출합니다.",
    "- remove_medication으로 약을 뺀 뒤에는 남은 약의 번호가 앞으로 당겨집니다.",
    "  도구 결과에 남은 약 목록이 오니 그 번호를 기준으로 삼으세요.",
    "- 이 번호는 내부 참조용입니다. 어르신께는 번호를 말하지 말고 약 이름으로 말씀하세요.",
    "",
    "반드시 지킬 것:",
    "- 어르신이 숫자를 또박또박 못 말해도 되도록 예/아니오나 쉬운 되물음으로 확인합니다.",
    "- 생년월일·약 답을 들으면 미루지 말고 즉시 해당 도구를 호출합니다.",
    "- 등록·수정 내용은 어르신 화면에 실시간으로 표시되고 있습니다.",
    "- 전체 통화는 4분 이내로 마무리합니다.",
    GUARDRAILS,
  ].join("\n");
}

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
    GUARDRAILS,
  ].join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const op = new URL(req.url).searchParams.get("op");
  // 카카오 로그인은 OpenAI를 쓰지 않는다 — OpenAI 키가 없어도 막지 않는다.
  if (!OPENAI_KEY && op !== "kakao-login") {
    return json({ error: "server missing OPENAI_API_KEY" }, 500);
  }
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

    if (op === "kakao-login") {
      // 카카오 인가 코드 → (서버에서) 토큰 교환 → 회원번호·닉네임만 돌려준다.
      //
      // 왜 서버에서 하나: 토큰 교환에는 클라이언트 시크릿이 필요하다. 앱에 넣으면
      // APK를 뜯어 꺼낼 수 있으므로 OpenAI 키와 같은 원칙으로 서버 뒤에 둔다.
      //
      // 왜 Supabase Auth를 쓰지 않나: Supabase의 카카오 커넥터는 account_email을
      // 하드코딩해 요청하는데, 그 항목은 비즈 앱(사업자등록)이 없으면 켤 수 없어
      // 카카오가 KOE205로 거부한다. 우리는 이메일을 쓰지 않으므로 직접 연동한다.
      if (!KAKAO_REST_KEY || !KAKAO_CLIENT_SECRET) {
        return json({ error: "server missing kakao keys" }, 500);
      }
      const { code, redirect_uri } = await req.json().catch(() => ({}));
      if (typeof code !== "string" || !code) return json({ error: "no code" }, 400);
      if (typeof redirect_uri !== "string" || !redirect_uri) {
        return json({ error: "no redirect_uri" }, 400);
      }

      const form = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: KAKAO_REST_KEY,
        client_secret: KAKAO_CLIENT_SECRET,
        redirect_uri,
        code,
      });
      const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: form.toString(),
      });
      const tokenJson = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || typeof tokenJson.access_token !== "string") {
        // 카카오 오류 코드를 그대로 노출하지 않고 진단용으로만 담는다.
        return json({ error: "kakao token failed", detail: tokenJson }, 502);
      }

      // 닉네임만 읽는다. 이메일·프로필 사진은 요청하지도, 저장하지도 않는다.
      const meRes = await fetch("https://kapi.kakao.com/v2/user/me", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenJson.access_token}`,
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        },
        body: new URLSearchParams({
          property_keys: JSON.stringify(["properties.nickname"]),
        }).toString(),
      });
      const me = await meRes.json().catch(() => ({}));
      if (!meRes.ok || me.id === undefined || me.id === null) {
        return json({ error: "kakao user failed", detail: me }, 502);
      }
      const nickname =
        (me.properties && typeof me.properties.nickname === "string" ? me.properties.nickname : "") ||
        (me.kakao_account && me.kakao_account.profile &&
          typeof me.kakao_account.profile.nickname === "string"
          ? me.kakao_account.profile.nickname
          : "");
      // 회원번호는 숫자로 오므로 문자열로 고정한다(자리수가 커서 정밀도 문제를 피한다).
      return json({ kakaoId: String(me.id), nickname });
    }

    if (op === "druginfo") {
      // 약 상세(D-02) 설명. 우리 DB에 정보가 없는 약을 위한 보완 수단이다.
      // 진단·용량 조정은 금지하고, 마지막에 반드시 약사·의사 확인을 붙이게 한다
      // (통화 가드레일과 같은 원칙 — 이 앱은 의료기기가 아니다).
      const { name } = await req.json().catch(() => ({ name: "" }));
      if (!name || typeof name !== "string") return json({ error: "no name" }, 400);
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 400,
          messages: [
            { role: "system", content: DRUGINFO_SYSTEM },
            { role: "user", content: `약 이름: ${name}` },
          ],
        }),
      });
      const j = await r.json();
      if (!r.ok) return json({ error: "gpt failed", detail: j }, 502);
      return json({ content: j.choices?.[0]?.message?.content ?? "" });
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
      const gender = typeof body.gender === "string" ? body.gender : "";
      // setup=true 이면 가입 직후 프로필/복약 수집 통화, 아니면 평소 복약 확인 통화.
      const setup = body.setup === true;
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
      // 모델명은 client_secrets(세션 생성)와 클라이언트의 SDP 요청(?model=)이 반드시
      // 같아야 한다. 여기서 정한 값을 그대로 반환해 클라이언트가 동일 모델로 통화한다.
      const model = typeof body.model === "string" && body.model ? body.model : "gpt-realtime";
      const voice = typeof body.voice === "string" ? body.voice : "marin";
      const instructions = setup
        ? buildSetupInstructions(patientName, gender)
        : buildCallInstructions(patientName, meds);
      const tools = setup ? SETUP_TOOLS : CALL_TOOLS;
      const r = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          session: {
            type: "realtime",
            model,
            instructions,
            audio: {
              // 입력 전사를 켜야 conversation.item.input_audio_transcription.* 이벤트가
              // 오고, 통화 화면의 "나" 자막이 표시된다. 이 설정이 없으면 모델은 음성을
              // 알아듣지만 전사 이벤트를 보내지 않아 사용자 자막이 영영 비어 있다.
              input: {
                transcription: { model: "gpt-4o-mini-transcribe", language: "ko" },
                // QA 2026-08-20: 스피커로 나간 AI 목소리와 주변 소음을 마이크가 물어
                // "나" 자막에 뜬금없는 말이 채워졌다.
                //   · near_field  — 휴대폰을 얼굴 가까이 대고 쓰는 상황에 맞춘 잡음 억제.
                //   · threshold   — 기본 0.5는 잡음에도 발화 turn이 열린다. 올려 잡는다.
                //   · silence_duration_ms — 어르신은 말 중간에 쉬는 구간이 길다. 기본
                //     500ms면 말을 끊고 끼어들어, 반 토막 난 문장이 전사된다.
                noise_reduction: { type: "near_field" },
                turn_detection: {
                  type: "server_vad",
                  threshold: 0.65,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 800,
                },
              },
              output: { voice },
            },
            tools,
          },
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || typeof j.value !== "string" || !j.value) {
        return json({ error: "realtime token failed", detail: j }, 502);
      }
      return json({ value: j.value, model });
    }

    return json(
      { error: "unknown op (use ?op=tts, ?op=parse, ?op=ocr, ?op=druginfo, ?op=kakao-login, or ?op=realtime-token)" },
      400
    );
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

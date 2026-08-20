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
//   ?op=druginfo    — JSON { name } → gpt-4o-mini 약 설명 → { content }
//   ?op=kakao-login — JSON { code, redirectUri } → 카카오 토큰 교환 → { kakaoId, nickname }
//
// (?op=realtime-token 은 AI 건강전화와 함께 제거됐다 — 회의 결정 2026-08-20.
//  음성 AI를 다시 넣을 때 git 이력에서 되살릴 수 있다.)
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

    return json(
      { error: "unknown op (use ?op=tts, ?op=parse, ?op=ocr, ?op=druginfo, or ?op=kakao-login)" },
      400
    );
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

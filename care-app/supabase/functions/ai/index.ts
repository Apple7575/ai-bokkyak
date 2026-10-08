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
//   ?op=kakao-login   — JSON { code, redirect_uri } → 카카오 토큰 교환 → { kakaoId, nickname }   (옛 빌드용)
//   ?op=kakao-session — JSON { code, redirect_uri } → 카카오 토큰 교환 → 그 회원의 Supabase 로그인 세션
//                       → { access_token, refresh_token, nickname }   (간편 로그인 빌드, 2026-10-09)
//
// (?op=realtime-token 은 AI 건강전화와 함께 제거됐다 — 회의 결정 2026-08-20.
//  음성 AI를 다시 넣을 때 git 이력에서 되살릴 수 있다.)
//
// 배포: supabase functions deploy ai --project-ref <ref>
// 시크릿: supabase secrets set OPENAI_API_KEY=<키> KAKAO_REST_KEY=<키> KAKAO_CLIENT_SECRET=<키> --project-ref <ref>
//   (SUPABASE_URL · SUPABASE_ANON_KEY · SUPABASE_SERVICE_ROLE_KEY 는 Supabase가 엣지 함수에 기본으로 넣어 준다.)

import { createClient } from "npm:@supabase/supabase-js@2";
import { isEmailTaken, isKakaoAccountOf, isKakaoMemberId, kakaoNickname, kakaoSyntheticEmail } from "./kakaoSession.ts";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
// 카카오 로그인 토큰 교환용 — 앱에 두면 APK에서 꺼낼 수 있으므로 서버 시크릿으로만 둔다.
const KAKAO_REST_KEY = Deno.env.get("KAKAO_REST_KEY") ?? "";
const KAKAO_CLIENT_SECRET = Deno.env.get("KAKAO_CLIENT_SECRET") ?? "";
// 카카오 세션 다리용 — Supabase가 엣지 함수에 기본으로 넣어 주는 값. service role 키는 응답·로그에 절대 싣지 않는다.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// OpenAI를 쓰지 않는 op — OpenAI 키가 없어도 막지 않는다.
const NO_OPENAI_OPS = new Set(["kakao-login", "kakao-session"]);

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

// ── 카카오 인가 코드 → 회원번호·닉네임 (kakao-login · kakao-session 공용) ──────────────
// 오류 응답에는 카카오가 준 본문을 싣지 않는다 — 진단은 오류 코드만 로그에 남긴다
// (카카오 오류 설명에는 보낸 인가 코드가 그대로 들어 있기도 하다).

async function readKakaoCode(req: Request): Promise<{ code: string; redirect_uri: string } | Response> {
  const { code, redirect_uri } = await req.json().catch(() => ({}));
  if (typeof code !== "string" || !code) return json({ error: "no code" }, 400);
  if (typeof redirect_uri !== "string" || !redirect_uri) return json({ error: "no redirect_uri" }, 400);
  return { code, redirect_uri };
}

type KakaoMember =
  | { ok: true; kakaoId: string; nickname: string }
  | { ok: false; error: "kakao token failed" | "kakao user failed" };

async function exchangeKakaoCode(code: string, redirectUri: string): Promise<KakaoMember> {
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: KAKAO_REST_KEY,
    client_secret: KAKAO_CLIENT_SECRET,
    redirect_uri: redirectUri,
    code,
  });
  const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: form.toString(),
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || typeof tokenJson.access_token !== "string") {
    console.warn("kakao: 토큰 교환 실패", tokenRes.status, tokenJson.error ?? "", tokenJson.error_code ?? "");
    return { ok: false, error: "kakao token failed" };
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
    console.warn("kakao: 회원 정보 실패", meRes.status, me.code ?? "");
    return { ok: false, error: "kakao user failed" };
  }
  // 회원번호는 숫자로 오므로 문자열로 고정한다(자리수가 커서 정밀도 문제를 피한다).
  return { ok: true, kakaoId: String(me.id), nickname: kakaoNickname(me) };
}

// ── ?op=kakao-session — 카카오 회원 → Supabase 로그인 세션 (2026-10-09) ──────────────
// 왜 이렇게 하나:
//   Supabase Auth에 들어 있는 카카오 로그인(provider "kakao")은 카카오에 account_email(이메일) 동의를 늘 함께
//   요청한다. 그 항목은 비즈 앱(사업자 정보 등록)이어야 켤 수 있는데, 우리 카카오 앱은 아직 비즈 앱이 아니어서
//   (법인 계정 준비 중) 카카오가 KOE205로 막는다. 팀은 지금 카카오 콘솔·Supabase 설정을 바꾸지 않기로 했다.
//   그래서 예전처럼 닉네임(profile_nickname)만 요청하는 직접 연동으로 카카오 회원을 확인하고,
//   그 회원의 Supabase 계정과 세션은 여기서 서버 키로 만들어 준다. 앱은 받은 세션을 setSession으로 앉힌다.
// 무엇이 "이 사람이 그 카카오 회원"임을 보장하나:
//   앱이 보낸 인가 코드를 클라이언트 시크릿과 함께 카카오에 교환해 성공해야만 회원번호를 얻는다. 코드는 한 번만
//   쓸 수 있고 우리 카카오 앱(REST 키)·Redirect URI에 묶여 있다. 앱이 보낸 회원번호를 믿는 일은 없다.
// 계정: 이메일 칸에 회원번호로 만든 가짜 주소(kakaoSession.ts kakaoSyntheticEmail — 메일 서버가 없는 우리 하위 도메인)를
//   넣어 만든다. email_confirm: true라 확인 메일이 나가지 않고, 아래 링크도 만들기만 한다 — 이 흐름은 어떤 메일도
//   보내지 않으며, 그 주소로는 받을 사람도 없다. app_metadata { login: "kakao", kakao_id }로 카카오 계정임을 표시한다
//   (Supabase는 이 계정의 provider를 "email"로 적는다 — 앱의 loginProviderOf가 이 표시를 읽는다).
// 세션: admin.generateLink(magiclink)는 링크를 만들어 돌려줄 뿐 메일을 보내지 않는다. 그 토큰(hashed_token)을
//   곧바로 verifyOtp로 확인해 세션을 받는다. 확인하는 클라이언트는 service role 클라이언트와 따로 둔다 — 한 클라이언트에
//   세션이 앉으면 뒤의 DB 호출이 service role이 아니라 그 사용자 권한으로 나간다.
// 나중에(확인 필요): 법인 비즈 앱이 생기면 Supabase의 카카오 로그인으로 바꿀 수도 있다. 다만
//   · 카카오 회원번호는 카카오 앱마다 따로 매겨진다. "새" 카카오 앱으로 바꾸면 같은 사람도 번호가 달라져 지금 계정과
//     이어지지 않는다 — 지금 앱을 비즈 앱으로 전환하거나 법인으로 이전해야 번호가 유지된다(카카오에 확인 필요).
//   · Supabase 카카오 로그인은 새 계정(provider kakao, 실제 이메일)을 만든다. 지금 계정(가짜 이메일)과 저절로 합쳐지지
//     않으므로, app_metadata.kakao_id로 지금 계정을 찾아 환자 행(patients.user_id)을 옮기는 이전 작업이 필요하다.

// 요청마다 새로 만든다 — 세션을 저장·갱신하지 않는 일회용 클라이언트.
const NO_SESSION_STORE = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const serviceClient = () => createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NO_SESSION_STORE);

async function kakaoSession(req: Request): Promise<Response> {
  if (!KAKAO_REST_KEY || !KAKAO_CLIENT_SECRET) return json({ error: "server missing kakao keys" }, 500);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "server missing supabase keys" }, 500);
  }
  const input = await readKakaoCode(req);
  if (input instanceof Response) return input;
  try {
    const kakao = await exchangeKakaoCode(input.code, input.redirect_uri);
    if (!kakao.ok) return json({ error: kakao.error }, 502);
    if (!isKakaoMemberId(kakao.kakaoId)) {
      console.warn("kakao-session: 회원번호 형식이 숫자가 아님");
      return json({ error: "kakao user failed" }, 502);
    }
    const { kakaoId, nickname } = kakao;
    const email = kakaoSyntheticEmail(kakaoId);
    const admin = serviceClient();

    // 1) 계정 — 처음 온 회원이면 만든다. 두 번째 로그인부터는 "이미 있는 이메일"로 실패하는데 그게 정상이다.
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { login: "kakao", kakao_id: kakaoId },
      user_metadata: { name: nickname, nickname },
    });
    if (created.error && !isEmailTaken(created.error)) {
      console.error("kakao-session: 계정 만들기 실패", created.error.status ?? "", created.error.code ?? "");
      return json({ error: "account failed" }, 500);
    }

    // 2) 세션 — 메일 없이. 링크는 만들기만 하고, 그 토큰을 바로 확인한다.
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    const tokenHash = link.data?.properties?.hashed_token;
    const linkUser = link.data?.user;
    if (link.error || !tokenHash || !linkUser) {
      console.error("kakao-session: 링크 만들기 실패", link.error?.status ?? "", link.error?.code ?? "");
      return json({ error: "session failed" }, 500);
    }
    if (!isKakaoAccountOf(linkUser, kakaoId)) {
      // 같은 가짜 주소를 누가 공개 가입으로 먼저 만들어 둔 계정이다. 여기에 세션을 만들어 주면 그 사람이
      // 이 회원의 기록을 보게 된다 — 막고 로그만 남긴다(관리자가 그 계정을 지우면 풀린다).
      console.error("kakao-session: 카카오 표시가 없는 계정과 주소가 겹침", linkUser.id);
      return json({ error: "account conflict" }, 409);
    }
    const verifier = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, NO_SESSION_STORE);
    // supabase-js v2: token_hash로 확인할 때 type은 "email"("magiclink"는 deprecated — 서버가 같은 토큰을 찾는다).
    const verified = await verifier.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    const session = verified.data?.session;
    if (verified.error || !session) {
      console.error("kakao-session: 토큰 확인 실패", verified.error?.status ?? "", verified.error?.code ?? "");
      return json({ error: "session failed" }, 500);
    }

    // 3) 옛 빌드에서 카카오를 연결해 둔 테스터의 환자 행을 이 계정에 묶는다 — 실패해도 로그인은 계속한다.
    await linkLegacyPatient(admin, session.user.id, kakaoId);

    return json({ access_token: session.access_token, refresh_token: session.refresh_token, nickname });
  } catch (e) {
    console.error("kakao-session: 예외", e instanceof Error ? e.name : typeof e);
    return json({ error: "kakao session failed" }, 500);
  }
}

// 옛 빌드의 카카오 "연결"은 patients.kakao_id만 채웠다. 그 행이 아직 어느 계정에도 묶이지 않았으면(user_id null)
// 이 계정에 묶는다 — 그러면 앱의 findMyPatient가 그 행을 찾아 약·기록을 그대로 이어 쓴다.
// 최선 노력: user_id 칸이 아직 없거나(migrate-auth-1 전), 이 계정에 이미 환자가 있거나(user_id unique),
// 그런 행이 없으면 아무것도 하지 않고 넘어간다. service role이라 RLS를 거치지 않는다.
async function linkLegacyPatient(admin: ReturnType<typeof serviceClient>, userId: string, kakaoId: string): Promise<void> {
  try {
    const { data, error } = await admin.from("patients")
      .update({ user_id: userId })
      .eq("kakao_id", kakaoId)
      .is("user_id", null)
      .select("id");
    if (error) {
      console.warn("kakao-session: 옛 환자 연결 건너뜀", error.code ?? "");
      return;
    }
    if (Array.isArray(data) && data.length > 0) console.log("kakao-session: 옛 환자 행을 계정에 연결함");
  } catch (e) {
    console.warn("kakao-session: 옛 환자 연결 예외 — 건너뜀", e instanceof Error ? e.name : typeof e);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const op = new URL(req.url).searchParams.get("op");
  if (!OPENAI_KEY && !NO_OPENAI_OPS.has(op ?? "")) {
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
      // 옛 빌드(카카오 "연결"·"불러오기")가 부른다 — 응답 모양을 바꾸지 말 것.
      // 카카오 인가 코드 → (서버에서) 토큰 교환 → 회원번호·닉네임만 돌려준다.
      //
      // 왜 서버에서 하나: 토큰 교환에는 클라이언트 시크릿이 필요하다. 앱에 넣으면
      // APK를 뜯어 꺼낼 수 있으므로 OpenAI 키와 같은 원칙으로 서버 뒤에 둔다.
      // 왜 Supabase Auth의 카카오 로그인을 쓰지 않나: ?op=kakao-session 머리말 참고.
      if (!KAKAO_REST_KEY || !KAKAO_CLIENT_SECRET) {
        return json({ error: "server missing kakao keys" }, 500);
      }
      const input = await readKakaoCode(req);
      if (input instanceof Response) return input;
      const kakao = await exchangeKakaoCode(input.code, input.redirect_uri);
      if (!kakao.ok) return json({ error: kakao.error }, 502);
      return json({ kakaoId: kakao.kakaoId, nickname: kakao.nickname });
    }

    if (op === "kakao-session") {
      return await kakaoSession(req);
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
      { error: "unknown op (use ?op=tts, ?op=parse, ?op=ocr, ?op=druginfo, ?op=kakao-login, or ?op=kakao-session)" },
      400
    );
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

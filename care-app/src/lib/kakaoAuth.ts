import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { parseAuthCallback } from "./kakaoCallback";

// 카카오 로그인 — 교체 가능한 좁은 경계.
// 화면은 signInWithKakao()만 쓴다. 브라우저·토큰 교환 세부는 전부 여기 숨긴다.
//
// 왜 Supabase Auth를 쓰지 않나:
//   Supabase의 카카오 커넥터는 scope에 account_email을 하드코딩해 요청한다. 그 항목은
//   비즈 앱(사업자등록)이 없으면 켤 수 없어 카카오가 KOE205로 거부한다(실측 확인).
//   우리는 이메일을 쓰지 않으므로 profile_nickname만 요청하는 직접 연동으로 간다.
//
// 흐름:
//   앱 → kauth.kakao.com/oauth/authorize (scope=profile_nickname)
//      → 카카오 로그인·동의
//      → https://modubokyak.vercel.app/kakao-callback.html?code=...   (중계 페이지)
//      → modubokyak://kakao-callback?code=...                         (앱 복귀)
//      → 엣지 함수 ?op=kakao-login 에 code 전달 → { kakaoId, nickname }
//
//   토큰 교환은 서버에서 한다. 클라이언트 시크릿이 필요한데 앱에 넣으면 APK에서
//   꺼낼 수 있기 때문이다(OpenAI 키와 같은 원칙).
//
//   카카오는 Redirect URI로 http/https만 받는다. 그래서 커스텀 스킴을 직접 쓰지 못하고
//   우리 도메인의 중계 페이지를 한 번 거친다.

const extra = Constants.expoConfig?.extra ?? {};
const SUPABASE_URL = (extra.supabaseUrl as string) ?? "";
const ANON = (extra.supabaseAnonKey as string) ?? "";
const FN = `${SUPABASE_URL}/functions/v1/ai`;
// REST 키는 OAuth의 client_id 역할이라 공개돼도 되는 값이다(시크릿과 다르다).
const REST_KEY = (extra.kakaoRestKey as string) ?? "";

// 카카오 콘솔의 Redirect URI에 이 주소가 등록돼 있어야 한다.
const REDIRECT_URI = "https://modubokyak.vercel.app/kakao-callback.html";
// 중계 페이지가 앱으로 되돌려보내는 주소. app.json의 scheme과 맞아야 한다.
const APP_RETURN_URL = "modubokyak://kakao-callback";

export type KakaoSignInResult =
  | { ok: true; kakaoId: string; nickname: string | null }
  | { ok: false; canceled: boolean; message: string };

function authorizeUrl(): string {
  const q = new URLSearchParams({
    client_id: REST_KEY,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    // 이메일·프로필사진은 요청하지 않는다. 닉네임만 받는다.
    scope: "profile_nickname",
  });
  return `https://kauth.kakao.com/oauth/authorize?${q.toString()}`;
}

export async function signInWithKakao(): Promise<KakaoSignInResult> {
  if (!REST_KEY) {
    return { ok: false, canceled: false, message: "카카오 로그인 설정이 없어요." };
  }
  try {
    const res = await WebBrowser.openAuthSessionAsync(authorizeUrl(), APP_RETURN_URL);
    if (res.type === "cancel" || res.type === "dismiss") {
      return { ok: false, canceled: true, message: "로그인을 취소했어요." };
    }
    if (res.type !== "success" || !res.url) {
      return { ok: false, canceled: false, message: "카카오 로그인 화면을 열지 못했어요." };
    }

    const parsed = parseAuthCallback(res.url);
    if (parsed.kind === "error") {
      return { ok: false, canceled: false, message: "카카오 로그인에 실패했어요. 다시 시도해 주세요." };
    }
    if (parsed.kind !== "code") {
      return { ok: false, canceled: false, message: "카카오에서 인증 정보를 받지 못했어요." };
    }

    // 인가 코드 → 서버에서 토큰 교환 → 회원번호·닉네임
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let r: Response;
    try {
      r = await fetch(`${FN}?op=kakao-login`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ code: parsed.code, redirect_uri: REDIRECT_URI }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!r.ok) {
      return { ok: false, canceled: false, message: "로그인 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요." };
    }
    const j = (await r.json().catch(() => null)) as { kakaoId?: unknown; nickname?: unknown } | null;
    if (!j || typeof j.kakaoId !== "string" || !j.kakaoId) {
      return { ok: false, canceled: false, message: "카카오 계정 정보를 받지 못했어요." };
    }
    const nick = typeof j.nickname === "string" && j.nickname.trim() ? j.nickname.trim() : null;
    return { ok: true, kakaoId: j.kakaoId, nickname: nick };
  } catch {
    return { ok: false, canceled: false, message: "카카오 로그인 중 문제가 생겼어요." };
  } finally {
    try { WebBrowser.maybeCompleteAuthSession(); } catch {}
  }
}

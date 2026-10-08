// 로그인 보조 — 순수 로직 (RN/네트워크 의존 없음, jest 대상).
// 브라우저·Supabase 호출은 auth.ts에 있고, 여기에는 그 사이에서 값을 읽고 고르는 일만 둔다.

// ── 카카오 로그인 창 열기 ───────────────────────────────────────────────────
// 닉네임(profile_nickname)만 요청한다. account_email을 넣으면 비즈 앱이 아닌 지금 카카오 앱은 KOE205로 막힌다
// (그래서 Supabase의 카카오 로그인을 쓰지 않는다 — auth.ts 머리말).
// state: 돌아온 주소가 이번에 연 로그인 창의 것인지 확인하는 무작위 값. 카카오가 그대로 돌려주고
// 중계 페이지(landing/kakao-callback.html)는 쿼리를 통째로 앱에 넘긴다.
export const KAKAO_SCOPE = "profile_nickname";

export function kakaoAuthorizeUrl(p: { clientId: string; redirectUri: string; state: string }): string {
  const q = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: "code",
    scope: KAKAO_SCOPE,
    state: p.state,
  });
  return `https://kauth.kakao.com/oauth/authorize?${q.toString()}`;
}

// ── 로그인 창에서 앱으로 돌아온 주소 읽기 ──────────────────────────────────
// 성공: modubokyak://kakao-callback?code=...&state=...
// 실패: modubokyak://kakao-callback?error=access_denied&error_description=...&state=...
// (# 뒤에 붙어 와도 읽는다.) state가 없으면 null — 맞는지는 auth.ts가 연 창의 값과 비교한다.
export type AuthCallback =
  | { kind: "code"; code: string; state: string | null }
  | { kind: "error"; error: string; message: string }
  | { kind: "none" };

export function parseAuthCallback(url: string): AuthCallback {
  if (typeof url !== "string" || url === "") return { kind: "none" };
  // RN의 URL 파서가 커스텀 스킴에서 흔들려 쿼리 문자열을 직접 읽는다.
  const qs = url.split(/[?#]/).slice(1).join("&");
  if (!qs) return { kind: "none" };
  const params = new Map<string, string>();
  for (const pair of qs.split("&")) {
    if (!pair) continue;
    const i = pair.indexOf("=");
    const k = i < 0 ? pair : pair.slice(0, i);
    const v = i < 0 ? "" : pair.slice(i + 1);
    try {
      params.set(decodeURIComponent(k), decodeURIComponent(v.replace(/\+/g, " ")));
    } catch {
      params.set(k, v);
    }
  }
  const error = params.get("error") || params.get("error_code") || "";
  const description = params.get("error_description") || "";
  if (error || description) return { kind: "error", error: error || "unknown", message: description || error };
  const code = params.get("code");
  if (code) return { kind: "code", code, state: params.get("state") ?? null };
  return { kind: "none" };
}

// 카카오 동의 화면에서 사용자가 "취소"를 고른 것인지 — 이건 실패 안내 없이 조용히 넘긴다.
export function isUserCanceled(cb: AuthCallback): boolean {
  return cb.kind === "error" && cb.error === "access_denied";
}

// ── 엣지 함수 ?op=kakao-session 응답 ────────────────────────────────────────
// 서버가 카카오 회원을 확인하고 만들어 준 Supabase 세션. 모양이 어긋나면 null — 로그인 실패로 안내한다.
export type KakaoSessionTokens = { access_token: string; refresh_token: string; nickname: string | null };

export function parseKakaoSession(body: unknown): KakaoSessionTokens | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.access_token !== "string" || !b.access_token) return null;
  if (typeof b.refresh_token !== "string" || !b.refresh_token) return null;
  const nick = typeof b.nickname === "string" && b.nickname.trim() ? b.nickname.trim() : null;
  return { access_token: b.access_token, refresh_token: b.refresh_token, nickname: nick };
}

// ── 로그인 계정에서 이름·로그인 수단 읽기 ───────────────────────────────────
// supabase-js의 User를 그대로 받되, 여기서 쓰는 칸만 적어 순수 로직으로 남긴다.
export type AuthUserLike = {
  app_metadata?: { provider?: unknown; providers?: unknown; login?: unknown } | null;
  user_metadata?: Record<string, unknown> | null;
};

export type LoginProvider = "kakao" | "apple";

// 카카오 계정은 서버(?op=kakao-session)가 만들어 app_metadata.login = "kakao"로 표시한다. Supabase는 이 계정의
// provider를 "email"로 적으므로 표시를 먼저 본다(app_metadata는 서버 키로만 쓸 수 있어 사용자가 꾸밀 수 없다).
// Apple은 Supabase가 provider "apple"로 적는다.
export function loginProviderOf(user: AuthUserLike | null | undefined): LoginProvider | null {
  const meta = user?.app_metadata;
  if (meta?.login === "kakao") return "kakao";
  const p = meta?.provider;
  return p === "kakao" || p === "apple" ? p : null;
}

export function loginProviderLabel(user: AuthUserLike | null | undefined): string | null {
  const p = loginProviderOf(user);
  return p === "kakao" ? "카카오" : p === "apple" ? "Apple" : null;
}

// 이름 칸 최대 길이 — 동의 화면 입력창(maxLength)과 같다.
export const NAME_MAX = 20;

// 계정 정보(user_metadata)에서 이름으로 쓸 칸. 카카오 닉네임은 서버(?op=kakao-session)가 name·nickname에,
// Apple 이름은 auth.ts가 full_name에 담는다. 나머지는 다른 로그인 수단이 쓰는 칸이다. 앞에서부터 처음 찾은 값을 쓴다.
const NAME_KEYS = ["name", "full_name", "nickname", "preferred_username", "user_name"] as const;

function clean(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, NAME_MAX) : "";
}

// 동의 화면 이름 칸에 미리 채울 값. Apple은 이름을 처음 로그인할 때 한 번만 주므로
// 그 값이 있으면 먼저 쓴다. 아무것도 없으면 빈 문자열 — 사용자가 적는다.
export function displayNameFrom(user: AuthUserLike | null | undefined, appleFullName?: string | null): string {
  const apple = clean(appleFullName);
  if (apple) return apple;
  const meta = user?.user_metadata ?? {};
  for (const k of NAME_KEYS) {
    const v = clean(meta[k]);
    if (v) return v;
  }
  return "";
}

// Apple이 주는 이름 조각을 한 줄로. 한글 이름이면 성+이름을 붙여 쓰고(홍길동),
// 아니면 이름 성 순서로 띄어 쓴다(John Appleseed).
const HANGUL = /^[가-힣ㄱ-ㆎ]+$/;
export function formatAppleFullName(
  n: { givenName?: string | null; familyName?: string | null } | null | undefined,
): string {
  const given = (n?.givenName ?? "").trim();
  const family = (n?.familyName ?? "").trim();
  if (!given && !family) return "";
  if (HANGUL.test(given + family)) return `${family}${given}`;
  return [given, family].filter(Boolean).join(" ");
}

// Apple 로그인 nonce — 무작위 바이트를 16진수 문자열로.
export function bytesToHex(bytes: ArrayLike<number>): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += (bytes[i] & 0xff).toString(16).padStart(2, "0");
  return s;
}

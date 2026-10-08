// 로그인 보조 — 순수 로직 (RN/네트워크 의존 없음, jest 대상).
// 브라우저·Supabase 호출은 auth.ts에 있고, 여기에는 그 사이에서 값을 읽고 고르는 일만 둔다.

// ── 로그인 창에서 앱으로 돌아온 주소 읽기 ──────────────────────────────────
// 성공: modubokyak://auth-callback?code=...
// 실패: modubokyak://auth-callback?error=access_denied&error_description=...
// (Supabase가 오류를 # 뒤에 붙여 보낼 때도 있어 둘 다 읽는다.)
export type AuthCallback =
  | { kind: "code"; code: string }
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
  if (code) return { kind: "code", code };
  return { kind: "none" };
}

// 동의 화면에서 사용자가 "취소"를 고른 것인지 — 이건 실패 안내 없이 조용히 넘긴다.
export function isUserCanceled(cb: AuthCallback): boolean {
  return cb.kind === "error" && cb.error === "access_denied";
}

// ── 로그인 계정에서 이름·로그인 수단 읽기 ───────────────────────────────────
// supabase-js의 User를 그대로 받되, 여기서 쓰는 칸만 적어 순수 로직으로 남긴다.
export type AuthUserLike = {
  app_metadata?: { provider?: unknown; providers?: unknown } | null;
  user_metadata?: Record<string, unknown> | null;
};

export type LoginProvider = "kakao" | "apple";

export function loginProviderOf(user: AuthUserLike | null | undefined): LoginProvider | null {
  const p = user?.app_metadata?.provider;
  return p === "kakao" || p === "apple" ? p : null;
}

export function loginProviderLabel(user: AuthUserLike | null | undefined): string | null {
  const p = loginProviderOf(user);
  return p === "kakao" ? "카카오" : p === "apple" ? "Apple" : null;
}

// 이름 칸 최대 길이 — 동의 화면 입력창(maxLength)과 같다.
export const NAME_MAX = 20;

// 카카오가 주는 닉네임은 Supabase가 여러 칸에 나눠 담는다. 앞에서부터 처음 찾은 값을 쓴다.
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

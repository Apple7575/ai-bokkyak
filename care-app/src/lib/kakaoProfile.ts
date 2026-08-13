// 카카오 로그인 결과에서 필요한 값만 뽑는 순수 로직 (RN/네트워크 의존 없음, jest 대상).
//
// Supabase가 돌려주는 user.user_metadata는 공급자마다 키가 다르고, 카카오도 동의항목
// 설정에 따라 어떤 키가 올지 달라진다. 화면에서 옵셔널 체이닝을 늘어놓는 대신
// 여기서 한 번에 정리한다.

export type KakaoProfile = {
  /** 카카오 닉네임. 못 찾으면 null — 가입 화면에서 직접 입력받는다. */
  nickname: string | null;
};

// 이름으로 쓸 수 없는 값들. 카카오가 닉네임 미동의 시 이런 값을 채워 보낼 때가 있다.
function usableName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (s === "") return null;
  // 이메일이 닉네임 자리에 오면 이름으로 쓰지 않는다(어르신 화면에 이메일이 뜨면 이상하다).
  if (s.includes("@")) return null;
  return s;
}

// user_metadata에서 닉네임을 찾는다. 카카오/Supabase 버전에 따라 키가 달라
// 알려진 후보를 순서대로 본다.
export function parseKakaoProfile(meta: unknown): KakaoProfile {
  if (!meta || typeof meta !== "object") return { nickname: null };
  const m = meta as Record<string, unknown>;

  // 1) 평평한 키들
  for (const k of ["name", "nickname", "user_name", "full_name", "preferred_username"]) {
    const v = usableName(m[k]);
    if (v) return { nickname: v };
  }
  // 2) 카카오 원본 구조: kakao_account.profile.nickname
  const acc = m["kakao_account"];
  if (acc && typeof acc === "object") {
    const prof = (acc as Record<string, unknown>)["profile"];
    if (prof && typeof prof === "object") {
      const v = usableName((prof as Record<string, unknown>)["nickname"]);
      if (v) return { nickname: v };
    }
  }
  // 3) properties.nickname
  const props = m["properties"];
  if (props && typeof props === "object") {
    const v = usableName((props as Record<string, unknown>)["nickname"]);
    if (v) return { nickname: v };
  }
  return { nickname: null };
}

// 딥링크로 돌아온 URL에서 PKCE 인가 코드를 뽑는다.
// 성공: modubokyak://auth-callback?code=...
// 실패: modubokyak://auth-callback?error=access_denied&error_description=...
export type CallbackResult =
  | { kind: "code"; code: string }
  | { kind: "error"; message: string }
  | { kind: "none" };

export function parseAuthCallback(url: string): CallbackResult {
  if (typeof url !== "string" || url === "") return { kind: "none" };
  // RN의 URL 파서가 커스텀 스킴에서 흔들려 쿼리 문자열을 직접 읽는다.
  // 해시(#) 뒤에 오는 경우(implicit)도 함께 훑는다.
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
  const err = params.get("error_description") || params.get("error");
  if (err) return { kind: "error", message: err };
  const code = params.get("code");
  if (code) return { kind: "code", code };
  return { kind: "none" };
}

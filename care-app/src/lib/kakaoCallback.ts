// 카카오 로그인 콜백 파싱 — 순수 로직 (RN/네트워크 의존 없음, jest 대상).
//
// 닉네임 추출은 여기 없다. 엣지 함수가 서버에서 카카오 API를 호출해 회원번호와
// 닉네임만 정리해서 돌려주므로, 앱은 인가 코드만 꺼내면 된다.

// 성공: modubokyak://kakao-callback?code=...
// 실패: modubokyak://kakao-callback?error=access_denied&error_description=...
export type CallbackResult =
  | { kind: "code"; code: string }
  | { kind: "error"; message: string }
  | { kind: "none" };

export function parseAuthCallback(url: string): CallbackResult {
  if (typeof url !== "string" || url === "") return { kind: "none" };
  // RN의 URL 파서가 커스텀 스킴에서 흔들려 쿼리 문자열을 직접 읽는다.
  // 해시(#) 뒤에 오는 경우도 함께 훑는다.
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

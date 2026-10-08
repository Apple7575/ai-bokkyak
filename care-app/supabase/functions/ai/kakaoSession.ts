// 카카오 세션 다리(?op=kakao-session)의 순수 로직 — Deno·네트워크 의존 없음.
// 엣지 함수(index.ts)가 import하고, 앱 쪽 jest가 같은 파일을 직접 테스트한다
// (src/__tests__/kakaoSessionEdge.test.ts). 그래서 여기서는 아무것도 import하지 않는다.

// 카카오 회원의 Supabase 계정 이메일 칸에 넣는 가짜 주소의 도메인.
// 메일 서버가 없는 우리 도메인의 하위 도메인이다 — 이 주소로는 메일이 오가지 않고, 우리도 보내지 않는다
// (계정 생성은 email_confirm: true, 세션은 generateLink로 "만들기만" 한다). 남의 도메인을 쓰면 그 주인이
// 메일을 받을 수 있으므로 반드시 우리 도메인이어야 한다. ⚠️ 이 하위 도메인에 MX·메일 수신을 설정하지 말 것.
// ⚠️ 바꾸면 기존 카카오 회원이 모두 새 계정으로 갈라진다.
export const KAKAO_EMAIL_DOMAIN = "kakao.modubokyak.com";

// 카카오 회원번호는 숫자다. 다른 값이면 주소를 만들지 않는다(이상한 문자가 이메일에 섞이지 않게).
export function isKakaoMemberId(id: unknown): id is string {
  return typeof id === "string" && /^\d{1,20}$/.test(id);
}

// 회원번호 → 늘 같은 가짜 이메일. 같은 카카오 회원은 언제나 같은 Supabase 계정으로 간다.
export function kakaoSyntheticEmail(kakaoId: string): string {
  if (!isKakaoMemberId(kakaoId)) throw new Error("invalid kakao id");
  return `kakao-${kakaoId}@${KAKAO_EMAIL_DOMAIN}`;
}

// /v2/user/me 응답에서 닉네임만 꺼낸다. 이메일·프로필 사진은 요청하지도 읽지도 않는다.
export function kakaoNickname(me: unknown): string {
  const m = (me ?? {}) as {
    properties?: { nickname?: unknown };
    kakao_account?: { profile?: { nickname?: unknown } };
  };
  const a = m.properties?.nickname;
  if (typeof a === "string" && a) return a;
  const b = m.kakao_account?.profile?.nickname;
  return typeof b === "string" ? b : "";
}

// admin.createUser가 "이미 있는 이메일"로 실패했나 — 두 번째 로그인부터는 늘 이렇다(정상).
// 새 GoTrue는 code "email_exists", 옛 버전은 422 + 문구로만 알려 준다.
export function isEmailTaken(err: { code?: unknown; status?: unknown; message?: unknown } | null | undefined): boolean {
  if (!err) return false;
  if (err.code === "email_exists") return true;
  return err.status === 422 && typeof err.message === "string" && /already (been )?registered|already exists/i.test(err.message);
}

// 이 계정이 우리 서버가 이 카카오 회원에게 만들어 준 계정인가.
// app_metadata는 서버 키(service role)로만 쓸 수 있어 사용자가 꾸밀 수 없다. 누가 공개 가입 API로
// 같은 가짜 주소를 먼저 등록해 뒀다면(비밀번호를 걸어 둔 채) 표시가 없다 — 그 계정에는 세션을 만들지 않는다.
export function isKakaoAccountOf(
  user: { app_metadata?: Record<string, unknown> | null } | null | undefined,
  kakaoId: string,
): boolean {
  const meta = user?.app_metadata ?? {};
  return meta.login === "kakao" && String(meta.kakao_id ?? "") === kakaoId;
}

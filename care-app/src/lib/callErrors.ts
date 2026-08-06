// AI 건강전화 오류 안내 문구 — 순수 로직 (RN/네트워크 의존 없음, jest 단위 테스트 대상).
//
// 상태 코드만으로는 어르신도 개발자도 무엇을 해야 할지 알 수 없다("오류 429").
// OpenAI 응답 본문의 error.code까지 보고 원인별로 안내를 나눈다.

// 응답 본문(JSON 문자열)에서 error.code 또는 error.type을 꺼낸다. 실패하면 "".
function errorCodeOf(body: string): string {
  try {
    const j = JSON.parse(body) as { error?: { code?: unknown; type?: unknown } };
    const c = j.error?.code ?? j.error?.type;
    return typeof c === "string" ? c : "";
  } catch {
    return "";
  }
}

// 크레딧 소진은 429로 오지만 "잠시 후 다시"가 통하지 않는다 — 결제 전에는 영영 안 된다.
// 순간 과부하(rate limit)와 반드시 구분해야 안내가 거짓말이 되지 않는다.
function isQuotaExhausted(code: string): boolean {
  return code === "credit_balance_exhausted" || code === "insufficient_quota";
}

// OpenAI Realtime SDP 요청(통화 열기) 실패 → 사용자 안내 문구.
export function sdpErrorMessage(status: number, body: string): string {
  const code = errorCodeOf(body);
  if (status === 429) {
    return isQuotaExhausted(code)
      ? "AI 통화를 이용할 수 없어요. 관리자에게 문의해 주세요. (사용량 소진)"
      : "지금 통화가 몰리고 있어요. 잠시 후 다시 걸어 주세요.";
  }
  if (status === 401 || status === 403) {
    return "통화 서버 인증에 실패했어요. 관리자에게 문의해 주세요.";
  }
  if (status >= 500) {
    return "통화 서버에 문제가 있어요. 잠시 후 다시 걸어 주세요.";
  }
  // 원인을 특정할 수 없으면 진단용으로 코드를 남긴다.
  return `통화 서버 연결에 실패했어요. (오류 ${status}${code ? ` ${code}` : ""})`;
}

// 임시 키 발급(Edge Function) 실패 → 사용자 안내 문구.
// 서버는 OpenAI 오류를 { error, detail } 로 감싸 502로 돌려주므로, detail 안에
// 같은 error.code가 들어 있을 수 있다. 크레딧 소진이면 SDP 단계와 같은 안내로 통일한다.
export function tokenErrorMessage(status: number, body: string): string {
  let inner = "";
  try {
    const j = JSON.parse(body) as { detail?: unknown };
    if (j.detail !== undefined) inner = JSON.stringify(j.detail);
  } catch {}
  const code = errorCodeOf(inner) || errorCodeOf(body);
  if (isQuotaExhausted(code)) {
    return "AI 통화를 이용할 수 없어요. 관리자에게 문의해 주세요. (사용량 소진)";
  }
  return `통화 준비에 실패했어요. (서버 오류 ${status})`;
}

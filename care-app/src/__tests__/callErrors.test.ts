import { sdpErrorMessage, tokenErrorMessage } from "../lib/callErrors";

// 실제로 받은 응답 본문 (2026-08-04 재현)
const QUOTA_BODY = JSON.stringify({
  error: {
    message: "You have no credits remaining. Add credits to continue using the API at ...",
    type: "insufficient_quota",
    code: "credit_balance_exhausted",
    param: "",
  },
});

describe("sdpErrorMessage", () => {
  it("크레딧 소진 429는 '잠시 후 다시'라고 하지 않는다", () => {
    const msg = sdpErrorMessage(429, QUOTA_BODY);
    expect(msg).toContain("사용량 소진");
    // 결제 전에는 영영 안 되므로 기다리라는 안내는 거짓말이 된다.
    expect(msg).not.toContain("잠시 후");
  });

  it("insufficient_quota가 type에만 있어도 같은 안내", () => {
    const body = JSON.stringify({ error: { type: "insufficient_quota" } });
    expect(sdpErrorMessage(429, body)).toContain("사용량 소진");
  });

  it("일반 429(과부하)는 다시 걸어보라고 안내", () => {
    const body = JSON.stringify({ error: { code: "rate_limit_exceeded" } });
    const msg = sdpErrorMessage(429, body);
    expect(msg).toContain("잠시 후");
    expect(msg).not.toContain("사용량 소진");
  });

  it("본문이 비었거나 깨져도 429는 과부하로 안내(크레딧 소진으로 단정하지 않음)", () => {
    expect(sdpErrorMessage(429, "")).toContain("잠시 후");
    expect(sdpErrorMessage(429, "not json")).toContain("잠시 후");
  });

  it("인증 실패 / 서버 장애 분기", () => {
    expect(sdpErrorMessage(401, "")).toContain("인증");
    expect(sdpErrorMessage(403, "")).toContain("인증");
    expect(sdpErrorMessage(500, "")).toContain("서버에 문제");
    expect(sdpErrorMessage(503, "")).toContain("서버에 문제");
  });

  it("분류 못 하는 상태 코드는 진단용으로 코드까지 남긴다", () => {
    expect(sdpErrorMessage(400, "")).toBe("통화 서버 연결에 실패했어요. (오류 400)");
    expect(sdpErrorMessage(400, JSON.stringify({ error: { code: "invalid_sdp" } })))
      .toBe("통화 서버 연결에 실패했어요. (오류 400 invalid_sdp)");
  });
});

describe("tokenErrorMessage", () => {
  it("서버가 감싼 detail 안의 크레딧 소진을 찾아낸다", () => {
    // Edge Function은 OpenAI 오류를 { error, detail }로 감싸 502로 돌려준다.
    const wrapped = JSON.stringify({
      error: "realtime token failed",
      detail: JSON.parse(QUOTA_BODY),
    });
    expect(tokenErrorMessage(502, wrapped)).toContain("사용량 소진");
  });

  it("그 외에는 상태 코드를 남긴 기본 안내", () => {
    expect(tokenErrorMessage(502, "")).toBe("통화 준비에 실패했어요. (서버 오류 502)");
    expect(tokenErrorMessage(500, "not json")).toBe("통화 준비에 실패했어요. (서버 오류 500)");
  });
});

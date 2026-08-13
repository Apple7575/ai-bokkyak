import { parseAuthCallback } from "../lib/kakaoCallback";

describe("parseAuthCallback", () => {
  it("성공 콜백에서 code를 꺼낸다", () => {
    expect(parseAuthCallback("modubokyak://kakao-callback?code=abc123"))
      .toEqual({ kind: "code", code: "abc123" });
  });

  it("해시로 와도 읽는다", () => {
    expect(parseAuthCallback("modubokyak://kakao-callback#code=abc123"))
      .toEqual({ kind: "code", code: "abc123" });
  });

  it("취소·오류는 메시지로", () => {
    const r = parseAuthCallback("modubokyak://kakao-callback?error=access_denied&error_description=사용자%20취소");
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.message).toBe("사용자 취소");
  });

  it("error만 있으면 그 값을 쓴다", () => {
    expect(parseAuthCallback("modubokyak://kakao-callback?error=server_error"))
      .toEqual({ kind: "error", message: "server_error" });
  });

  it("code도 error도 없으면 none", () => {
    expect(parseAuthCallback("modubokyak://kakao-callback").kind).toBe("none");
    expect(parseAuthCallback("").kind).toBe("none");
    expect(parseAuthCallback("modubokyak://kakao-callback?state=xyz").kind).toBe("none");
  });

  it("URL 인코딩된 code를 되돌린다", () => {
    expect(parseAuthCallback("modubokyak://kakao-callback?code=a%2Bb%3Dc"))
      .toEqual({ kind: "code", code: "a+b=c" });
  });

  it("여러 파라미터 중에서 code를 찾는다", () => {
    expect(parseAuthCallback("modubokyak://kakao-callback?state=xyz&code=abc&foo=bar"))
      .toEqual({ kind: "code", code: "abc" });
  });
});

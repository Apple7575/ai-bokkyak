import { parseKakaoProfile, parseAuthCallback } from "../lib/kakaoProfile";

describe("parseKakaoProfile", () => {
  it("평평한 키에서 닉네임을 찾는다", () => {
    expect(parseKakaoProfile({ name: "김복약" }).nickname).toBe("김복약");
    expect(parseKakaoProfile({ nickname: "김복약" }).nickname).toBe("김복약");
    expect(parseKakaoProfile({ full_name: "김복약" }).nickname).toBe("김복약");
  });

  it("카카오 원본 구조에서도 찾는다", () => {
    expect(parseKakaoProfile({ kakao_account: { profile: { nickname: "김복약" } } }).nickname).toBe("김복약");
    expect(parseKakaoProfile({ properties: { nickname: "김복약" } }).nickname).toBe("김복약");
  });

  it("이메일은 이름으로 쓰지 않는다", () => {
    // 어르신 화면에 이메일이 이름으로 뜨면 이상하다.
    expect(parseKakaoProfile({ name: "a@b.com" }).nickname).toBeNull();
  });

  it("빈 값·공백·비객체는 null", () => {
    expect(parseKakaoProfile({ name: "  " }).nickname).toBeNull();
    expect(parseKakaoProfile({}).nickname).toBeNull();
    expect(parseKakaoProfile(null).nickname).toBeNull();
    expect(parseKakaoProfile("문자열").nickname).toBeNull();
  });

  it("앞뒤 공백은 다듬는다", () => {
    expect(parseKakaoProfile({ name: "  김복약 " }).nickname).toBe("김복약");
  });
});

describe("parseAuthCallback", () => {
  it("성공 콜백에서 code를 꺼낸다", () => {
    expect(parseAuthCallback("modubokyak://auth-callback?code=abc123"))
      .toEqual({ kind: "code", code: "abc123" });
  });

  it("해시로 와도 읽는다", () => {
    expect(parseAuthCallback("modubokyak://auth-callback#code=abc123"))
      .toEqual({ kind: "code", code: "abc123" });
  });

  it("취소·오류는 메시지로", () => {
    const r = parseAuthCallback("modubokyak://auth-callback?error=access_denied&error_description=사용자%20취소");
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.message).toBe("사용자 취소");
  });

  it("error만 있으면 그 값을 쓴다", () => {
    const r = parseAuthCallback("modubokyak://auth-callback?error=server_error");
    expect(r).toEqual({ kind: "error", message: "server_error" });
  });

  it("code도 error도 없으면 none", () => {
    expect(parseAuthCallback("modubokyak://auth-callback").kind).toBe("none");
    expect(parseAuthCallback("").kind).toBe("none");
    expect(parseAuthCallback("modubokyak://auth-callback?state=xyz").kind).toBe("none");
  });

  it("URL 인코딩된 code를 되돌린다", () => {
    const r = parseAuthCallback("modubokyak://auth-callback?code=a%2Bb%3Dc");
    expect(r).toEqual({ kind: "code", code: "a+b=c" });
  });
});

import {
  parseAuthCallback, isUserCanceled, displayNameFrom, loginProviderOf, loginProviderLabel,
  formatAppleFullName, bytesToHex, NAME_MAX,
} from "../lib/authHelpers";

describe("parseAuthCallback — 로그인 창에서 돌아온 주소", () => {
  it("성공 주소에서 code를 꺼낸다", () => {
    expect(parseAuthCallback("modubokyak://auth-callback?code=abc123")).toEqual({ kind: "code", code: "abc123" });
  });

  it("# 뒤로 와도 읽는다", () => {
    expect(parseAuthCallback("modubokyak://auth-callback#code=abc123")).toEqual({ kind: "code", code: "abc123" });
  });

  it("오류는 오류 코드와 설명으로", () => {
    expect(parseAuthCallback("modubokyak://auth-callback?error=access_denied&error_description=User%20denied%20access"))
      .toEqual({ kind: "error", error: "access_denied", message: "User denied access" });
  });

  it("Supabase가 # 뒤에 붙인 오류도 읽는다(+는 공백)", () => {
    expect(parseAuthCallback("modubokyak://auth-callback#error=server_error&error_code=bad_oauth_state&error_description=OAuth+state+missing"))
      .toEqual({ kind: "error", error: "server_error", message: "OAuth state missing" });
  });

  it("설명만 있어도 오류로 본다", () => {
    expect(parseAuthCallback("modubokyak://auth-callback?error_description=boom"))
      .toEqual({ kind: "error", error: "unknown", message: "boom" });
  });

  it("code와 오류가 함께 오면 오류가 먼저다", () => {
    expect(parseAuthCallback("modubokyak://auth-callback?code=abc&error=access_denied").kind).toBe("error");
  });

  it("code도 오류도 없으면 none", () => {
    expect(parseAuthCallback("modubokyak://auth-callback").kind).toBe("none");
    expect(parseAuthCallback("").kind).toBe("none");
    expect(parseAuthCallback("modubokyak://auth-callback?state=xyz").kind).toBe("none");
  });

  it("URL 인코딩된 code를 되돌리고, 여러 파라미터 중에서 찾는다", () => {
    expect(parseAuthCallback("modubokyak://auth-callback?code=a%2Bb%3Dc")).toEqual({ kind: "code", code: "a+b=c" });
    expect(parseAuthCallback("modubokyak://auth-callback?state=xyz&code=abc&foo=bar")).toEqual({ kind: "code", code: "abc" });
  });

  it("깨진 인코딩이어도 죽지 않는다", () => {
    expect(parseAuthCallback("modubokyak://auth-callback?code=%E0%A4%A")).toEqual({ kind: "code", code: "%E0%A4%A" });
  });
});

describe("isUserCanceled — 동의 화면에서 취소한 것만 조용히", () => {
  it("access_denied만 취소로 본다", () => {
    expect(isUserCanceled(parseAuthCallback("x://y?error=access_denied"))).toBe(true);
    expect(isUserCanceled(parseAuthCallback("x://y?error=server_error"))).toBe(false);
    expect(isUserCanceled(parseAuthCallback("x://y?code=abc"))).toBe(false);
    expect(isUserCanceled({ kind: "none" })).toBe(false);
  });
});

describe("displayNameFrom — 동의 화면 이름 칸에 미리 채울 값", () => {
  it("Apple이 준 이름이 있으면 먼저 쓴다", () => {
    expect(displayNameFrom({ user_metadata: { name: "카카오닉" } }, "홍길동")).toBe("홍길동");
  });

  it("user_metadata를 name → full_name → nickname → preferred_username → user_name 순서로 찾는다", () => {
    expect(displayNameFrom({ user_metadata: { full_name: "B", nickname: "C", name: "A" } })).toBe("A");
    expect(displayNameFrom({ user_metadata: { nickname: "C", full_name: "B" } })).toBe("B");
    expect(displayNameFrom({ user_metadata: { preferred_username: "D", nickname: "C" } })).toBe("C");
    expect(displayNameFrom({ user_metadata: { user_name: "E", preferred_username: "D" } })).toBe("D");
    expect(displayNameFrom({ user_metadata: { user_name: "E" } })).toBe("E");
  });

  it("빈 값·공백·문자열이 아닌 값은 건너뛴다", () => {
    expect(displayNameFrom({ user_metadata: { name: "   ", full_name: 12, nickname: " 영희 " } })).toBe("영희");
    expect(displayNameFrom({ user_metadata: { name: "x" } }, "  ")).toBe("x");
  });

  it("아무것도 없으면 빈 문자열", () => {
    expect(displayNameFrom(null)).toBe("");
    expect(displayNameFrom({})).toBe("");
    expect(displayNameFrom({ user_metadata: { email: "a@b.c" } })).toBe("");
  });

  it("이름 칸 길이(20자)를 넘으면 자른다", () => {
    const long = "가".repeat(30);
    expect(displayNameFrom({ user_metadata: { name: long } })).toHaveLength(NAME_MAX);
  });
});

describe("loginProviderOf / loginProviderLabel", () => {
  it("app_metadata.provider로 카카오·Apple을 가린다", () => {
    expect(loginProviderOf({ app_metadata: { provider: "kakao" } })).toBe("kakao");
    expect(loginProviderLabel({ app_metadata: { provider: "kakao" } })).toBe("카카오");
    expect(loginProviderLabel({ app_metadata: { provider: "apple" } })).toBe("Apple");
  });

  it("모르는 수단·로그인 안 함은 null", () => {
    expect(loginProviderLabel({ app_metadata: { provider: "email" } })).toBeNull();
    expect(loginProviderLabel(null)).toBeNull();
    expect(loginProviderOf({})).toBeNull();
  });
});

describe("formatAppleFullName", () => {
  it("한글 이름은 성+이름을 붙여 쓴다", () => {
    expect(formatAppleFullName({ givenName: "길동", familyName: "홍" })).toBe("홍길동");
  });
  it("영문 이름은 이름 성 순서로 띄어 쓴다", () => {
    expect(formatAppleFullName({ givenName: "John", familyName: "Appleseed" })).toBe("John Appleseed");
  });
  it("한쪽만 있으면 그것만", () => {
    expect(formatAppleFullName({ givenName: "길동", familyName: null })).toBe("길동");
    expect(formatAppleFullName({ givenName: null, familyName: "Kim" })).toBe("Kim");
  });
  it("없으면 빈 문자열(Apple은 두 번째 로그인부터 이름을 주지 않는다)", () => {
    expect(formatAppleFullName(null)).toBe("");
    expect(formatAppleFullName({ givenName: "", familyName: " " })).toBe("");
  });
});

describe("bytesToHex", () => {
  it("바이트마다 두 자리 16진수", () => {
    expect(bytesToHex([0, 15, 16, 255])).toBe("000f10ff");
    expect(bytesToHex(new Uint8Array(32))).toHaveLength(64);
  });
});

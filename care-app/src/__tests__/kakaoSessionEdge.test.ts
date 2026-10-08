// 엣지 함수 ?op=kakao-session의 순수 로직(supabase/functions/ai/kakaoSession.ts).
// 엣지 함수는 Deno라 여기서 돌릴 수 없지만, 이 파일은 아무것도 import하지 않아 jest로 그대로 검사한다.
import {
  KAKAO_EMAIL_DOMAIN, isKakaoMemberId, kakaoSyntheticEmail, kakaoNickname, isEmailTaken, isKakaoAccountOf,
} from "../../supabase/functions/ai/kakaoSession";

describe("kakaoSyntheticEmail — 카카오 회원번호 → 늘 같은 가짜 주소", () => {
  it("우리 하위 도메인의 주소를 만든다", () => {
    expect(kakaoSyntheticEmail("1234567890")).toBe("kakao-1234567890@kakao.modubokyak.com");
    expect(KAKAO_EMAIL_DOMAIN).toBe("kakao.modubokyak.com");
  });

  it("같은 번호는 언제나 같은 주소", () => {
    expect(kakaoSyntheticEmail("42")).toBe(kakaoSyntheticEmail("42"));
  });

  it("숫자가 아닌 회원번호로는 만들지 않는다", () => {
    expect(() => kakaoSyntheticEmail("")).toThrow();
    expect(() => kakaoSyntheticEmail("12a")).toThrow();
    expect(() => kakaoSyntheticEmail("1@evil.com")).toThrow();
    expect(() => kakaoSyntheticEmail("1".repeat(21))).toThrow();
  });
});

describe("isKakaoMemberId", () => {
  it("숫자 문자열만", () => {
    expect(isKakaoMemberId("3912345678")).toBe(true);
    expect(isKakaoMemberId(3912345678)).toBe(false);
    expect(isKakaoMemberId("")).toBe(false);
    expect(isKakaoMemberId(" 1")).toBe(false);
    expect(isKakaoMemberId(null)).toBe(false);
  });
});

describe("kakaoNickname — /v2/user/me에서 닉네임만", () => {
  it("properties.nickname을 먼저, 없으면 kakao_account.profile.nickname", () => {
    expect(kakaoNickname({ id: 1, properties: { nickname: "영희" } })).toBe("영희");
    expect(kakaoNickname({ id: 1, kakao_account: { profile: { nickname: "철수" } } })).toBe("철수");
    expect(kakaoNickname({ id: 1, properties: { nickname: "" }, kakao_account: { profile: { nickname: "철수" } } })).toBe("철수");
  });

  it("없거나 이상한 값이면 빈 문자열", () => {
    expect(kakaoNickname({ id: 1 })).toBe("");
    expect(kakaoNickname(null)).toBe("");
    expect(kakaoNickname({ properties: { nickname: 7 } })).toBe("");
  });
});

describe("isEmailTaken — 두 번째 로그인부터의 '이미 있음'은 정상", () => {
  it("새 GoTrue의 email_exists, 옛 GoTrue의 422 문구", () => {
    expect(isEmailTaken({ code: "email_exists", status: 422, message: "x" })).toBe(true);
    expect(isEmailTaken({ status: 422, message: "A user with this email address has already been registered" })).toBe(true);
  });

  it("다른 실패는 '이미 있음'이 아니다", () => {
    expect(isEmailTaken(null)).toBe(false);
    expect(isEmailTaken({ status: 500, message: "Database error creating new user" })).toBe(false);
    expect(isEmailTaken({ status: 422, message: "Unable to validate email address: invalid format" })).toBe(false);
    expect(isEmailTaken({ code: "weak_password", status: 422, message: "x" })).toBe(false);
  });
});

describe("isKakaoAccountOf — 우리 서버가 이 회원에게 만든 계정인가", () => {
  it("app_metadata의 카카오 표시와 회원번호가 맞아야 한다", () => {
    expect(isKakaoAccountOf({ app_metadata: { provider: "email", login: "kakao", kakao_id: "42" } }, "42")).toBe(true);
  });

  it("표시가 없거나(공개 가입으로 먼저 만든 계정) 번호가 다르면 아니다", () => {
    expect(isKakaoAccountOf({ app_metadata: { provider: "email", providers: ["email"] } }, "42")).toBe(false);
    expect(isKakaoAccountOf({ app_metadata: { login: "kakao", kakao_id: "43" } }, "42")).toBe(false);
    expect(isKakaoAccountOf({ app_metadata: { login: "apple", kakao_id: "42" } }, "42")).toBe(false);
    expect(isKakaoAccountOf({ app_metadata: null }, "42")).toBe(false);
    expect(isKakaoAccountOf(null, "42")).toBe(false);
  });
});

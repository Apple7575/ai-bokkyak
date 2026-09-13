// restoreWithKakao는 네트워크(카카오 로그인·Supabase)라 여기서 돌리지 않는다.
// 사용자에게 보이는 문구만 고정한다.
jest.mock("../lib/supabase", () => ({ supabase: { from: jest.fn() } }));
jest.mock("../lib/kakaoAuth", () => ({ signInWithKakao: jest.fn() }));
// storage는 AsyncStorage(네이티브 모듈)라 jest에서 그대로 못 쓴다.
jest.mock("../lib/storage", () => ({ setPatient: jest.fn(), setPatientName: jest.fn(), setOnboarded: jest.fn() }));

import { RESTORE_NOT_FOUND } from "../lib/kakaoAccount";

describe("kakaoAccount", () => {
  it("복구 실패 문구는 '이름으로 시작'을 안내한다", () => {
    expect(RESTORE_NOT_FOUND).toContain("이름으로 시작");
  });
});

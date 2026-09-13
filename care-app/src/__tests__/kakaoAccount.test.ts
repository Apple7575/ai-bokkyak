// restoreWithKakao·linkKakao는 네트워크(카카오 로그인·Supabase)라 여기서 돌리지 않는다.
// 사용자에게 보이는 문구만 고정한다.
jest.mock("../lib/supabase", () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
jest.mock("../lib/kakaoAuth", () => ({ signInWithKakao: jest.fn() }));
// storage는 AsyncStorage(네이티브 모듈)라 jest에서 그대로 못 쓴다.
jest.mock("../lib/storage", () => ({ setPatient: jest.fn(), setPatientName: jest.fn(), setOnboarded: jest.fn() }));

import { RESTORE_NOT_FOUND, linkResultMessage } from "../lib/kakaoAccount";

describe("kakaoAccount", () => {
  it("복구 실패 문구는 '이름으로 시작'을 안내한다", () => {
    expect(RESTORE_NOT_FOUND).toContain("이름으로 시작");
  });

  it("linkResultMessage — 네 가지 실패 이유마다 사용자 문구가 있다", () => {
    expect(linkResultMessage("not_found")).toContain("앱을 다시 시작");
    expect(linkResultMessage("already_linked")).toContain("이미 다른 카카오 계정");
    expect(linkResultMessage("taken")).toContain("카카오로 불러오기");
    expect(linkResultMessage("network")).toContain("인터넷 연결을 확인");
  });
});

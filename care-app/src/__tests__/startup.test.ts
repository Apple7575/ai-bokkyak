// 시작할 때 로그인 상태 판정(navigation/startup.ts) — 네이티브·네트워크 모듈은 흉내만 낸다.
const mockGetPatientId = jest.fn<Promise<string | null>, []>();
const mockGetSession = jest.fn();
const mockHasStoredSession = jest.fn<Promise<boolean>, []>();
const mockFindMyPatient = jest.fn();
const mockAdoptPatient = jest.fn();
const mockClearLocalSession = jest.fn();
const mockResync = jest.fn(() => Promise.resolve());

jest.mock("../lib/storage", () => ({ getPatientId: () => mockGetPatientId() }));
jest.mock("../lib/supabase", () => ({
  supabase: { auth: { getSession: () => mockGetSession() } },
  hasStoredSession: () => mockHasStoredSession(),
}));
jest.mock("../lib/account", () => ({
  findMyPatient: () => mockFindMyPatient(),
  adoptPatient: (row: unknown) => mockAdoptPatient(row),
  clearLocalSession: () => mockClearLocalSession(),
}));
jest.mock("../lib/alarmSync", () => ({ resyncAllAlarms: () => mockResync() }));

import { resolveSignedIn } from "../navigation/startup";

const session = { user: { id: "u1" } };
const withSession = (s: unknown) => mockGetSession.mockResolvedValue({ data: { session: s }, error: null });

beforeEach(() => {
  jest.clearAllMocks();
  mockHasStoredSession.mockResolvedValue(false);
  mockFindMyPatient.mockResolvedValue(null);
});

describe("resolveSignedIn", () => {
  it("처음 설치(세션·환자 id 없음) → 로그아웃, 아무것도 지우지 않는다", async () => {
    mockGetPatientId.mockResolvedValue(null);
    withSession(null);
    await expect(resolveSignedIn()).resolves.toBe(false);
    expect(mockClearLocalSession).not.toHaveBeenCalled();
  });

  it("세션 + 환자 id → 로그인(서버를 더 묻지 않는다)", async () => {
    mockGetPatientId.mockResolvedValue("p1");
    withSession(session);
    await expect(resolveSignedIn()).resolves.toBe(true);
    expect(mockFindMyPatient).not.toHaveBeenCalled();
  });

  it("세션만 있고 환자 id가 없으면 서버에서 찾아 이 기기에 앉힌다", async () => {
    mockGetPatientId.mockResolvedValue(null);
    withSession(session);
    const mine = { id: "p9", name: "홍길동", consent: { version: "2026-10-08" } };
    mockFindMyPatient.mockResolvedValue(mine);
    await expect(resolveSignedIn()).resolves.toBe(true);
    expect(mockAdoptPatient).toHaveBeenCalledWith(mine);
    expect(mockResync).toHaveBeenCalled();
  });

  it("환자는 있지만 동의 기록이 없으면(옛 빌드에서 이어 붙은 계정) 로그아웃 상태 — 로그인하면 동의 화면으로", async () => {
    mockGetPatientId.mockResolvedValue(null);
    withSession(session);
    mockFindMyPatient.mockResolvedValue({ id: "p9", name: "홍길동", consent: null });
    await expect(resolveSignedIn()).resolves.toBe(false);
    expect(mockAdoptPatient).not.toHaveBeenCalled();
  });

  it("세션은 있는데 환자가 없으면(동의 전) 로그아웃 상태", async () => {
    mockGetPatientId.mockResolvedValue(null);
    withSession(session);
    await expect(resolveSignedIn()).resolves.toBe(false);
    expect(mockAdoptPatient).not.toHaveBeenCalled();
  });

  it("세션은 있는데 내 환자 조회가 실패하면 로그아웃 상태로(로그인 화면에서 다시)", async () => {
    mockGetPatientId.mockResolvedValue(null);
    withSession(session);
    mockFindMyPatient.mockRejectedValue(new Error("network"));
    await expect(resolveSignedIn()).resolves.toBe(false);
  });

  it("옛 빌드 흔적(환자 id만, 세션 없음) → 기기 정리 후 로그아웃", async () => {
    mockGetPatientId.mockResolvedValue("legacy");
    withSession(null);
    await expect(resolveSignedIn()).resolves.toBe(false);
    expect(mockClearLocalSession).toHaveBeenCalledTimes(1);
  });

  it("인터넷이 없어 토큰 갱신이 실패해도 저장된 세션 + 환자 id면 로그인", async () => {
    mockGetPatientId.mockResolvedValue("p1");
    mockGetSession.mockResolvedValue({ data: { session: null }, error: new Error("fetch failed") });
    mockHasStoredSession.mockResolvedValue(true);
    await expect(resolveSignedIn()).resolves.toBe(true);
    expect(mockClearLocalSession).not.toHaveBeenCalled();
  });

  it("세션 확인이 멈추면 5초 뒤 저장된 세션으로 판단한다", async () => {
    jest.useFakeTimers();
    try {
      mockGetPatientId.mockResolvedValue("p1");
      mockGetSession.mockReturnValue(new Promise(() => {}));
      mockHasStoredSession.mockResolvedValue(true);
      const p = resolveSignedIn();
      await jest.advanceTimersByTimeAsync(5000);
      await expect(p).resolves.toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});

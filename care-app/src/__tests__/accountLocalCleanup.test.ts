jest.mock("@notifee/react-native", () => ({
  __esModule: true, default: { cancelAllNotifications: jest.fn(() => Promise.resolve()) },
}));
jest.mock("../lib/supabase", () => ({ supabase: { auth: { getSession: jest.fn() } } }));
jest.mock("../lib/auth", () => ({
  signOut: jest.fn(() => Promise.resolve()), hasStoredSession: jest.fn(),
}));
jest.mock("../lib/storage", () => ({
  getPatientId: jest.fn(), clearAll: jest.fn(() => Promise.resolve()),
  clearPendingAlarm: jest.fn(() => Promise.resolve()), setPatient: jest.fn(() => Promise.resolve()),
  setPatientName: jest.fn(() => Promise.resolve()), setOnboarded: jest.fn(() => Promise.resolve()),
}));
jest.mock("../lib/quickCheckDraft", () => ({ clearDraft: jest.fn(() => Promise.resolve()) }));
jest.mock("../lib/localAlarmSchedules", () => ({ clearLocalAlarmSchedules: jest.fn(() => Promise.resolve()) }));
jest.mock("../lib/intakeOutbox", () => ({ clearIntakeOutbox: jest.fn(() => Promise.resolve()) }));
jest.mock("../lib/records", () => ({ flushIntakeOutbox: jest.fn(() => Promise.resolve(0)) }));

import notifee from "@notifee/react-native";
import { signOut } from "../lib/auth";
import * as storage from "../lib/storage";
import { clearLocalAlarmSchedules } from "../lib/localAlarmSchedules";
import { clearIntakeOutbox } from "../lib/intakeOutbox";
import { flushIntakeOutbox } from "../lib/records";
import { adoptPatient, clearLocalSession } from "../lib/account";

beforeEach(() => jest.clearAllMocks());

it("다른 계정으로 전환하면 이전 알람·일정 사본·outbox를 지운 뒤 새 계정을 묶는다", async () => {
  (storage.getPatientId as jest.Mock).mockResolvedValue("patient-old");
  await adoptPatient({ id: "patient-new", name: "새 사용자" });
  expect(notifee.cancelAllNotifications).toHaveBeenCalled();
  expect(clearLocalAlarmSchedules).toHaveBeenCalled();
  expect(clearIntakeOutbox).toHaveBeenCalled();
  expect(storage.clearPendingAlarm).toHaveBeenCalled();
  expect(storage.setPatient).toHaveBeenCalledWith("patient-new");
  expect(flushIntakeOutbox).toHaveBeenCalledWith("patient-new");
});

it("로그아웃·회원 삭제의 로컬 정리는 환자 id와 건강 데이터 후 세션을 제거한다", async () => {
  await clearLocalSession();
  expect(storage.clearAll).toHaveBeenCalled();
  expect(clearLocalAlarmSchedules).toHaveBeenCalled();
  expect(clearIntakeOutbox).toHaveBeenCalled();
  expect(signOut).toHaveBeenCalled();
  expect((storage.clearAll as jest.Mock).mock.invocationCallOrder[0])
    .toBeLessThan((signOut as jest.Mock).mock.invocationCallOrder[0]);
});


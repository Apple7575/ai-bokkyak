const mockList = jest.fn();
const mockFlush = jest.fn();

jest.mock("../lib/intakeOutbox", () => ({ listIntakeOutbox: (...args: unknown[]) => mockList(...args) }));
jest.mock("../lib/records", () => ({ flushIntakeOutbox: (...args: unknown[]) => mockFlush(...args) }));

import { pendingIntakeCount, syncPendingIntakesForLogout } from "../lib/logoutSafety";

beforeEach(() => {
  mockList.mockReset();
  mockFlush.mockReset();
});

it("미전송 기록 수를 계정 범위에서 센다", async () => {
  mockList.mockResolvedValue([{ key: "a" }, { key: "b" }]);
  await expect(pendingIntakeCount("patient-a")).resolves.toBe(2);
  expect(mockList).toHaveBeenCalledWith("patient-a");
});

it("동기화 뒤 남은 기록을 다시 확인한다", async () => {
  mockList.mockResolvedValueOnce([{ key: "a" }, { key: "b" }]).mockResolvedValueOnce([{ key: "b" }]);
  mockFlush.mockResolvedValue(1);
  await expect(syncPendingIntakesForLogout("patient-a")).resolves.toEqual({ before: 2, sent: 1, remaining: 1 });
});

it("미전송 기록이 없으면 네트워크 동기화를 시작하지 않는다", async () => {
  mockList.mockResolvedValue([]);
  await expect(syncPendingIntakesForLogout("patient-a")).resolves.toEqual({ before: 0, sent: 0, remaining: 0 });
  expect(mockFlush).not.toHaveBeenCalled();
});

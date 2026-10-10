const mockValues = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockValues.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => { mockValues.set(key, value); return Promise.resolve(); }),
    removeItem: jest.fn((key: string) => { mockValues.delete(key); return Promise.resolve(); }),
  },
}));

import {
  acknowledgeIntakeMutation, clearIntakeOutbox, enqueueIntakeMutation,
  intakeOutboxKey, IntakeOutboxEntry, listIntakeOutbox,
} from "../lib/intakeOutbox";

const scheduledFor = "2026-10-10T08:00:00.000Z";
function entry(token: string, status: "completed" | "snoozed" = "completed"): IntakeOutboxEntry {
  return {
    key: intakeOutboxKey("schedule-a", scheduledFor), operation: "upsert",
    scheduleId: "schedule-a", scheduledFor, status, method: "버튼",
    respondedAt: "2026-10-10T08:00:01.000Z", token,
  };
}

beforeEach(() => mockValues.clear());

it("같은 슬롯의 반복 클릭은 최신 의도 하나만 영구 보관한다", async () => {
  await enqueueIntakeMutation("patient-a", entry("old", "completed"));
  await enqueueIntakeMutation("patient-a", entry("new", "snoozed"));
  expect(await listIntakeOutbox("patient-a")).toEqual([entry("new", "snoozed")]);
});

it("느린 이전 요청의 성공 응답이 더 최근 의도를 지우지 못한다", async () => {
  await enqueueIntakeMutation("patient-a", entry("old"));
  await enqueueIntakeMutation("patient-a", entry("new", "snoozed"));
  await acknowledgeIntakeMutation("patient-a", entry("old").key, "old");
  expect(await listIntakeOutbox("patient-a")).toEqual([entry("new", "snoozed")]);
  await acknowledgeIntakeMutation("patient-a", entry("new").key, "new");
  expect(await listIntakeOutbox("patient-a")).toEqual([]);
});

it("계정 간 outbox를 섞지 않고 로그아웃·회원 삭제 시 지운다", async () => {
  await enqueueIntakeMutation("patient-a", entry("a"));
  expect(await listIntakeOutbox("patient-b")).toEqual([]);
  await clearIntakeOutbox();
  expect(await listIntakeOutbox("patient-a")).toEqual([]);
});

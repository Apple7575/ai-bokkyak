const mockValues = new Map<string, string>();
const mockUpsert = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockValues.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => { mockValues.set(key, value); return Promise.resolve(); }),
    removeItem: jest.fn((key: string) => { mockValues.delete(key); return Promise.resolve(); }),
  },
}));

jest.mock("../lib/supabase", () => ({
  supabase: { from: jest.fn(() => ({ upsert: mockUpsert })) },
}));
jest.mock("../lib/analytics", () => ({ logAlarmEvent: jest.fn(() => Promise.resolve()) }));

import { clearIntakeOutbox, listIntakeOutbox } from "../lib/intakeOutbox";
import { flushIntakeOutbox, IntakeQueuedError, recordIntake } from "../lib/records";

beforeEach(() => {
  mockValues.clear();
  mockUpsert.mockReset();
});

it("서버 실패 전에 기록을 영구 outbox에 넣고 다음 활성화에서 재전송한다", async () => {
  mockUpsert.mockResolvedValueOnce({ error: new Error("offline") });
  const args = {
    patientId: "patient-a", scheduleId: "schedule-a",
    scheduledFor: new Date("2026-10-10T08:00:00.000Z"),
    status: "completed" as const, method: "버튼" as const,
  };
  await expect(recordIntake(args)).rejects.toBeInstanceOf(IntakeQueuedError);
  expect(await listIntakeOutbox("patient-a")).toHaveLength(1);

  mockUpsert.mockResolvedValueOnce({ error: null });
  await expect(flushIntakeOutbox("patient-a")).resolves.toBe(1);
  expect(await listIntakeOutbox("patient-a")).toEqual([]);
  expect(mockUpsert).toHaveBeenCalledTimes(2);
  expect(mockUpsert).toHaveBeenLastCalledWith(
    expect.objectContaining({ patient_id: "patient-a", schedule_id: "schedule-a", status: "completed" }),
    { onConflict: "schedule_id,scheduled_for" },
  );
});

it("이전 계정의 늦은 성공 응답이 새 계정 outbox를 지우지 않는다", async () => {
  let resolvePatientA!: (value: { error: null }) => void;
  mockUpsert
    .mockImplementationOnce(() => new Promise((resolve) => { resolvePatientA = resolve; }))
    .mockResolvedValueOnce({ error: new Error("patient-b offline") });

  const patientA = recordIntake({
    patientId: "patient-a", scheduleId: "schedule-a",
    scheduledFor: new Date("2026-10-10T08:00:00.000Z"),
    status: "completed", method: "버튼",
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(mockUpsert).toHaveBeenCalledTimes(1);

  await clearIntakeOutbox();
  const patientB = recordIntake({
    patientId: "patient-b", scheduleId: "schedule-b",
    scheduledFor: new Date("2026-10-10T09:00:00.000Z"),
    status: "completed", method: "버튼",
  });
  expect(await listIntakeOutbox("patient-b")).toHaveLength(1);

  resolvePatientA({ error: null });
  await expect(patientA).resolves.toBeUndefined();
  await expect(patientB).rejects.toBeInstanceOf(IntakeQueuedError);
  expect(await listIntakeOutbox("patient-b")).toHaveLength(1);
});

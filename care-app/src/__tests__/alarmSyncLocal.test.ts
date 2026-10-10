jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn() },
}));
jest.mock("@notifee/react-native", () => ({ __esModule: true, default: {} }));
jest.mock("../lib/supabase", () => ({
  supabase: { from: jest.fn() }, hasStoredSession: jest.fn(() => Promise.resolve(true)),
}));
jest.mock("../lib/storage", () => ({ getPatientId: jest.fn(() => Promise.resolve("patient-a")) }));
jest.mock("../lib/notifications", () => ({
  rescheduleNext: jest.fn(() => Promise.resolve()), scheduleIosWindow: jest.fn(() => Promise.resolve()),
}));
jest.mock("../lib/localAlarmSchedules", () => ({
  getLocalAlarmSchedule: jest.fn(() => Promise.resolve({
    id: "schedule-a", medicineName: "약 A", timeOfDay: "아침",
    hour: 8, minute: 10, repeatDays: [1, 3, 5],
  })),
  listLocalAlarmSchedules: jest.fn(), replaceLocalAlarmSchedules: jest.fn(),
}));

import { rescheduleNext, scheduleIosWindow } from "../lib/notifications";
import { rescheduleCachedAlarm } from "../lib/alarmSync";

it("DELIVERED 뒤 네트워크 조회 없이 계정별 로컬 일정으로 다음 회차를 예약한다", async () => {
  await expect(rescheduleCachedAlarm("schedule-a")).resolves.toBe(true);
  expect(rescheduleNext).toHaveBeenCalledWith("schedule-a", 8, 10, [1, 3, 5], "아침", "약 A");
  expect(scheduleIosWindow).toHaveBeenCalledWith("schedule-a", "아침", 8, 10, [1, 3, 5], "약 A");
});

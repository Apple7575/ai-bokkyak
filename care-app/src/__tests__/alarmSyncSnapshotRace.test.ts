const mockValues = new Map<string, string>();
let mockResolveQuery: ((value: { data: any[]; error: null }) => void) | null = null;

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockValues.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => { mockValues.set(key, value); return Promise.resolve(); }),
    removeItem: jest.fn((key: string) => { mockValues.delete(key); return Promise.resolve(); }),
  },
}));
jest.mock("@notifee/react-native", () => ({
  __esModule: true, default: { cancelTriggerNotification: jest.fn(() => Promise.resolve()) },
}));
jest.mock("../lib/storage", () => ({ getPatientId: jest.fn(() => Promise.resolve("patient-a")) }));
jest.mock("../lib/notifications", () => ({
  rescheduleNext: jest.fn(() => Promise.resolve()), scheduleIosWindow: jest.fn(() => Promise.resolve()),
}));
jest.mock("../lib/supabase", () => ({
  hasStoredSession: jest.fn(() => Promise.resolve(true)),
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => new Promise((resolve) => { mockResolveQuery = resolve; })),
        })),
      })),
    })),
  },
}));

import { resyncAllAlarms } from "../lib/alarmSync";
import {
  listLocalAlarmSchedules, removeLocalAlarmSchedule, upsertLocalAlarmSchedule,
} from "../lib/localAlarmSchedules";

const oldSchedule = {
  id: "old", medicineName: "기존약", timeOfDay: "아침", hour: 8, minute: 0, repeatDays: [1],
};
const newSchedule = {
  id: "new", medicineName: "새약", timeOfDay: "저녁", hour: 20, minute: 0, repeatDays: [2],
};
const serverRow = (s: typeof oldSchedule) => ({
  id: s.id, medicine_name: s.medicineName, time_of_day: s.timeOfDay,
  hour: s.hour, minute: s.minute, repeat_days: s.repeatDays,
});

beforeEach(() => {
  mockValues.clear();
  mockResolveQuery = null;
});

it("지연된 서버 snapshot이 그 사이 추가한 로컬 일정을 제거하지 않는다", async () => {
  await upsertLocalAlarmSchedule("patient-a", oldSchedule);
  const syncing = resyncAllAlarms();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await upsertLocalAlarmSchedule("patient-a", newSchedule);
  mockResolveQuery?.({ data: [serverRow(oldSchedule)], error: null });
  await syncing;
  expect((await listLocalAlarmSchedules("patient-a")).map((s) => s.id).sort()).toEqual(["new", "old"]);
});

it("지연된 서버 snapshot이 그 사이 삭제한 로컬 일정을 되살리지 않는다", async () => {
  await upsertLocalAlarmSchedule("patient-a", oldSchedule);
  const syncing = resyncAllAlarms();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await removeLocalAlarmSchedule("patient-a", "old");
  mockResolveQuery?.({ data: [serverRow(oldSchedule)], error: null });
  await syncing;
  expect(await listLocalAlarmSchedules("patient-a")).toEqual([]);
});

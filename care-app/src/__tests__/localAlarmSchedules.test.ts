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
  clearLocalAlarmSchedules, getLocalAlarmSchedule, listLocalAlarmSchedules,
  removeLocalAlarmSchedule, replaceLocalAlarmSchedules, upsertLocalAlarmSchedule,
} from "../lib/localAlarmSchedules";

const morning = {
  id: "schedule-a", medicineName: "약 A", timeOfDay: "아침",
  hour: 8, minute: 10, repeatDays: [] as number[],
};

beforeEach(() => mockValues.clear());

it("계정별 일정 사본을 격리하고 다른 계정에서 읽지 않는다", async () => {
  await replaceLocalAlarmSchedules("patient-a", [morning]);
  expect(await getLocalAlarmSchedule("patient-a", "schedule-a")).toEqual(morning);
  expect(await listLocalAlarmSchedules("patient-b")).toEqual([]);
});

it("수정은 같은 일정 id를 교체하고 삭제는 미래 재예약에서 제거한다", async () => {
  await upsertLocalAlarmSchedule("patient-a", morning);
  await upsertLocalAlarmSchedule("patient-a", { ...morning, hour: 9, repeatDays: [1, 3, 5] });
  expect(await listLocalAlarmSchedules("patient-a")).toEqual([{ ...morning, hour: 9, repeatDays: [1, 3, 5] }]);
  await removeLocalAlarmSchedule("patient-a", morning.id);
  expect(await listLocalAlarmSchedules("patient-a")).toEqual([]);
});

it("로그아웃·회원 삭제 시 로컬 건강 일정 사본을 지운다", async () => {
  await replaceLocalAlarmSchedules("patient-a", [morning]);
  await clearLocalAlarmSchedules();
  expect(await listLocalAlarmSchedules("patient-a")).toEqual([]);
});


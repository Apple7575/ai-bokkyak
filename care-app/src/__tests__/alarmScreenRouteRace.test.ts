import { alarmDisplayForRoute, loadedAlarmSchedule } from "../lib/alarmScreenState";

it("A 조회 결과가 남아 있어도 B route로 바뀌면 즉시 B fallback을 표시하고 B 시각을 쓴다", () => {
  const loadedA = loadedAlarmSchedule({
    scheduleId: "schedule-a", medicineName: "A fallback", timeOfDay: "아침", hour: 8, minute: 10,
  }, {
    medicine_name: "A약", time_of_day: "아침", hour: 8, minute: 10,
  });
  const routeB = {
    scheduleId: "schedule-b", medicineName: "B약", timeOfDay: "저녁", hour: 20, minute: 35,
  };
  expect(alarmDisplayForRoute(routeB, loadedA)).toEqual({
    medicine_name: "B약", time_of_day: "저녁", hour: 20, minute: 35,
  });
});

it("현재 route와 같은 원격 결과만 fallback을 대체한다", () => {
  const routeB = {
    scheduleId: "schedule-b", medicineName: "B fallback", timeOfDay: "저녁", hour: 20, minute: 35,
  };
  expect(alarmDisplayForRoute(routeB, loadedAlarmSchedule(routeB, {
    medicine_name: "B server", time_of_day: "저녁", hour: 21, minute: 5,
  }))).toEqual({ medicine_name: "B server", time_of_day: "저녁", hour: 21, minute: 5 });
});

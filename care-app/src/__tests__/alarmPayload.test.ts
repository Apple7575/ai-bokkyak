import { alarmRouteFromData } from "../lib/alarmPayload";

describe("alarmRouteFromData", () => {
  it("keeps the local alarm details needed while offline", () => {
    expect(alarmRouteFromData({
      scheduleId: "schedule-1", medName: "medicine", tod: "morning", hour: "8", minute: "5",
    })).toEqual({
      scheduleId: "schedule-1", medicineName: "medicine", timeOfDay: "morning", hour: 8, minute: 5,
    });
  });

  it("rejects missing ids and drops invalid clock values", () => {
    expect(alarmRouteFromData({ hour: 8 })).toBeNull();
    expect(alarmRouteFromData({ scheduleId: "s", hour: 24, minute: -1 })).toEqual({
      scheduleId: "s", medicineName: undefined, timeOfDay: undefined, hour: undefined, minute: undefined,
    });
  });
});

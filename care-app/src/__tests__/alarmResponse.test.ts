import { runLocalAlarmAction } from "../lib/alarmResponse";

describe("runLocalAlarmAction", () => {
  it("stops the alarm before persisting the server record", async () => {
    const calls: string[] = [];
    const result = await runLocalAlarmAction({
      stop: async () => { calls.push("stop"); },
      persist: async () => { calls.push("persist"); },
    });

    expect(calls).toEqual(["stop", "persist"]);
    expect(result).toEqual({ persisted: true });
  });

  it("schedules snooze locally before attempting the server record", async () => {
    const calls: string[] = [];
    const result = await runLocalAlarmAction({
      stop: async () => { calls.push("stop"); },
      afterStop: async () => { calls.push("snooze"); },
      persist: async () => { calls.push("persist"); },
    });

    expect(calls).toEqual(["stop", "snooze", "persist"]);
    expect(result).toEqual({ persisted: true });
  });

  it("reports persistence failure after local alarm control has completed", async () => {
    const calls: string[] = [];
    const failure = new Error("offline");
    const result = await runLocalAlarmAction({
      stop: async () => { calls.push("stop"); },
      afterStop: async () => { calls.push("snooze"); },
      persist: async () => { calls.push("persist"); throw failure; },
    });

    expect(calls).toEqual(["stop", "snooze", "persist"]);
    expect(result).toEqual({ persisted: false, error: failure });
  });
});

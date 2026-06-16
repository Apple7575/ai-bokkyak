import { statusLabel } from "../lib/intakeStatus";

describe("statusLabel", () => {
  it("completed → 복용 완료", () => expect(statusLabel("completed")).toBe("복용 완료"));
  it("snoozed → 30분 후 다시 알림", () => expect(statusLabel("snoozed")).toBe("30분 후 다시 알림"));
  it("skipped → 복약 누락 또는 미확인", () => expect(statusLabel("skipped")).toBe("복약 누락 또는 미확인"));
  it("missed → 복약 누락 또는 미확인", () => expect(statusLabel("missed")).toBe("복약 누락 또는 미확인"));
  it("no_schedule → 복약 일정 없음", () => expect(statusLabel("no_schedule")).toBe("복약 일정 없음"));
});

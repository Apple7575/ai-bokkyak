import { planWindowBursts } from "../lib/iosAlarmWindow";
import { nextDoseAt, dosesWithin } from "../lib/doseTimes";

const GAP = 30_000;

describe("planWindowBursts", () => {
  const d = (iso: string) => new Date(iso);

  it("첫 도즈의 정시는 비운다 — 정시 알람과 겹쳐 알림이 두 개 뜨던 버그", () => {
    const doses = [d("2026-08-21T08:00:00"), d("2026-08-22T08:00:00")];
    const plan = planWindowBursts(doses, 3, GAP);
    const firstDose = plan.filter((p) => p.doseIndex === 0);
    expect(firstDose.map((p) => p.burst)).toEqual([1, 2]);
  });

  it("둘째 도즈부터는 정시도 윈도우가 담당한다 (재예약 대상이 아니므로)", () => {
    const doses = [d("2026-08-21T08:00:00"), d("2026-08-22T08:00:00")];
    const plan = planWindowBursts(doses, 3, GAP);
    expect(plan.filter((p) => p.doseIndex === 1).map((p) => p.burst)).toEqual([0, 1, 2]);
  });

  it("버스트 시각은 정시 + 간격 배수다", () => {
    const base = d("2026-08-21T08:00:00");
    const plan = planWindowBursts([base], 3, GAP);
    expect(plan.map((p) => p.at)).toEqual([base.getTime() + GAP, base.getTime() + 2 * GAP]);
  });

  it("perDose가 1이면 첫 도즈는 아무것도 만들지 않는다(정시 알람만 남음)", () => {
    const plan = planWindowBursts([d("2026-08-21T08:00:00")], 1, GAP);
    expect(plan).toEqual([]);
  });

  it("도즈가 없으면 빈 계획", () => {
    expect(planWindowBursts([], 5, GAP)).toEqual([]);
  });

  // 이 불변식이 깨지면 알림이 다시 두 개씩 뜬다.
  it("어떤 계획도 정시 알람(nextDoseAt)과 같은 시각에 울리지 않는다", () => {
    const now = new Date("2026-08-20T09:15:00");
    for (const spec of [
      { hour: 8, minute: 0, repeat_days: [] },          // 매일
      { hour: 21, minute: 30, repeat_days: [] },        // 오늘 아직 안 지난 시각
      { hour: 13, minute: 0, repeat_days: [1, 3, 5] },  // 요일 반복
    ]) {
      const primary = nextDoseAt(spec, now).getTime();
      const doses = dosesWithin(spec, now, 48);
      expect(doses[0].getTime()).toBe(primary); // 두 계산이 같은 회차를 가리킨다
      for (const p of planWindowBursts(doses, 6, GAP)) {
        expect(p.at).not.toBe(primary);
      }
    }
  });
});

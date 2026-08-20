// iOS 48시간 윈도우 알림의 발사 시각 계획 — 순수 로직 (RN 의존 없음, jest 대상).
//
// iOS에는 Android의 fullScreenAction·정확 알람이 없어서, 앞으로 48시간 안의 도즈마다
// "정시 + 30초 간격 버스트"를 미리 예약해 두고 앱이 켜질 때마다 다시 채운다.
//
// QA 2026-08-20 — 같은 시각에 알림이 두 개 뜨던 버그:
//   첫 도즈의 정시는 rescheduleNext가 `alarm-{id}`로 이미 예약해 둔 회차다
//   (nextDoseAt과 dosesWithin의 첫 원소는 같은 계산이라 반드시 같은 시각).
//   윈도우가 여기에 b=0을 또 만들어서 같은 초에 두 개가 떴다.
//   → 첫 도즈는 버스트(b>=1)만 담당한다.

export type WindowBurst = {
  /** doses 배열에서의 인덱스 */
  doseIndex: number;
  /** 그 도즈 안에서 몇 번째 울림인가 (0 = 정시) */
  burst: number;
  /** 발사 시각(ms) */
  at: number;
};

/**
 * @param doses      dosesWithin()이 돌려준 도즈 시각들(오름차순)
 * @param perDose    도즈당 최대 울림 횟수(정시 포함)
 * @param gapMs      버스트 간격
 * @param skipFirstDoseBase 첫 도즈의 정시를 비울지. 정시 알람(rescheduleNext)이
 *                   짝으로 예약되는 정상 경로에서는 항상 true.
 */
export function planWindowBursts(
  doses: Date[], perDose: number, gapMs: number, skipFirstDoseBase = true
): WindowBurst[] {
  const out: WindowBurst[] = [];
  for (let di = 0; di < doses.length; di++) {
    const base = doses[di].getTime();
    const first = di === 0 && skipFirstDoseBase ? 1 : 0;
    for (let b = first; b < perDose; b++) {
      out.push({ doseIndex: di, burst: b, at: base + b * gapMs });
    }
  }
  return out;
}

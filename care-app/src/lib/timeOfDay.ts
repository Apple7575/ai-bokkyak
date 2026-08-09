// 복용 시간대(아침/점심/저녁/취침)와 실제 시각의 대응 — 순수 로직 (jest 대상).
//
// 왜 필요한가 (QA 2026-08-09):
//   등록 화면이 "시간대"와 "몇 시"를 따로 고르게 해서, 「점심 · 08:00」처럼 서로
//   모순되는 일정이 만들어졌다. 알람은 hour(8시)에 울리는데 제목과 소리는
//   time_of_day(점심)를 쓰기 때문에, 아침 8시에 "점심 약 복용 시간입니다"가 울린다.
//   둘을 따로 두는 한 사용자는 언제든 어긋나게 고를 수 있으므로, 한쪽을 바꾸면
//   다른 쪽이 따라오게 만들어 애초에 모순이 생기지 않게 한다.

export type TimeOfDay = "아침" | "점심" | "저녁" | "취침";

export const TIME_OF_DAYS: readonly TimeOfDay[] = ["아침", "점심", "저녁", "취침"] as const;

export function isTimeOfDay(v: unknown): v is TimeOfDay {
  return typeof v === "string" && (TIME_OF_DAYS as readonly string[]).includes(v);
}

// 시각 → 시간대. 경계는 어르신이 "이 시간이면 그렇게 부르겠다" 싶은 쪽으로 잡았다.
//   04:00–10:59 아침 / 11:00–15:59 점심 / 16:00–20:59 저녁 / 21:00–03:59 취침
export function timeOfDayForHour(hour: number): TimeOfDay {
  if (!Number.isFinite(hour)) return "아침";
  const h = ((Math.trunc(hour) % 24) + 24) % 24; // 음수·24 이상도 하루 안으로
  if (h >= 4 && h <= 10) return "아침";
  if (h >= 11 && h <= 15) return "점심";
  if (h >= 16 && h <= 20) return "저녁";
  return "취침";
}

// 시간대 → 기본 시각. 시간대 칩을 고르면 이 시각으로 맞춘다.
// (회의에서 정한 기본값: 아침 8시, 점심 1시, 저녁 7시, 취침 9시)
const DEFAULT_HOUR: Record<TimeOfDay, number> = { 아침: 8, 점심: 13, 저녁: 19, 취침: 21 };

export function defaultHourFor(tod: TimeOfDay): number {
  return DEFAULT_HOUR[tod];
}

// 이미 고른 시각이 그 시간대 안에 있으면 그대로 두고, 벗어났을 때만 기본 시각으로 옮긴다.
// (점심 12시를 고른 사람이 점심 칩을 다시 눌렀다고 13시로 튕기면 안 된다.)
export function hourForTimeOfDay(tod: TimeOfDay, currentHour: number): number {
  return timeOfDayForHour(currentHour) === tod ? currentHour : DEFAULT_HOUR[tod];
}

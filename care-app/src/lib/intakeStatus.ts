export type IntakeStatus = "completed" | "snoozed" | "skipped";
export type DisplayStatus = IntakeStatus | "missed" | "no_schedule";

export function statusLabel(s: DisplayStatus): string {
  switch (s) {
    case "completed": return "복용 완료";
    // 미루는 시간은 사용자가 고른다(5분~1시간, 시각 지정) — 특정 분수를 박아 두면 거짓이 된다.
    case "snoozed": return "다시 알림 예약";
    case "skipped": return "복약 누락 또는 미확인";
    case "missed": return "복약 누락 또는 미확인";
    case "no_schedule": return "복약 일정 없음";
  }
}

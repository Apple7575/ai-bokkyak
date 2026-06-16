export type IntakeStatus = "completed" | "snoozed" | "skipped";
export type DisplayStatus = IntakeStatus | "missed" | "no_schedule";

export function statusLabel(s: DisplayStatus): string {
  switch (s) {
    case "completed": return "복용 완료";
    case "snoozed": return "30분 후 다시 알림";
    case "skipped": return "복약 누락 또는 미확인";
    case "missed": return "복약 누락 또는 미확인";
    case "no_schedule": return "복약 일정 없음";
  }
}

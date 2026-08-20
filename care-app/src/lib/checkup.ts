// 복약 확인(TTS + 화면 터치) 순서와 문구 — 순수 로직 (RN/네트워크 의존 없음, jest 대상).
//
// 원래 이 자리에는 AI 건강전화(OpenAI Realtime + WebRTC 양방향 통화)가 있었다.
// 회의 결정 2026-08-20으로 음성 AI를 전부 걷어냈다:
//   · 마이크가 스피커 소리와 주변 소음을 물어 엉뚱한 말이 인식됐다(QA).
//   · 어르신에게는 말로 답하는 것보다 큰 버튼을 누르는 편이 확실하다.
// 남긴 것은 "TTS로 읽어주고, 답은 화면 터치로" 한 방향뿐이다. 음성 인식은 없다.

import { slotLabel } from "./timeOfDay";

export type CheckupDose = {
  id: string;
  medicine_name: string;
  time_of_day: string;
  hour: number;
  minute: number;
  repeat_days: number[];
};

/** 화면 터치로 고를 수 있는 답. "나중에"는 아무것도 기록하지 않고 넘어간다. */
export type CheckupAnswer = "먹었어요" | "안먹었어요" | "나중에";

/**
 * 오늘 확인할 약 목록.
 * · 오늘 요일에 해당하는 것만 (repeat_days 빈 배열 = 매일, 설계 결정 #1)
 * · 이미 복용 완료로 기록된 것은 다시 묻지 않는다
 * · 이른 시각부터 순서대로 — 어르신이 하루를 되짚는 순서와 같다
 */
export function buildCheckupList<T extends CheckupDose>(
  schedules: T[], completedScheduleIds: Set<string>, today: Date
): T[] {
  const day = today.getDay();
  return schedules
    .filter((s) => {
      const days = s.repeat_days ?? [];
      return days.length === 0 || days.includes(day);
    })
    .filter((s) => !completedScheduleIds.has(s.id))
    .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
}

/** 시작 인사. 이름을 모르면 이름 없이. */
export function checkupGreeting(patientName?: string | null): string {
  const n = (patientName ?? "").trim();
  return n
    ? `안녕하세요, ${n}님. 오늘 드실 약을 하나씩 확인해 볼게요.`
    : "안녕하세요. 오늘 드실 약을 하나씩 확인해 볼게요.";
}

/** 약 하나를 묻는 말. 예: "아침에 드시는 비타민, 드셨어요?" */
export function checkupPrompt(dose: CheckupDose): string {
  return `${slotLabel(dose.time_of_day)}에 드시는 ${dose.medicine_name}, 드셨어요?`;
}

/** 화면에 함께 보여줄 시각. 예: "아침 08:00" */
export function checkupTimeLabel(dose: CheckupDose): string {
  const hh = String(dose.hour).padStart(2, "0");
  const mm = String(dose.minute).padStart(2, "0");
  return `${slotLabel(dose.time_of_day)} ${hh}:${mm}`;
}

/** 다 끝난 뒤 들려줄 말. asked는 물어본 개수, taken은 "먹었어요"로 답한 개수. */
export function checkupSummary(asked: number, taken: number): string {
  if (asked === 0) return "오늘 확인할 약이 없어요. 편안한 하루 보내세요.";
  if (taken === asked) return `${asked}개 모두 드셨네요. 잘하셨어요.`;
  if (taken === 0) return "아직 드시지 않은 약이 있어요. 잊지 말고 챙겨 드세요.";
  return `${asked}개 중 ${taken}개 드셨어요. 나머지도 잊지 말고 챙겨 드세요.`;
}

/** 답을 기록용 상태로. "나중에"는 기록하지 않으므로 null. */
export function answerToStatus(a: CheckupAnswer): "completed" | "skipped" | null {
  if (a === "먹었어요") return "completed";
  if (a === "안먹었어요") return "skipped";
  return null;
}

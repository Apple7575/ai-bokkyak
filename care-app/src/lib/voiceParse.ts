// 음성 가이드 발화 해석 — 순수 로직 (RN/네트워크 의존 없음, jest 대상).
//
// 문서 §7: 인식 대상 어휘는 숫자(1~4), 시간대(아침/점심/저녁/취침/식후), 시각,
//          긍정/부정 중심의 제한 어휘다. 자유 대화를 이해하려 들지 않는다.
//
// 문서 §2 "한 질문 한 정보": 단계마다 하나만 물어보되, 자연 발화에 여러 정보가
//          담기면 모두 흡수하고 해당 단계를 건너뛴다(§5 멀티 정보 발화).

import { AFTER_MEAL_DEFAULTS } from "./voiceScript";

export type Slot = "아침" | "점심" | "저녁" | "취침";
export const SLOTS: readonly Slot[] = ["아침", "점심", "저녁", "취침"] as const;

export type DoseTime = { slot: Slot; hour: number; minute: number };

export type Utterance = {
  /** 하루 복용 횟수 (1~4). 못 찾으면 null */
  count: number | null;
  /** 말한 시간대 순서대로. 중복 제거 */
  slots: Slot[];
  /** 시간대와 짝지어진 구체 시각 */
  times: DoseTime[];
  /** "식후", "밥 먹고" 처럼 식사 기준 발화 */
  afterMeal: boolean;
  /** 긍정/부정. 해당 없으면 null */
  yesNo: boolean | null;
};

// 숫자 한글 표기 → 값. 1~4만 쓰지만 "다섯" 이상도 읽어서 4로 묶는다(4번 이상).
const KO_NUM: Record<string, number> = {
  한: 1, 하나: 1, 일: 1,
  두: 2, 둘: 2, 이: 2,
  세: 3, 셋: 3, 삼: 3,
  네: 4, 넷: 4, 사: 4,
  다섯: 5, 오: 5, 여섯: 6, 육: 6,
};

const SLOT_WORDS: { word: string; slot: Slot }[] = [
  { word: "아침", slot: "아침" }, { word: "조식", slot: "아침" },
  { word: "점심", slot: "점심" }, { word: "중식", slot: "점심" }, { word: "낮", slot: "점심" },
  { word: "저녁", slot: "저녁" }, { word: "석식", slot: "저녁" },
  { word: "취침", slot: "취침" }, { word: "자기전", slot: "취침" }, { word: "자기 전", slot: "취침" },
  { word: "잘때", slot: "취침" }, { word: "잘 때", slot: "취침" }, { word: "밤", slot: "취침" },
];

const AFTER_MEAL_WORDS = ["식후", "밥먹고", "밥 먹고", "식사후", "식사 후", "먹고나서", "먹고 나서"];

// "네"는 긍정이지만 "네 번"은 숫자다. 부정을 먼저 보고, 긍정은 숫자 문맥을 제외한다.
const NO_WORDS = ["아니", "아니요", "아니오", "아뇨", "틀려", "다시", "아닙니다"];
const YES_WORDS = ["네", "예", "맞아", "맞아요", "맞습니다", "그래", "응", "좋아"];

function norm(s: string): string {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

// 하루 복용 횟수. "하루 3번", "세 번", "3회" 등.
export function parseCount(text: string): number | null {
  const t = norm(text);
  if (!t) return null;
  // 1) 아라비아 숫자 + 번/회/차
  const m = t.match(/(\d+)\s*(번|회|차례)/);
  if (m) return clampCount(Number(m[1]));
  // 2) 한글 수사 + 번/회
  for (const [word, val] of Object.entries(KO_NUM)) {
    // "네 번"처럼 수사와 단위가 붙어야 횟수로 본다. 단독 "네"는 긍정이다.
    if (new RegExp(`${word}\\s*(번|회)`).test(t)) return clampCount(val);
  }
  // 3) 단위 없는 숫자는 "하루" 뒤에 올 때만 횟수로 본다 ("하루 3")
  const m2 = t.match(/하루\s*(\d+)/);
  if (m2) return clampCount(Number(m2[1]));
  return null;
}

function clampCount(n: number): number | null {
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(4, Math.trunc(n)); // 4번 이상은 4로 묶는다(화면 버튼과 동일)
}

// 말한 시간대. 등장 순서를 유지하고 중복은 제거한다.
export function parseSlots(text: string): Slot[] {
  const t = norm(text);
  const found: { slot: Slot; at: number }[] = [];
  for (const { word, slot } of SLOT_WORDS) {
    const at = t.indexOf(word);
    if (at >= 0 && !found.some((f) => f.slot === slot)) found.push({ slot, at });
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.slot);
}

export function isAfterMeal(text: string): boolean {
  const t = norm(text).replace(/\s+/g, "");
  return AFTER_MEAL_WORDS.some((w) => t.includes(w.replace(/\s+/g, "")));
}

// 긍정/부정. 부정을 먼저 본다 — "아니요"에 "네"가 없지만 "아니"가 우선이어야 한다.
// "네 번"처럼 숫자 문맥의 "네"는 긍정으로 치지 않는다.
export function parseYesNo(text: string): boolean | null {
  const t = norm(text);
  if (!t) return null;
  if (NO_WORDS.some((w) => t.includes(w))) return false;
  const withoutCount = t.replace(/(네|넷)\s*(번|회)/g, " ");
  if (YES_WORDS.some((w) => new RegExp(`(^|\\s)${w}`).test(withoutCount))) return true;
  return null;
}

// 시각 표현을 시간대와 짝지어 뽑는다.
//   "아침 8시, 점심 12시, 저녁 6시" → 세 쌍
//   "아침 8시 반"                   → 8:30
// 시간대 없이 시각만 말하면(예: "8시") 짝지을 수 없어 버린다 — 어느 끼니인지 모른다.
export function parseTimes(text: string): DoseTime[] {
  const t = norm(text);
  const out: DoseTime[] = [];
  // 시간대 등장 위치를 먼저 잡고, 그 뒤에 처음 나오는 시각을 그 시간대의 것으로 본다.
  const marks: { slot: Slot; at: number }[] = [];
  for (const { word, slot } of SLOT_WORDS) {
    let i = t.indexOf(word);
    while (i >= 0) {
      if (!marks.some((m) => m.slot === slot)) marks.push({ slot, at: i });
      i = t.indexOf(word, i + 1);
    }
  }
  marks.sort((a, b) => a.at - b.at);

  for (let k = 0; k < marks.length; k++) {
    const start = marks[k].at;
    const end = k + 1 < marks.length ? marks[k + 1].at : t.length;
    const seg = t.slice(start, end);
    const hm = seg.match(/(\d{1,2})\s*시\s*(반|(\d{1,2})\s*분)?/);
    if (!hm) continue;
    let hour = Number(hm[1]);
    let minute = 0;
    if (hm[2] === "반") minute = 30;
    else if (hm[3]) minute = Number(hm[3]);
    if (!Number.isFinite(hour) || hour < 0 || hour > 24) continue;
    if (minute < 0 || minute > 59) minute = 0;
    hour = toDayHour(marks[k].slot, hour);
    out.push({ slot: marks[k].slot, hour, minute });
  }
  return out;
}

// "저녁 6시"는 18시다. 12시간제로 말한 값을 시간대에 맞춰 되돌린다.
// 어르신은 "저녁 여섯시"라고 하지 "열여덟시"라고 하지 않는다.
export function toDayHour(slot: Slot, hour: number): number {
  if (hour === 24) return 0;
  if (slot === "아침") return hour === 12 ? 0 : hour;             // 아침 12시 = 자정 취급 안 함 → 0시는 비정상이나 방어
  if (slot === "점심") return hour < 11 ? hour + 12 : hour;       // 점심 1시 → 13시
  if (slot === "저녁") return hour < 12 ? hour + 12 : hour;       // 저녁 6시 → 18시
  return hour < 12 ? hour + 12 : hour;                            // 취침 9시 → 21시
}

// 한 발화에서 얻을 수 있는 정보를 모두 뽑는다 (문서 §5 멀티 정보 발화).
export function parseUtterance(text: string): Utterance {
  return {
    count: parseCount(text),
    slots: parseSlots(text),
    times: parseTimes(text),
    afterMeal: isAfterMeal(text),
    yesNo: parseYesNo(text),
  };
}

// 횟수만 정해졌을 때 기본으로 채울 시간대. 어르신 생활 패턴 기준.
export function defaultSlotsFor(count: number): Slot[] {
  switch (count) {
    case 1: return ["아침"];
    case 2: return ["아침", "저녁"];
    case 3: return ["아침", "점심", "저녁"];
    default: return ["아침", "점심", "저녁", "취침"];
  }
}

// 시간대 목록 → 식후 기본 시각을 채운 복용 시각 목록 (문서 §4 기본값 정책).
export function afterMealTimes(slots: Slot[]): DoseTime[] {
  return slots.map((s) => ({ slot: s, ...AFTER_MEAL_DEFAULTS[s] }));
}

// STT 문맥 바이어싱에 넘길 어휘 (문서 §7).
export const CONTEXT_WORDS: readonly string[] = [
  "하루", "한 번", "두 번", "세 번", "네 번",
  "아침", "점심", "저녁", "취침", "자기 전", "식후", "밥 먹고",
  "시", "분", "반",
  "네", "아니요", "맞아요", "다시",
] as const;

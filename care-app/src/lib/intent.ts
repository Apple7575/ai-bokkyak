export type Intent = "복용완료" | "미복용" | "재알림" | "인식실패";

const REMIND = ["나중에", "이따", "30분", "다시 알려", "다시알려"];
const NOT_TAKEN = ["안 먹", "안먹", "못 먹", "못먹", "아직"];
const TAKEN = ["먹었", "복용했", "먹음"];

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

export function classifyIntent(raw: string): Intent {
  const text = (raw ?? "").trim();
  if (!text) return "인식실패";
  if (hasAny(text, REMIND)) return "재알림";
  if (hasAny(text, NOT_TAKEN)) return "미복용";
  if (hasAny(text, TAKEN)) return "복용완료";
  return "인식실패";
}

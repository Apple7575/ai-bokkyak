// 음성 안내 속도 — 순수 로직 (RN/네트워크 의존 없음, jest 대상).
//
// 고령층은 말이 빠르면 못 알아듣고, 너무 느려도 답답해한다. 기본은 느리게로 두되
// 바꿀 수 있게 한다. OpenAI TTS의 speed는 0.25~4.0을 받지만 실제로 알아듣기 좋은
// 폭은 좁아서 세 단계만 노출한다.

export type SpeechRate = "느리게" | "보통" | "빠르게";

export const SPEECH_RATES: readonly SpeechRate[] = ["느리게", "보통", "빠르게"] as const;

export const DEFAULT_SPEECH_RATE: SpeechRate = "느리게";

const SPEED: Record<SpeechRate, number> = { 느리게: 0.85, 보통: 1.0, 빠르게: 1.15 };

export function isSpeechRate(v: unknown): v is SpeechRate {
  return typeof v === "string" && (SPEECH_RATES as readonly string[]).includes(v);
}

// 저장된 값(구버전/손상 포함)을 안전하게 정규화한다.
export function normalizeSpeechRate(raw: unknown): SpeechRate {
  return isSpeechRate(raw) ? raw : DEFAULT_SPEECH_RATE;
}

// TTS API에 넘길 배속.
export function speedOf(rate: SpeechRate): number {
  return SPEED[rate];
}

export function describeRate(rate: SpeechRate): string {
  switch (rate) {
    case "느리게": return "또박또박 천천히 읽어드려요";
    case "보통": return "보통 빠르기로 읽어드려요";
    case "빠르게": return "조금 빠르게 읽어드려요";
  }
}

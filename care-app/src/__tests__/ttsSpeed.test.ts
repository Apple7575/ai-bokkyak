import {
  normalizeSpeechRate, speedOf, isSpeechRate, describeRate,
  SPEECH_RATES, DEFAULT_SPEECH_RATE,
} from "../lib/ttsSpeed";

describe("normalizeSpeechRate", () => {
  it("정해진 값은 그대로", () => {
    expect(normalizeSpeechRate("보통")).toBe("보통");
    expect(normalizeSpeechRate("빠르게")).toBe("빠르게");
  });

  it("손상/구버전 값은 기본값(느리게)", () => {
    // 저장소가 깨져도 안내 음성이 안 나오거나 너무 빨라지면 안 된다.
    expect(normalizeSpeechRate(null)).toBe(DEFAULT_SPEECH_RATE);
    expect(normalizeSpeechRate(undefined)).toBe(DEFAULT_SPEECH_RATE);
    expect(normalizeSpeechRate("초고속")).toBe(DEFAULT_SPEECH_RATE);
    expect(normalizeSpeechRate(1.5)).toBe(DEFAULT_SPEECH_RATE);
    expect(normalizeSpeechRate({})).toBe(DEFAULT_SPEECH_RATE);
  });

  it("기본값은 고령층 기준 느리게", () => {
    expect(DEFAULT_SPEECH_RATE).toBe("느리게");
  });
});

describe("speedOf", () => {
  it("느릴수록 작은 값", () => {
    expect(speedOf("느리게")).toBeLessThan(speedOf("보통"));
    expect(speedOf("보통")).toBeLessThan(speedOf("빠르게"));
  });

  it("OpenAI TTS가 받는 범위(0.25~4.0) 안", () => {
    for (const r of SPEECH_RATES) {
      expect(speedOf(r)).toBeGreaterThanOrEqual(0.25);
      expect(speedOf(r)).toBeLessThanOrEqual(4.0);
    }
  });
});

describe("describeRate / isSpeechRate", () => {
  it("모든 단계에 설명이 있다", () => {
    for (const r of SPEECH_RATES) expect(describeRate(r).length).toBeGreaterThan(0);
  });
  it("정해진 3종만 통과", () => {
    expect(isSpeechRate("보통")).toBe(true);
    expect(isSpeechRate("아주 빠르게")).toBe(false);
  });
});

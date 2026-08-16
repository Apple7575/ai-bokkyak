// 자막 타이핑 배분 — 순수 로직 (RN/네트워크 의존 없음, jest 대상).
//
// 시안은 글자당 62ms 고정으로 타이핑한다. 그런데 V01 음성은 20초쯤이라
// 고정 속도로는 타이핑이 한참 먼저 끝나고 화면이 멈춘 채 음성만 남는다.
// 그래서 실제 재생 길이를 받아 그 안에 고르게 배분한다.
//
// 배분 기준은 글자 수다. 긴 문장이 오래 걸리는 게 자연스럽고, 성우가 읽는
// 속도도 대체로 글자 수에 비례한다.

export type TypingPlan = {
  /** 이 문장을 타이핑하는 데 쓸 시간(ms) */
  durationMs: number;
  /** 한 글자당 간격(ms) */
  perCharMs: number;
  /** 다 친 뒤 다음 문장으로 넘어가기 전 머무는 시간(ms) */
  holdMs: number;
};

/** 문장을 다 친 뒤 잠깐 머무는 비율. 너무 빨리 사라지면 못 읽는다. */
const HOLD_RATIO = 0.22;
/** 재생 길이를 모를 때 쓸 글자당 기본 간격(시안 값). */
export const DEFAULT_PER_CHAR_MS = 62;
/** 너무 빨라 못 읽는 것을 막는 하한. */
const MIN_PER_CHAR_MS = 24;
/** 너무 느려 답답해지는 것을 막는 상한. */
const MAX_PER_CHAR_MS = 140;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// 문장들을 총 재생 길이 안에 배분한다.
// totalMs가 없거나(재생 길이를 못 읽는 기기) 0 이하면 시안 기본 속도로 돌아간다.
export function planTyping(sentences: string[], totalMs?: number | null): TypingPlan[] {
  const lens = sentences.map((s) => Math.max(1, s.length));
  const totalChars = lens.reduce((a, b) => a + b, 0);

  if (!totalMs || totalMs <= 0 || !Number.isFinite(totalMs)) {
    return lens.map((len) => ({
      durationMs: len * DEFAULT_PER_CHAR_MS,
      perCharMs: DEFAULT_PER_CHAR_MS,
      holdMs: Math.round(len * DEFAULT_PER_CHAR_MS * HOLD_RATIO),
    }));
  }

  return lens.map((len) => {
    const share = (len / totalChars) * totalMs;   // 글자 수 비례 배분
    const typing = share * (1 - HOLD_RATIO);      // 일부는 다 친 뒤 머무는 데 쓴다
    const perChar = clamp(typing / len, MIN_PER_CHAR_MS, MAX_PER_CHAR_MS);
    return {
      durationMs: Math.round(perChar * len),
      perCharMs: Math.round(perChar),
      holdMs: Math.round(share - perChar * len > 0 ? share - perChar * len : share * HOLD_RATIO),
    };
  });
}

// 멘트를 화면에 띄울 문장 단위로 쪼갠다.
//
// 시안은 V01을 3문장으로 나눠 순차 표시한다. 마지막의 예시 문장
// ("…와 같이 말씀해 주세요")은 타이핑이 끝난 뒤 별도 힌트로 보여주므로 제외한다.
export function splitSentences(text: string, opts?: { dropExample?: boolean }): string[] {
  let t = String(text ?? "").trim();
  if (opts?.dropExample) {
    // 예시를 안내하는 마지막 문장을 떼어낸다.
    t = t.replace(/[^.!?]*와 같이 말씀해 주세요\.?\s*$/u, "").trim();
  }
  const parts = t
    .split(/(?<=[.!?])\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // "안녕하세요." 같은 짧은 조각은 다음 문장에 붙인다.
  // 시안이 V01을 3줄로 묶은 방식과 맞추기 위한 것이고, 한 줄만 덩그러니
  // 떠 있다가 사라지는 것도 어르신에게는 읽기 나쁘다.
  const merged: string[] = [];
  for (const part of parts) {
    if (part.length < MIN_SENTENCE_CHARS && merged.length === 0) {
      merged.push(part);
    } else if (merged.length > 0 && merged[merged.length - 1].length < MIN_SENTENCE_CHARS) {
      merged[merged.length - 1] += " " + part;
    } else {
      merged.push(part);
    }
  }
  return merged;
}

/** 이보다 짧은 조각은 독립된 줄로 두지 않는다. */
const MIN_SENTENCE_CHARS = 10;

// 에코 판정 — 순수 로직 (RN/네트워크 의존 없음, jest 대상).
//
// 문제: 스피커로 멘트가 나오는 동안 마이크를 열어 두면, 마이크가 자기 음성을 듣고
//       사용자가 말한 것으로 인식한다. 재생과 녹음이 서로 다른 오디오 파이프라인이라
//       기기 AEC가 걸리지 않을 수 있기 때문이다.
//
// 이 설계라서 쓸 수 있는 방법: 멘트가 고정 대본이라 우리가 "지금 무슨 말이 나가는지"를
//       정확히 안다. 인식된 문장이 재생 중인 멘트와 많이 겹치면 에코로 보고 버린다.
//       생성형 TTS였다면 쓸 수 없는 방법이다.
//
// 가장 위험한 오판: 어르신의 짧은 답을 에코로 착각해 버리는 것이다.
//       V04가 "맞으면 \"네\"라고 말씀해 주세요"라고 말하는데 사용자도 "네"라고 답한다.
//       그래서 짧은 발화는 무조건 통과시킨다 — 긴 에코와 짧은 답은 길이로 갈린다.

/** 이 길이 이하의 발화는 에코 판정을 하지 않는다. "네", "아니요", "세 번", "식후" 등. */
const SHORT_UTTERANCE_MAX = 5;

/** 2-gram 겹침이 이 비율 이상이면 에코로 본다. */
const ECHO_THRESHOLD = 0.5;

// 공백·문장부호를 지우고 비교용으로 정규화한다.
export function normalizeForEcho(s: string): string {
  return String(s ?? "")
    .replace(/["'“”‘’.,!?~…·\-()]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function bigrams(s: string): string[] {
  if (s.length < 2) return s.length === 1 ? [s] : [];
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

// 인식 문장의 2-gram 중 몇 %가 멘트에도 있는가.
// 포함 관계를 보는 것이라 멘트가 훨씬 길어도 비율이 낮아지지 않는다
// (에코는 멘트의 일부만 잡히는 경우가 많다).
export function echoSimilarity(recognized: string, cueText: string): number {
  const a = normalizeForEcho(recognized);
  const b = normalizeForEcho(cueText);
  if (!a || !b) return 0;
  const ga = bigrams(a);
  if (ga.length === 0) return b.includes(a) ? 1 : 0;
  const setB = new Set(bigrams(b));
  let hit = 0;
  for (const g of ga) if (setB.has(g)) hit++;
  return hit / ga.length;
}

// 재생 중 인식된 문장이 그 멘트의 에코인가.
// cueText가 없으면(재생 중이 아니면) 항상 false — 필터가 조용히 끼어들지 않게.
export function isLikelyEcho(recognized: string, cueText: string | null): boolean {
  if (!cueText) return false;
  const a = normalizeForEcho(recognized);
  if (!a) return false;
  // 짧은 답은 절대 버리지 않는다. 어르신의 "네"를 씹는 것이 최악의 실패다.
  if (a.length <= SHORT_UTTERANCE_MAX) return false;
  return echoSimilarity(recognized, cueText) >= ECHO_THRESHOLD;
}

// 긴 멘트에만 "눌러서 말씀하세요" 안내를 띄운다.
// 짧은 멘트("네, 알겠습니다")까지 안내를 띄우면 화면이 시끄럽다.
const LONG_CUE_CHARS = 60;

export function isLongCue(text: string): boolean {
  return normalizeForEcho(text).length >= LONG_CUE_CHARS;
}

// 통화 자막 필터 — 순수 로직 (RN/네트워크 의존 없음, jest 대상).
//
// QA 2026-08-20: AI가 말하는 동안 "나" 자막에 "해상교통지도" 같은 뜬금없는 말이
// 채워졌다. 마이크가 스피커에서 나오는 AI 목소리와 주변 소음을 같이 물고, 전사
// 모델(Whisper 계열)이 무음·잡음 구간에서 아무 말이나 만들어내는 현상이다.
//
// 근본 대책은 오디오 쪽에 있다:
//   · realtimeCall.ts — getUserMedia에 에코 제거/잡음 억제를 켠다.
//   · 엣지 함수 ?op=realtime-token — noise_reduction(near_field)과
//     turn_detection 임계값을 올려 잡음으로 발화 turn이 열리지 않게 한다.
// 이 파일은 그래도 새어 나온 것을 "화면에 안 보이게" 막는 마지막 그물이다.
// 모델의 응답까지 되돌리지는 못하므로, 여기만 믿으면 안 된다.

// 전사 모델이 무음 구간에서 흔히 만들어내는 정형구. 유튜브 자막 말뭉치로 학습된
// 흔적이라 실제 통화에서는 나올 일이 거의 없다.
const HALLUCINATION = [
  "시청해주셔서 감사합니다",
  "시청해 주셔서 감사합니다",
  "구독과 좋아요",
  "구독 좋아요",
  "다음 영상에서 만나요",
  "다음 시간에 만나요",
  "한글자막",
  "자막 제공",
  "자막제공",
  "mbc 뉴스",
  "kbs 뉴스",
  "sbs 뉴스",
  "이덕영입니다",
  "해상교통지도",
];

function normalize(text: string): string {
  // 공백·문장부호를 걷어내고 소문자로 — "구독, 좋아요!" 같은 변형도 같은 것으로 본다.
  return text.replace(/[\s.,!?~·…"'()\[\]]/g, "").toLowerCase();
}

/**
 * 화면의 "나" 자막으로 보여줄 만한 사용자 발화인가.
 *
 * 보수적으로 판단한다 — 실제로 하신 말씀을 지우는 쪽이 잡음을 한 번 더 보여주는
 * 것보다 나쁘다. 확실한 정형구와 빈 문자열만 걸러낸다.
 */
export function isDisplayableUserTranscript(text: string): boolean {
  const t = (text ?? "").trim();
  if (t === "") return false;
  const n = normalize(t);
  if (n === "") return false; // 문장부호만 있는 경우("...", "?")
  for (const phrase of HALLUCINATION) {
    if (n.includes(normalize(phrase))) return false;
  }
  return true;
}

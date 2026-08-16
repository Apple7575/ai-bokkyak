import { isLikelyEcho, echoSimilarity, normalizeForEcho, isLongCue } from "../lib/voiceEcho";
import { CUES } from "../lib/voiceScript";

describe("normalizeForEcho", () => {
  it("공백·문장부호를 지운다", () => {
    expect(normalizeForEcho('언제 드세요? "아침 8시"')).toBe("언제드세요아침8시");
  });
});

describe("어르신의 짧은 답은 절대 버리지 않는다", () => {
  // 최악의 실패: V04가 "맞으면 네라고 말씀해 주세요"라고 하는데
  // 사용자의 "네"를 에코로 착각해 씹어버리는 것.
  it("'네'는 V04 안에 들어 있어도 통과한다", () => {
    expect(isLikelyEcho("네", CUES.V04.text)).toBe(false);
  });
  it("'아니요'도 통과", () => {
    expect(isLikelyEcho("아니요", CUES.V04.text)).toBe(false);
  });
  it("'세 번'은 V01 예시와 겹쳐도 통과", () => {
    expect(isLikelyEcho("세 번", CUES.V01.text)).toBe(false);
  });
  it("'식후'도 통과", () => {
    expect(isLikelyEcho("식후", CUES.V02.text)).toBe(false);
  });
});

describe("멘트가 그대로 되돌아오면 에코로 본다", () => {
  it("멘트 전문", () => {
    expect(isLikelyEcho(CUES.V02.text, CUES.V02.text)).toBe(true);
  });
  it("멘트의 앞부분만 잡힌 경우", () => {
    expect(isLikelyEcho("언제 드세요 아침 8시 점심 12시", CUES.V02.text)).toBe(true);
  });
  it("띄어쓰기가 달라도 잡는다 — STT 결과는 원문과 띄어쓰기가 다르다", () => {
    expect(isLikelyEcho("복용알람설정이끝났어요 이제약드실시간마다", CUES.V05.text)).toBe(true);
  });
});

describe("진짜 사용자 발화는 통과시킨다", () => {
  it("긴 발화라도 멘트와 다르면 통과", () => {
    expect(isLikelyEcho("하루 세 번 아침 점심 저녁에 먹어요", CUES.V02.text)).toBe(false);
  });
  it("구체적인 시각 발화", () => {
    expect(isLikelyEcho("아침 여덟시 저녁 일곱시에 먹습니다", CUES.V02.text)).toBe(false);
  });
  it("재생 중이 아니면(cueText 없음) 항상 통과", () => {
    expect(isLikelyEcho(CUES.V02.text, null)).toBe(false);
  });
  it("빈 문자열", () => {
    expect(isLikelyEcho("", CUES.V02.text)).toBe(false);
  });
});

describe("echoSimilarity", () => {
  it("같은 문장은 1", () => {
    expect(echoSimilarity(CUES.V07.text, CUES.V07.text)).toBe(1);
  });
  it("전혀 다르면 낮다", () => {
    expect(echoSimilarity("고혈압약 두 알", CUES.V05.text)).toBeLessThan(0.5);
  });
});

describe("isLongCue — 긴 멘트에만 탭 안내를 띄운다", () => {
  it("긴 멘트", () => {
    expect(isLongCue(CUES.V01.text)).toBe(true);
    expect(isLongCue(CUES.V06.text)).toBe(true);
  });
  it("짧은 멘트에는 안내를 띄우지 않는다", () => {
    expect(isLongCue(CUES.V07.text)).toBe(false);   // "네, 알겠습니다."
    expect(isLongCue(CUES.V08.text)).toBe(false);
  });
});

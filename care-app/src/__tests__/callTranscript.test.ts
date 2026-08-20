import { isDisplayableUserTranscript } from "../lib/callTranscript";

describe("isDisplayableUserTranscript", () => {
  it("실제 대답은 그대로 보여준다", () => {
    for (const t of ["네 먹었어요", "아니요", "이따 먹을게요", "비타민 먹었습니다", "감사합니다"]) {
      expect(isDisplayableUserTranscript(t)).toBe(true);
    }
  });

  it("빈 값과 문장부호만 있는 전사는 버린다", () => {
    for (const t of ["", "   ", "...", "?", "…"]) {
      expect(isDisplayableUserTranscript(t)).toBe(false);
    }
  });

  it("무음 구간에서 흔한 정형구는 버린다", () => {
    for (const t of [
      "시청해주셔서 감사합니다",
      "시청해 주셔서 감사합니다.",
      "구독과 좋아요 부탁드립니다",
      "해상교통지도",          // QA에서 실제로 나온 것
      "한글자막 by 여러분",
    ]) {
      expect(isDisplayableUserTranscript(t)).toBe(false);
    }
  });

  it("공백·문장부호 변형도 같이 걸러진다", () => {
    expect(isDisplayableUserTranscript("구독, 좋아요!")).toBe(false);
  });

  // 지나치게 걸러내면 실제 대답이 사라진다 — 그쪽이 더 나쁜 실패다.
  it("정형구를 닮았을 뿐인 실제 말은 남긴다", () => {
    expect(isDisplayableUserTranscript("좋아요")).toBe(true);
    expect(isDisplayableUserTranscript("고맙습니다")).toBe(true);
  });
});

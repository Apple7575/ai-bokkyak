import {
  INITIAL_STATE, cuesForStep, cuesForResume, onUtterance, onNoReply,
  onRecognizeFail, onPickCount, onPickTimes, onConfirm, onSkip, isComplete,
  stepIndex, GUIDE_TOTAL_STEPS,
} from "../lib/voiceGuideFlow";
import { parseUtterance } from "../lib/voiceParse";

const say = (state: any, text: string) => onUtterance(state, parseUtterance(text));

describe("단계별 멘트 (문서 §4)", () => {
  it("각 단계의 재생 멘트", () => {
    expect(cuesForStep("count")).toEqual(["V01"]);
    expect(cuesForStep("time")).toEqual(["V02"]);
    expect(cuesForStep("confirm")).toEqual(["V04"]);
    expect(cuesForStep("done")).toEqual(["V05", "V06"]);
    expect(cuesForStep("skipped")).toEqual(["V14"]);
  });
});

describe("단계 1 — 횟수", () => {
  it("횟수만 말하면 V07 후 시간 질문으로", () => {
    const t = say(INITIAL_STATE, "하루 3번 먹어");
    expect(t.state.step).toBe("time");
    expect(t.state.count).toBe(3);
    expect(t.play).toEqual(["V07", "V02"]);
  });

  it("멀티 정보: 시간대까지 말하면 칩을 채운 채로 진입 (문서 §5)", () => {
    const t = say(INITIAL_STATE, "하루 3번 아침 점심 저녁에 먹어");
    expect(t.state.step).toBe("time");
    expect(t.state.slots).toEqual(["아침", "점심", "저녁"]);
  });

  it("시각까지 다 말하면 시간 단계를 건너뛴다", () => {
    const t = say(INITIAL_STATE, "하루 2번 아침 8시 저녁 7시");
    expect(t.state.step).toBe("confirm");
    expect(t.play).toEqual(["V07", "V04"]);
  });

  it("식후라고 하면 기본값을 제안한다(V03)", () => {
    const t = say(INITIAL_STATE, "하루 3번 밥 먹고 나서");
    expect(t.state.step).toBe("time");
    expect(t.state.proposedDefaults).toBe(true);
    expect(t.play).toEqual(["V07", "V03"]);
    expect(t.state.times).toEqual([
      { slot: "아침", hour: 8, minute: 0 },
      { slot: "점심", hour: 12, minute: 0 },
      { slot: "저녁", hour: 18, minute: 0 },
    ]);
  });

  it("못 알아들으면 인식 실패로 넘어간다", () => {
    const t = say(INITIAL_STATE, "음 그러니까");
    expect(t.state.step).toBe("count");
    expect(t.play).toEqual(["V12"]);
  });
});

describe("단계 2 — 시간", () => {
  const atTime = onPickCount(INITIAL_STATE, 3).state;

  it("시각을 말하면 요약으로", () => {
    const t = say(atTime, "아침 8시 점심 12시 저녁 6시");
    expect(t.state.step).toBe("confirm");
    expect(t.state.times).toHaveLength(3);
    expect(t.play).toEqual(["V04"]);
  });

  it("기본값 제안 중 '네' → 완료", () => {
    const proposed = say(atTime, "식후").state;
    expect(proposed.proposedDefaults).toBe(true);
    const t = say(proposed, "네");
    expect(t.state.step).toBe("done");
    expect(t.play).toEqual(["V07", "V05", "V06"]);
  });

  it("기본값 제안 중 '아니요' → V08 후 다시 시간 질문", () => {
    const proposed = say(atTime, "식후").state;
    const t = say(proposed, "아니요");
    expect(t.state.step).toBe("time");
    expect(t.state.proposedDefaults).toBe(false);
    expect(t.play).toEqual(["V08", "V02"]);
  });

  it("시간대만 말하면 칩만 갱신하고 계속 기다린다", () => {
    const t = say(atTime, "아침이랑 저녁");
    expect(t.state.step).toBe("time");
    expect(t.state.slots).toEqual(["아침", "저녁"]);
    expect(t.play).toEqual([]);
  });
});

describe("단계 3 — 요약 확인", () => {
  const atConfirm = onPickTimes(onPickCount(INITIAL_STATE, 1).state,
    [{ slot: "아침", hour: 8, minute: 0 }]).state;

  it("네 → 완료 (V07 후 V05·V06)", () => {
    const t = say(atConfirm, "네");
    expect(t.state.step).toBe("done");
    expect(t.play).toEqual(["V07", "V05", "V06"]);
  });

  it("아니요 → V08 후 시간 단계로 복귀", () => {
    const t = say(atConfirm, "아니요");
    expect(t.state.step).toBe("time");
    expect(t.play).toEqual(["V08", "V02"]);
  });

  it("버튼으로도 같게 동작한다", () => {
    expect(onConfirm(atConfirm, true).state.step).toBe("done");
    expect(onConfirm(atConfirm, false).state.step).toBe("time");
  });
});

describe("예외 처리 (문서 §5)", () => {
  it("무응답 V11은 단계마다 한 번만 — 반복 재생 금지", () => {
    const first = onNoReply(INITIAL_STATE);
    expect(first.play).toEqual(["V11"]);
    const second = onNoReply(first.state);
    expect(second.play).toEqual([]);   // 이후엔 조용히 버튼을 기다린다
  });

  it("인식 실패 1회 V12, 2회 V13 후 음성 종료", () => {
    const f1 = onRecognizeFail(INITIAL_STATE);
    expect(f1.play).toEqual(["V12"]);
    expect(f1.state.voiceOff).toBe(false);
    const f2 = onRecognizeFail(f1.state);
    expect(f2.play).toEqual(["V13"]);
    expect(f2.state.voiceOff).toBe(true);   // 버튼 입력만 대기
  });

  it("단계가 바뀌면 실패·무응답 카운터가 초기화된다", () => {
    // 실패 횟수는 '이번 단계' 기준이다. 안 그러면 앞 단계 실패 때문에
    // 다음 단계에서 음성이 바로 꺼진다.
    const failed = onRecognizeFail(onRecognizeFail(INITIAL_STATE).state).state;
    expect(failed.voiceOff).toBe(true);
    const moved = onPickCount(failed, 2);
    expect(moved.state.failCount).toBe(0);
    expect(moved.state.voiceOff).toBe(false);
    expect(moved.state.noReplyPrompted).toBe(false);
  });
});

describe("건너뛰기 / 재개", () => {
  it("어느 단계에서든 건너뛰면 V14", () => {
    const t = onSkip(onPickCount(INITIAL_STATE, 3).state);
    expect(t.state.step).toBe("skipped");
    expect(t.play).toEqual(["V14"]);
  });

  it("재개 시에는 해당 단계 멘트만 재생한다 (문서 §5)", () => {
    expect(cuesForResume("time")).toEqual(["V02"]);
    expect(cuesForResume("confirm")).toEqual(["V04"]);
    expect(cuesForResume("count")).toEqual(["V01"]);
  });
});

describe("isComplete", () => {
  it("완료 단계이고 시각이 있어야 저장 가능", () => {
    expect(isComplete(INITIAL_STATE)).toBe(false);
    const done = say(say(INITIAL_STATE, "하루 1번 아침 8시").state, "네");
    expect(done.state.step).toBe("done");
    expect(isComplete(done.state)).toBe(true);
  });
});

describe("stepIndex — 진행 표시", () => {
  it("단계 순서대로 1~4", () => {
    expect(stepIndex("count")).toBe(1);
    expect(stepIndex("time")).toBe(2);
    expect(stepIndex("confirm")).toBe(3);
    expect(stepIndex("done")).toBe(4);
  });
  it("건너뛰면 진행도가 없다", () => {
    expect(stepIndex("skipped")).toBeNull();
  });
  it("총 단계 수와 마지막 번호가 맞는다", () => {
    expect(stepIndex("done")).toBe(GUIDE_TOTAL_STEPS);
  });
});

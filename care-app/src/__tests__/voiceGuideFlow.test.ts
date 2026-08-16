import {
  INITIAL_STATE, cuesForStep, cuesForResume,
  onPickCount, onPickTimes, onAcceptDefaults, onConfirm, onSkip, isComplete,
  stepIndex, GUIDE_TOTAL_STEPS,
} from "../lib/voiceGuideFlow";
import { afterMealTimes } from "../lib/voiceParse";

// 음성 입력을 뺐으므로 모든 입력은 버튼이다.
// 발화 경로(onUtterance / onNoReply / onRecognizeFail) 테스트는 그 함수들과 함께
// 걷어냈다. 되살릴 때는 이 커밋을 revert 하면 테스트도 같이 돌아온다.

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
  it("횟수를 고르면 V07 후 시간 질문으로", () => {
    const t = onPickCount(INITIAL_STATE, 3);
    expect(t.state.step).toBe("time");
    expect(t.state.count).toBe(3);
    expect(t.play).toEqual(["V07", "V02"]);
  });

  it("횟수에 맞는 시간대 칩이 미리 채워진다", () => {
    expect(onPickCount(INITIAL_STATE, 3).state.slots).toEqual(["아침", "점심", "저녁"]);
    expect(onPickCount(INITIAL_STATE, 1).state.slots).toEqual(["아침"]);
  });

  it("고른 횟수를 바꾸면 앞서 정한 시각은 지워진다", () => {
    // 3번으로 시각까지 정해 놓고 뒤로 가 1번으로 바꿨을 때
    // 저녁 시각이 남아 있으면 안 된다.
    const three = onPickTimes(onPickCount(INITIAL_STATE, 3).state, afterMealTimes(["아침", "점심", "저녁"])).state;
    expect(three.times).toHaveLength(3);
    expect(onPickCount(three, 1).state.times).toEqual([]);
  });
});

describe("단계 2 — 시간", () => {
  const atTime = onPickCount(INITIAL_STATE, 3).state;

  it("시각을 확정하면 요약으로", () => {
    const t = onPickTimes(atTime, afterMealTimes(atTime.slots));
    expect(t.state.step).toBe("confirm");
    expect(t.state.times).toHaveLength(3);
    expect(t.play).toEqual(["V04"]);
  });

  it("식후 기본값은 시안의 8시·12시·18시", () => {
    expect(afterMealTimes(["아침", "점심", "저녁"])).toEqual([
      { slot: "아침", hour: 8, minute: 0 },
      { slot: "점심", hour: 12, minute: 0 },
      { slot: "저녁", hour: 18, minute: 0 },
    ]);
  });

  it("기본값 제안(V03)에 '네' → 완료", () => {
    const proposed = { ...atTime, times: afterMealTimes(atTime.slots), proposedDefaults: true };
    const t = onAcceptDefaults(proposed, true);
    expect(t.state.step).toBe("done");
    expect(t.play).toEqual(["V07", "V05", "V06"]);
  });

  it("기본값 제안(V03)에 '다시' → V08 후 시간 질문으로 되돌아간다", () => {
    const proposed = { ...atTime, times: afterMealTimes(atTime.slots), proposedDefaults: true };
    const t = onAcceptDefaults(proposed, false);
    expect(t.state.step).toBe("time");
    expect(t.state.proposedDefaults).toBe(false);
    expect(t.play).toEqual(["V08", "V02"]);
  });

  it("시각을 확정하면 제안 상태가 풀린다", () => {
    // 안 풀면 요약 화면을 지나 돌아왔을 때 V03용 버튼이 남는다.
    const proposed = { ...atTime, times: afterMealTimes(atTime.slots), proposedDefaults: true };
    expect(onPickTimes(proposed, proposed.times).state.proposedDefaults).toBe(false);
  });
});

describe("단계 3 — 요약 확인", () => {
  const atConfirm = onPickTimes(onPickCount(INITIAL_STATE, 1).state,
    [{ slot: "아침", hour: 8, minute: 0 }]).state;

  it("네 → 완료 (V07 후 V05·V06)", () => {
    const t = onConfirm(atConfirm, true);
    expect(t.state.step).toBe("done");
    expect(t.play).toEqual(["V07", "V05", "V06"]);
  });

  it("아니요 → V08 후 시간 단계로 복귀", () => {
    const t = onConfirm(atConfirm, false);
    expect(t.state.step).toBe("time");
    expect(t.play).toEqual(["V08", "V02"]);
  });

  it("되돌아가도 정한 시각은 남아 있다 — 처음부터 다시 하게 만들지 않는다", () => {
    expect(onConfirm(atConfirm, false).state.times).toEqual(atConfirm.times);
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
    const atConfirm = onPickTimes(onPickCount(INITIAL_STATE, 1).state,
      [{ slot: "아침", hour: 8, minute: 0 }]).state;
    const done = onConfirm(atConfirm, true);
    expect(done.state.step).toBe("done");
    expect(isComplete(done.state)).toBe(true);
  });

  it("완료 단계라도 시각이 없으면 저장하지 않는다", () => {
    expect(isComplete({ ...INITIAL_STATE, step: "done", times: [] })).toBe(false);
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

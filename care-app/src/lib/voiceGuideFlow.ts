// 음성 가이드 상태머신 — 순수 로직 (RN/네트워크 의존 없음, jest 대상).
//
// 문서 §4(플로우)를 옮긴 것이다. 화면은 이 함수들이 돌려주는 다음 상태와
// 재생할 멘트를 따르기만 한다. 오디오 재생은 화면이 맡는다.
//
// 음성 입력을 뺐다: 대답은 전부 화면 터치로 받는다. 그래서 문서 §5의 예외 규칙
// (무응답 재안내 V11, 인식 실패 V12·V13, 2회 실패 후 음성 종료)은 성립하지 않아
// 함께 걷어냈다 — 듣지 않는데 "잘 못 들었어요"라고 말할 수는 없다.
// 되돌리려면 이 커밋을 revert 하면 된다 — 함수도 테스트도 함께 돌아온다.
// voiceEcho.ts(에코 필터)는 "지금 재생 중인 멘트를 안다"가 존재 이유였는데
// 들을 일이 없어져 함께 지웠다. voiceParse.ts 는 SLOTS·afterMealTimes 를
// 아직 쓰므로 남겼다.

import { CueId } from "./voiceScript";
import { DoseTime, Slot, defaultSlotsFor } from "./voiceParse";

export type Step =
  | "count"     // 단계 1 — 인사 및 복용 횟수 (V01)
  | "time"      // 단계 2 — 복용 시간 (V02, V03)
  | "confirm"   // 단계 3 — 요약 확인 (V04)
  | "done"      // 단계 4 — 완료 및 위험 분석 제안 (V05 → V06)
  | "skipped";  // 건너뛰기 (V14)

export type GuideState = {
  step: Step;
  count: number | null;
  slots: Slot[];
  times: DoseTime[];
  /** 식후 기본값을 제안한 상태인가 (V03 재생 후 확인 버튼 대기) */
  proposedDefaults: boolean;
};

export const INITIAL_STATE: GuideState = {
  step: "count",
  count: null,
  slots: [],
  times: [],
  proposedDefaults: false,
};

export type Transition = {
  state: GuideState;
  /** 순서대로 재생할 멘트. 빈 배열이면 재생하지 않는다. */
  play: CueId[];
};

function enter(state: GuideState, step: Step, patch: Partial<GuideState> = {}): GuideState {
  return { ...state, ...patch, step };
}

// 각 단계에 들어갈 때 재생할 멘트 (문서 §4).
export function cuesForStep(step: Step): CueId[] {
  switch (step) {
    case "count": return ["V01"];
    case "time": return ["V02"];
    case "confirm": return ["V04"];
    case "done": return ["V05", "V06"]; // 0.8초 간격 연속 재생
    case "skipped": return ["V14"];
  }
}

// 버튼으로 횟수를 골랐을 때.
export function onPickCount(state: GuideState, count: number): Transition {
  const slots = defaultSlotsFor(count);
  return {
    state: enter(state, "time", { count, slots, times: [] }),
    play: ["V07", "V02"],
  };
}

// 버튼/시간 카드로 시각을 확정했을 때.
export function onPickTimes(state: GuideState, times: DoseTime[]): Transition {
  return { state: enter(state, "confirm", { times, proposedDefaults: false }), play: ["V04"] };
}

// 식후 기본값(V03)을 제안받고 "네/다시"를 눌렀을 때.
export function onAcceptDefaults(state: GuideState, ok: boolean): Transition {
  return ok
    ? { state: enter(state, "done"), play: ["V07", ...cuesForStep("done")] }
    : { state: { ...state, proposedDefaults: false }, play: ["V08", "V02"] };
}

// 요약 화면의 버튼.
export function onConfirm(state: GuideState, ok: boolean): Transition {
  return ok
    ? { state: enter(state, "done"), play: ["V07", ...cuesForStep("done")] }
    : { state: enter(state, "time"), play: ["V08", "V02"] };
}

// "나중에 설정할게요" (단계 1~3 어디서든, 문서 §4).
export function onSkip(state: GuideState): Transition {
  return { state: enter(state, "skipped"), play: ["V14"] };
}

// 중간 이탈 후 재개 (문서 §5): V01은 최초 1회만 전체 재생하고,
// 재개할 때는 그 단계의 멘트만 재생한다.
export function cuesForResume(step: Step): CueId[] {
  return step === "count" ? ["V01"] : cuesForStep(step);
}

// 설정이 완결됐는지 — 화면이 저장 버튼을 열지 판단할 때 쓴다.
export function isComplete(state: GuideState): boolean {
  return state.step === "done" && state.times.length > 0;
}

// ── 진행 표시 (시안: 상단 4칸 + "1/4") ─────────────────────────────────────
//
// 화면 단계와 별개로 두는 이유: "skipped"는 중간에 빠져나온 것이라
// 진행도가 없고, "done"은 마지막 칸을 채운 상태다.

export const GUIDE_TOTAL_STEPS = 4;

// 1-based 진행 번호. 진행 표시를 숨겨야 하면 null.
export function stepIndex(step: Step): number | null {
  switch (step) {
    case "count": return 1;
    case "time": return 2;
    case "confirm": return 3;
    case "done": return 4;
    case "skipped": return null;
  }
}

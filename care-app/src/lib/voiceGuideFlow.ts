// 음성 가이드 상태머신 — 순수 로직 (RN/네트워크 의존 없음, jest 대상).
//
// 문서 §4(플로우)와 §5(예외 처리 규칙)를 그대로 옮긴 것이다. 화면은 이 함수들이
// 돌려주는 다음 상태와 재생할 멘트를 따르기만 한다. 타이머·오디오·STT는 화면이 맡는다.
//
// 이렇게 분리한 이유: 예외 규칙(무응답 1회만, 실패 2회 후 음성 종료)은 말로는 간단해도
// 실수하기 쉽다. 화면 코드 안에 흩어 두면 검증할 수 없어 순수 함수로 뽑았다.

import { CueId } from "./voiceScript";
import { DoseTime, Slot, Utterance, defaultSlotsFor, afterMealTimes } from "./voiceParse";

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
  /** 식후 기본값을 제안한 상태인가 (V03 재생 후 "네" 대기) */
  proposedDefaults: boolean;
  /** 이번 단계에서 무응답 안내(V11)를 이미 냈는가 — 문서 §5 "반복 재생 금지" */
  noReplyPrompted: boolean;
  /** 이번 단계 인식 실패 횟수 */
  failCount: number;
  /** 음성 입력을 끝내고 버튼만 받는 상태 (2회 실패 후) */
  voiceOff: boolean;
};

export const INITIAL_STATE: GuideState = {
  step: "count",
  count: null,
  slots: [],
  times: [],
  proposedDefaults: false,
  noReplyPrompted: false,
  failCount: 0,
  voiceOff: false,
};

export type Transition = {
  state: GuideState;
  /** 순서대로 재생할 멘트. 빈 배열이면 재생하지 않는다. */
  play: CueId[];
};

// 단계가 바뀌면 예외 카운터를 초기화한다 — 실패 횟수는 "이번 단계" 기준이다.
function enter(state: GuideState, step: Step, patch: Partial<GuideState> = {}): GuideState {
  return {
    ...state, ...patch, step,
    noReplyPrompted: false, failCount: 0, voiceOff: false,
  };
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

// 발화를 받았을 때. 인식된 정보는 모두 흡수한다 (문서 §5 멀티 정보 발화).
export function onUtterance(state: GuideState, u: Utterance): Transition {
  if (state.step === "count") {
    // 횟수가 안 잡히면 인식 실패로 넘긴다.
    if (u.count === null) return onRecognizeFail(state);

    // 시간대까지 함께 말했으면 그 칩을 채운 채로 단계 2에 들어간다.
    const slots = u.slots.length > 0 ? u.slots : defaultSlotsFor(u.count);
    const next = enter(state, "time", { count: u.count, slots, times: u.times });

    // 시각까지 다 말했으면 단계 2를 건너뛰고 확인으로 간다.
    if (u.times.length > 0 && u.times.length >= u.count) {
      return { state: enter(next, "confirm", { times: u.times }), play: ["V07", "V04"] };
    }
    // 식후 기준까지 말했으면 기본값을 제안한다.
    if (u.afterMeal) {
      return {
        state: { ...next, times: afterMealTimes(slots), proposedDefaults: true },
        play: ["V07", "V03"],
      };
    }
    return { state: next, play: ["V07", "V02"] };
  }

  if (state.step === "time") {
    // 기본값 제안 중이면 "네/아니요"를 먼저 본다.
    if (state.proposedDefaults && u.yesNo !== null) {
      return u.yesNo
        ? { state: enter(state, "done"), play: ["V07", ...cuesForStep("done")] }
        : { state: { ...state, proposedDefaults: false, failCount: 0 }, play: ["V08", "V02"] };
    }
    if (u.times.length > 0) {
      const slots = u.slots.length > 0 ? u.slots : state.slots;
      return { state: enter(state, "confirm", { times: u.times, slots }), play: ["V04"] };
    }
    if (u.afterMeal) {
      const slots = state.slots.length > 0 ? state.slots : defaultSlotsFor(state.count ?? 1);
      return {
        state: { ...state, slots, times: afterMealTimes(slots), proposedDefaults: true, failCount: 0 },
        play: ["V03"],
      };
    }
    // 시간대만 말했으면 칩만 갱신하고 계속 시각을 기다린다.
    if (u.slots.length > 0) {
      return { state: { ...state, slots: u.slots, failCount: 0 }, play: [] };
    }
    return onRecognizeFail(state);
  }

  if (state.step === "confirm") {
    if (u.yesNo === true) return { state: enter(state, "done"), play: ["V07", ...cuesForStep("done")] };
    if (u.yesNo === false) return { state: enter(state, "time"), play: ["V08", "V02"] };
    return onRecognizeFail(state);
  }

  return { state, play: [] };
}

// 5초 무응답 (문서 §5). V11은 단계마다 한 번만 — 이후엔 조용히 버튼을 기다린다.
export function onNoReply(state: GuideState): Transition {
  if (state.noReplyPrompted) return { state, play: [] };
  return { state: { ...state, noReplyPrompted: true }, play: ["V11"] };
}

// 인식 실패 (문서 §5). 1회 V12, 2회 V13 후 음성 입력 종료.
export function onRecognizeFail(state: GuideState): Transition {
  const failCount = state.failCount + 1;
  if (failCount >= 2) {
    return { state: { ...state, failCount, voiceOff: true }, play: ["V13"] };
  }
  return { state: { ...state, failCount }, play: ["V12"] };
}

// 버튼으로 횟수를 골랐을 때 (음성·터치 병행, 문서 §2).
export function onPickCount(state: GuideState, count: number): Transition {
  const slots = defaultSlotsFor(count);
  return {
    state: enter(state, "time", { count, slots, times: [] }),
    play: ["V07", "V02"],
  };
}

// 버튼/시간 카드로 시각을 확정했을 때.
export function onPickTimes(state: GuideState, times: DoseTime[]): Transition {
  return { state: enter(state, "confirm", { times }), play: ["V04"] };
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

// 조건 라벨 → 서버 조건명(name_ko) 확장 검증 — 순수 로직, 네트워크 없음.
import { CONDITION_ALIASES, serverConditionInput } from "../lib/conditionAliases";
import { CONDS, AGES, NONE_CONDITION } from "../lib/quickCheckLabels";

describe("CONDITION_ALIASES — 표 자체", () => {
  it("CONDS·AGES의 모든 라벨(해당 없음 제외)에 항목이 있다 — 버튼을 추가하면 서버 매핑을 정해야 한다", () => {
    for (const label of [...CONDS, ...AGES]) {
      if (label === NONE_CONDITION) continue;
      expect(Object.prototype.hasOwnProperty.call(CONDITION_ALIASES, label)).toBe(true);
    }
  });
  it("해당 없음은 표에 없다", () => {
    expect(Object.prototype.hasOwnProperty.call(CONDITION_ALIASES, NONE_CONDITION)).toBe(false);
  });
  it("임신·수유 중 → 임신 (DB에는 임신만 있다)", () => {
    expect(CONDITION_ALIASES["임신·수유 중"]).toEqual(["임신"]);
  });
  it("신장질환·간질환·연령대는 일부러 비워 둔다(서버에 같은 뜻의 조건이 없다)", () => {
    expect(CONDITION_ALIASES["신장질환"]).toEqual([]);
    expect(CONDITION_ALIASES["간질환"]).toEqual([]);
    for (const age of AGES) expect(CONDITION_ALIASES[age]).toEqual([]);
  });
  it("별칭 목록 안에 중복이 없다", () => {
    for (const aliases of Object.values(CONDITION_ALIASES)) {
      expect(new Set(aliases).size).toBe(aliases.length);
    }
  });
});

describe("serverConditionInput", () => {
  it("원래 라벨을 남기고 별칭을 뒤에 붙인다(임신·수유 중 → + 임신)", () => {
    const r = serverConditionInput({ age: null, conditions: ["임신·수유 중"] });
    expect(r.conditions).toEqual(["임신·수유 중", "임신"]);
    expect(r.uncovered).toEqual([]);
  });
  it("해당 없음은 서버에 보내지 않고 uncovered에도 넣지 않는다", () => {
    const r = serverConditionInput({ age: null, conditions: ["해당 없음"] });
    expect(r.conditions).toEqual([]);
    expect(r.uncovered).toEqual([]);
  });
  it("신장질환은 확장하지 않고 uncovered에 들어간다", () => {
    const r = serverConditionInput({ age: null, conditions: ["신장질환"] });
    expect(r.conditions).toEqual(["신장질환"]);
    expect(r.uncovered).toEqual(["신장질환"]);
  });
  it("연령대는 그대로 넘기되 uncovered에는 넣지 않는다(항상 미반영이라 매번 뜨면 소음)", () => {
    const r = serverConditionInput({ age: "60대 이상", conditions: ["신장질환", "임신·수유 중"] });
    expect(r.age).toBe("60대 이상");
    expect(r.conditions).toEqual(["신장질환", "임신·수유 중", "임신"]);
    expect(r.uncovered).toEqual(["신장질환"]);
  });
  it("age만 있고 조건이 없으면 uncovered는 비어 있다", () => {
    expect(serverConditionInput({ age: "40대", conditions: [] })).toEqual({ age: "40대", conditions: [], uncovered: [] });
    expect(serverConditionInput({ age: null, conditions: [] })).toEqual({ age: null, conditions: [], uncovered: [] });
  });
  it("중복 없이, 순서를 지킨다 — 서버 조건명 자체(임신)는 별칭 없이도 uncovered가 아니다", () => {
    const r = serverConditionInput({ age: null, conditions: ["임신", "임신·수유 중", "임신·수유 중"] });
    expect(r.conditions).toEqual(["임신", "임신·수유 중"]);
    expect(r.uncovered).toEqual([]);
  });
  it("표에 없는 라벨(구버전 초안 등)은 그대로 넘기고 uncovered로 알린다", () => {
    const r = serverConditionInput({ age: null, conditions: ["알 수 없는 조건"] });
    expect(r.conditions).toEqual(["알 수 없는 조건"]);
    expect(r.uncovered).toEqual(["알 수 없는 조건"]);
  });
});

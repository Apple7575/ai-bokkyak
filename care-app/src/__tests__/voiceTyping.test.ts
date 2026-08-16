import { planTyping, splitSentences, DEFAULT_PER_CHAR_MS } from "../lib/voiceTyping";
import { CUES } from "../lib/voiceScript";

describe("splitSentences", () => {
  it("V01을 문장 단위로 쪼갠다", () => {
    const s = splitSentences(CUES.V01.text);
    expect(s.length).toBeGreaterThanOrEqual(3);
    expect(s[s.length - 1]).toBe("아래에서 골라 주세요.");
  });

  it("'안녕하세요.'가 혼자 떨어지지 않는다 — 짧은 조각은 다음 문장에 붙인다", () => {
    const s = splitSentences(CUES.V01.text);
    expect(s[0]).toBe("안녕하세요. 여러분의 복용 비서, 모두의 복약입니다.");
  });

  it("음성 입력을 뺐으므로 어떤 멘트도 발화를 요구하지 않는다", () => {
    for (const cue of Object.values(CUES)) {
      expect(cue.text).not.toContain("말씀해 주세요");
    }
  });

  it("빈 문자열", () => {
    expect(splitSentences("")).toEqual([]);
  });
});

describe("planTyping — 음성 길이에 맞춘다", () => {
  const sents = ["짧은 문장.", "이건 조금 더 긴 문장이에요 그래서 시간이 더 걸립니다."];

  it("총 재생 길이 안에 들어간다", () => {
    const total = 10000;
    const plan = planTyping(sents, total);
    const used = plan.reduce((a, p) => a + p.durationMs + p.holdMs, 0);
    // 하한/상한 보정 때문에 정확히 같진 않지만 크게 벗어나면 안 된다.
    expect(used).toBeLessThanOrEqual(total * 1.05);
  });

  it("긴 문장이 더 오래 걸린다", () => {
    const plan = planTyping(sents, 10000);
    expect(plan[1].durationMs).toBeGreaterThan(plan[0].durationMs);
  });

  it("음성이 길면 천천히 친다 — 타이핑이 먼저 끝나 화면이 멈추지 않게", () => {
    const fast = planTyping(sents, 3000)[0].perCharMs;
    const slow = planTyping(sents, 20000)[0].perCharMs;
    expect(slow).toBeGreaterThan(fast);
  });

  it("너무 빠르거나 느려지지 않게 막는다", () => {
    for (const p of planTyping(sents, 100)) expect(p.perCharMs).toBeGreaterThanOrEqual(24);
    for (const p of planTyping(sents, 9999999)) expect(p.perCharMs).toBeLessThanOrEqual(140);
  });

  it("재생 길이를 모르면 시안 기본 속도(62ms)로 돌아간다", () => {
    for (const t of [null, undefined, 0, -1, NaN]) {
      const plan = planTyping(sents, t as number | null);
      expect(plan[0].perCharMs).toBe(DEFAULT_PER_CHAR_MS);
    }
  });

  it("문장 수만큼 계획이 나온다", () => {
    expect(planTyping(sents, 5000)).toHaveLength(2);
    expect(planTyping([], 5000)).toEqual([]);
  });
});

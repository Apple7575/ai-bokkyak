import { useCallback, useEffect, useRef, useState } from "react";
import { planTyping, splitSentences } from "../lib/voiceTyping";

// 자막을 문장 단위로 타이핑해 보여준다 (시안 "0 온보딩"의 순차 등장).
//
// 핵심은 속도를 실제 음성 길이에 맞추는 것이다. 시안처럼 글자당 62ms로 고정하면
// 20초짜리 V01은 타이핑이 6초 만에 끝나고 남은 14초 동안 화면이 멈춰 있다.
// 그래서 cuePlayer가 알려 준 재생 길이를 planTyping에 넘겨 그 안에 배분한다.
//
// 배분은 mount 시점이 아니라 begin() 호출마다 다시 계산한다 — 멘트마다 길이가 다르다.

type Options = { dropExample?: boolean };

export function useTypedCaption() {
  const [display, setDisplay] = useState("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const runId = useRef(0);

  const clear = useCallback(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  }, []);

  // 타이핑을 시작한다. durationMs가 null이면(길이를 못 읽는 기기) 시안 기본 속도.
  const begin = useCallback((text: string, durationMs: number | null, opts?: Options) => {
    clear();
    const mine = ++runId.current;
    const sentences = splitSentences(text, { dropExample: opts?.dropExample });
    if (sentences.length === 0) { setDisplay(""); return; }

    const plan = planTyping(sentences, durationMs);
    let at = 0; // 지금까지 누적된 시각(ms)

    sentences.forEach((sentence, si) => {
      const p = plan[si];
      for (let i = 1; i <= sentence.length; i++) {
        const when = at + i * p.perCharMs;
        timers.current.push(setTimeout(() => {
          if (mine !== runId.current) return; // 그 사이 새 멘트가 시작됨
          // 앞 문장들은 그대로 두고 현재 문장만 늘려 간다 — 시안처럼 쌓이며 보인다.
          setDisplay([...sentences.slice(0, si), sentence.slice(0, i)].join("\n"));
        }, when));
      }
      at += p.durationMs + p.holdMs;
    });
  }, [clear]);

  // 즉시 전문을 보여준다. barge-in으로 멘트를 끊었을 때 반쯤 친 자막이 남지 않게.
  const finish = useCallback((text: string, opts?: Options) => {
    clear();
    runId.current++;
    setDisplay(splitSentences(text, { dropExample: opts?.dropExample }).join("\n"));
  }, [clear]);

  useEffect(() => clear, [clear]);

  return { display, begin, finish };
}

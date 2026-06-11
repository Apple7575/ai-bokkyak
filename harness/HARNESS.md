# 케어(CARE) 실행 하네스 — Subagent + Codex 교차 리뷰

이 문서는 `docs/superpowers/plans/2026-06-11-care-mvp.md`를 실행할 때 따르는
**운영 절차**다. 컨트롤러(메인 Claude)가 태스크마다 서브에이전트를 띄우고,
각 태스크 끝에서 **다른 AI(OpenAI Codex)** 로 교차 리뷰를 받는다.

## 역할

| 역할 | 누가 | 도구 |
|------|------|------|
| 컨트롤러 | 메인 Claude (이 세션) | Agent 디스패치, TodoWrite |
| 구현자 | Claude 서브에이전트 (태스크마다 새로) | TDD, 커밋 (`implementer-prompt.md`) |
| 스펙 리뷰어 | Claude 서브에이전트 | `spec-reviewer-prompt.md` |
| 품질 리뷰어 | Claude 서브에이전트 | `code-quality-reviewer-prompt.md` |
| **교차 리뷰어** | **OpenAI Codex** | `harness/codex-review.sh` |

다른 AI로 리뷰하는 이유: 같은 모델은 같은 사각지대를 공유한다. Codex가
Claude가 놓친 버그·스펙 위반을 독립적으로 잡는다.

## 사전 준비 (1회)

1. `codex login` — Codex가 OpenAI 계정으로 인증돼 있어야 함.
2. 구현은 `main`이 아닌 브랜치에서: `git switch -c feat/care-mvp`.
3. 키/계정 게이트(네트워크·크리덴셜 필요)는 컨트롤러가 사람에게 넘긴다:
   - Task 0: `npx create-expo-app` (네트워크)
   - Task 2: Supabase 프로젝트 생성 + `schema.sql` 실행 + URL/anon key
   - 키: `app.json`의 `openaiApiKey`, `supabaseUrl`, `supabaseAnonKey`

## 태스크별 루프

```
1. 구현자 서브에이전트 디스패치 (플랜의 태스크 전문 + 컨텍스트 제공)
      → TDD로 구현, 테스트 통과, 커밋, 자기리뷰
2. 스펙 리뷰어 서브에이전트 (Claude)
      → 스펙과 일치? 아니면 구현자가 수정 → 재리뷰
3. 품질 리뷰어 서브에이전트 (Claude)
      → 승인? 아니면 구현자가 수정 → 재리뷰
4. ▶▶ Codex 교차 리뷰  (다른 AI)
      harness/codex-review.sh "Task N: 제목"
      → exit 0(APPROVE): 다음 단계
      → exit 1(CHANGES_REQUESTED): harness/reviews/<task>.md 의 지적을
        같은 구현자 서브에이전트에게 전달 → 수정 → Codex 재리뷰
5. TodoWrite에서 태스크 완료 표시 → 다음 태스크
```

핵심 규칙:
- 한 번에 구현자 1명만. 병렬 구현 금지(충돌).
- 서브에이전트는 플랜 파일을 읽지 않는다 — 컨트롤러가 태스크 전문을 붙여 준다.
- 어떤 리뷰든 미해결 지적이 있으면 다음 태스크로 넘어가지 않는다.
- Codex가 CHANGES_REQUESTED면 반드시 수정 후 재리뷰(스킵 금지).

## Codex 교차 리뷰 사용법

```bash
# 직전 커밋(태스크 1개=커밋 1개)을 리뷰
harness/codex-review.sh "Task 4: intent classifier"

# 한 태스크가 커밋 여러 개면 base를 태스크 시작 SHA로
BASE=<task-start-sha> harness/codex-review.sh "Task 7: voice + AI modules"

# 커밋 전 워킹트리 상태로 리뷰하고 싶으면
MODE=uncommitted harness/codex-review.sh "Task 9: components"
```

리뷰 결과는 `harness/reviews/<task>.md`에 저장되어 추적 가능하다.

## 전체 완료 후

1. 마지막으로 전체 구현에 대한 Codex 리뷰: `BASE=main harness/codex-review.sh "Full MVP"`.
2. `superpowers:finishing-a-development-branch`로 브랜치 마무리(머지/PR).

## 공유 규칙

구현자·리뷰어·Codex가 모두 같은 규칙을 보도록 `AGENTS.md`(Codex) /
`CLAUDE.md`(Claude)에 핵심 결정과 컨벤션을 적어 둔다. 두 파일이 어긋나지 않게
`CLAUDE.md`는 `AGENTS.md`를 import 한다.

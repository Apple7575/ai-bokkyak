# AGENTS.md — 케어(CARE) 프로젝트 규칙

고령층을 위한 복약 관리 MVP (안내는 음성, 입력은 화면 터치). 구현자(Claude 서브에이전트)와
교차 리뷰어(OpenAI Codex)가 **공유**하는 규칙. 어기면 리뷰에서 막힌다.

## 무엇을 만드는가

- **앱:** React Native + Expo (managed), TypeScript. 코드는 `care-app/`에 있다.
- **백엔드:** Supabase Postgres, **인증 없음**. 쓰는 사람은 본인(환자) 한 종류다.
  **보호자 기능은 없다** — 6자리 `patient_code`로 보호자가 읽기 전용 열람하는
  기능은 회의 결정으로 제거됐다. 되살리자는 제안을 하지 말 것. 코드에도 흔적이
  없어야 한다(`patient_code`, 역할 구분, 코드 입력 화면).
- **음성:** **출력(TTS) 전용이다. 음성 인식(STT)은 없다.**
  앱이 읽어 주고, 사용자는 화면 버튼으로 답한다. 회의 결정으로 음성 AI를 전부
  제거했다 — AI 건강전화(Realtime + WebRTC), 음성으로 약 등록, 온보딩 음성 응답.
  되살리자는 제안을 하지 말 것. 코드에 마이크·녹음·음성 인식 흔적이 없어야 한다
  (`RECORD_AUDIO`, `NSMicrophoneUsageDescription`, `expo-speech-recognition`,
  `react-native-webrtc`, `?op=realtime-token`).
  TTS 경로는 세 가지다: 엣지 함수 `?op=tts`(문장 → mp3, `lib/tts.ts`),
  미리 만들어 둔 안내 mp3(`lib/cuePlayer.ts`), 알람 소리 mp3(`lib/alarmRinger.ts`).
- **알림:** `expo-notifications` 로컬 예약 알림.

설계 문서: `docs/superpowers/specs/2026-06-11-care-mvp-design.md`
실행 플랜: `docs/superpowers/plans/2026-06-11-care-mvp.md`

## 절대 어기면 안 되는 3가지 설계 결정

1. **repeat_days = 빈 배열 `[]` 은 "매일"** 을 뜻한다. GPT가 돌려주는 문자열
   `"매일"` 은 `normalizeRepeatDays()` 로 `[]` 가 되어야 한다. 요일 배열은
   정렬·중복제거된 `int[]`(0=일 … 6=토).
2. **intake_records 쓰기는 반드시 upsert**, `onConflict: "schedule_id,scheduled_for"`.
   알림 재발화/재탭으로 같은 (schedule, 시각)에 **중복 행이 생기면 안 된다.**
   스키마에 `unique (schedule_id, scheduled_for)` 존재.
3. **알람 화면·복약 확인의 응답은 화면 터치로만 받는다.** 음성 인식을 다시
   붙이지 말 것. (`intent.ts`의 의도 분류 우선순위 재알림 > 미복용 > 복용완료 >
   인식실패는 음성을 되살릴 때를 대비해 테스트와 함께 남겨 뒀을 뿐, 지금은
   화면에서 쓰이지 않는다.)

## 코드 컨벤션

- TTS는 좁은 교체 가능 인터페이스 뒤에 둔다(`lib/tts.ts`). 나중에 더 좋은
  모델로 바꿀 때 이 파일만 교체. 화면이 음성 SDK를 직접 호출하지 말 것.
- **소리가 버튼을 막으면 안 된다.** TTS 재생·저장·재예약을 하나의 `await`로 묶어
  입력을 잠그지 말 것. 선택은 즉시 반영하고 나머지는 뒤에서 처리한다
  (QA 2026-08-20에서 알림 소리 설정·음성 속도 설정이 이 문제로 지적됐다).
- 순수 로직(`intent.ts`, `schedule.ts`, `parse.ts`)은 RN/네트워크 의존이 없어야
  하고 jest로 단위 테스트한다. 화면·음성·알림은 실기기 수동 검증.
- 디자인 토큰은 `src/theme/tokens.ts`에서만 가져온다. 색·폰트 하드코딩 금지.
  고령층 대상: 본문 ≥18px, 주요 버튼 높이 ≥56px.
- 비동기 호출에 `await` 빠뜨리지 말 것. Supabase/`fetch` 에러는 삼키지 말고
  사용자에게 토스트/Alert로 노출하고 버튼 경로로 폴백.
- 모든 사용자 노출 문구는 한국어.

## 테스트 / 검증

```bash
cd care-app
npm test            # jest: intent / schedule / parse
npx tsc --noEmit    # 타입 체크
```

## 보안 한계 (의도적, MVP)

- API 키가 클라이언트(`app.json` extra)에 있다 — 데모용. 운영 시 서버 뒤로 이동.
- 인증 없음, 코드 기반 연결 — 운영 시 Supabase Auth + RLS로 강화.
이 한계는 알고 수용한 것이니 리뷰에서 "키를 노출했다"는 식의 지적은 불필요.
대신 **위 3개 설계 결정 위반·정확성 버그**에 집중하라.

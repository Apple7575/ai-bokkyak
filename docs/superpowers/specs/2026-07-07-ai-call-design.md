# AI 건강전화 (실시간 음성 대화) — 설계

2026-07-07. OpenAI Realtime API + WebRTC로 앱 내 "AI 건강전화"를 자체 구현한다.
기존에 외부 AI 콜 서비스로 시연하던 기능의 대체. 목표: **실시간 반응 +
말 끊고 끼어들기(barge-in)** 가 되는 한국어 음성 통화, 통화 중 복약 확인
결과를 `intake_records`에 기록.

## 결정 요약

| 항목 | 결정 | 이유 |
|---|---|---|
| 음성 엔진 | OpenAI Realtime API (`gpt-realtime-2.1`) | WebRTC 네이티브 지원 → RN에서 마이크/재생/AEC 해결. 기존 OpenAI 키·에지 함수 프록시 재사용 |
| 연결 | WebRTC (`react-native-webrtc`) | WebSocket(PCM 직접 스트리밍) 대비 에코 캔슬레이션 내장 — 스피커폰 barge-in 필수 조건 |
| 인증 | Supabase Edge Function `ai`에 `?op=realtime-token` 추가 → 임시 키(client secret) 발급 | OpenAI 키는 서버 시크릿 유지 (기존 `op=tts/parse/ocr` 패턴 동일) |
| 교체 가능성 | 화면은 `lib/realtimeCall.ts`의 좁은 인터페이스만 사용 | 나중에 Gemini Live(더 저렴) 등으로 갈아탈 때 이 파일만 재구현 (AGENTS.md의 tts/stt 규칙과 동일 사상) |
| 통화 시간 | 최대 3분, 클라이언트 타이머로 강제 종료 | 비용 상한 + 제품 컨셉("하루 3분 건강전화") |
| 진입점 | 홈 화면 "AI 건강전화" 버튼 → `Call` 화면 | MVP는 수동 발신. 예약 자동 발신(알람 풀스크린 재활용)은 후속 사이클 |

## 아키텍처

```
[CallScreen] --startCall()--> [lib/realtimeCall.ts]
                                │ 1. POST {SUPABASE}/functions/v1/ai?op=realtime-token
                                │    (환자 이름 + 오늘 복약 목록 전달)
                                │    ← { value: "ek_...", model }
                                │ 2. getUserMedia(audio) + RTCPeerConnection
                                │ 3. POST https://api.openai.com/v1/realtime/calls
                                │    (Content-Type: application/sdp, Bearer ek_...)
                                │ 4. DataChannel "oai-events" ← 자막/도구호출 이벤트
                                ▼
                        onEvent 콜백 → CallScreen (자막 표시, 도구 실행)
```

### 서버 (`supabase/functions/ai/index.ts`, `op=realtime-token`)

- 입력: `{ patientName?: string, meds?: [{ medicine_name, time_of_day, taken?: boolean }] }`
- 한국어 instructions 빌더: 고령자 대상 존댓말·짧은 문장·천천히, 흐름은
  인사 → 오늘 복약 확인(전달받은 약 목록 기준) → 안부/컨디션 → 마무리 인사.
  3분 이내 마무리하도록 명시. 복약 답변을 들으면 반드시 `record_medication`
  도구를 호출하고, 대화를 끝낼 땐 `end_call`을 호출하라고 명시.
- tools (function calling, 실행은 클라이언트):
  - `record_medication({ medicine_name: string, time_of_day: "아침|점심|저녁|취침", status: "복용함"|"안먹음" })`
  - `end_call({})`
- `POST https://api.openai.com/v1/realtime/client_secrets` 호출:

```json
{
  "session": {
    "type": "realtime",
    "model": "gpt-realtime-2.1",
    "instructions": "<빌더 출력>",
    "audio": { "output": { "voice": "marin" } },
    "tools": [ ...위 2개... ]
  }
}
```

- 반환: `{ value, model }`. 실패 시 `{ error, detail }` 502 (기존 op와 동일).
- `model`/`voice`는 body로 override 가능(기존 tts op 패턴).

### 클라이언트 코어

- 신규 의존성: `react-native-webrtc`, `@config-plugins/react-native-webrtc`
  (app.json plugins 등록), `react-native-incall-manager`(스피커폰 라우팅).
  **네이티브 모듈 → dev client 재빌드 필요(사람 게이트).**
- `lib/realtimeCall.ts` — 좁은 인터페이스. 화면이 WebRTC/SDK를 직접 만지지 않는다:

```ts
export type CallState = "connecting" | "active" | "ended" | "error";
export type CallEvent =
  | { type: "state"; state: CallState; message?: string }
  | { type: "ai-transcript"; text: string; final: boolean }
  | { type: "user-transcript"; text: string }
  | { type: "tool-call"; name: string; argsJson: string; callId: string };
export type CallHandle = {
  end(): Promise<void>;
  sendToolResult(callId: string, output: string): void; // 도구 실행 결과 회신 + response.create
};
export function startCall(opts: {
  patientName?: string;
  meds: CallMed[];
  onEvent: (e: CallEvent) => void;
}): Promise<CallHandle>;
```

  - 내부: 토큰 발급 → `mediaDevices.getUserMedia({audio:true})` →
    `RTCPeerConnection` + 오디오 트랙 → `createDataChannel("oai-events")` →
    offer SDP POST → answer 적용. InCallManager로 스피커폰 on, 종료 시 원복.
  - 데이터 채널 이벤트 매핑(방어적으로 — 미지의 타입은 무시):
    `response.output_audio_transcript.delta/.done` → ai-transcript,
    `conversation.item.input_audio_transcription.completed` → user-transcript,
    `response.done`의 output 중 `function_call` 항목 → tool-call.
  - `sendToolResult`: `conversation.item.create`(type `function_call_output`) 전송
    후 `response.create` 전송.
  - 정리(cleanup)는 멱등: 트랙 stop, PC close, InCallManager stop. 어느 단계에서
    실패해도 자원 누수 없이 `state: "error"` 이벤트.
- `lib/callTools.ts` — **순수 로직(RN/네트워크 의존 없음, jest)**:
  - `parseRecordMedicationArgs(json: string)` → 검증된 args | null
  - `matchSchedule(schedules, args)` → 약명(부분일치·공백무시) + time_of_day로
    스케줄 찾기. 약명만 맞으면 그것으로 폴백, 없으면 null.
  - `toolStatusToIntake("복용함") === "completed"`, `("안먹음") === "missed"`
  - `buildMedsContext(schedules, todayRecords)` → 서버로 보낼 오늘 복약 요약

### 화면 (`screens/CallScreen.tsx`)

- 흐름: 진입 즉시 `startCall` → "연결 중…" → active 시 "통화 중 mm:ss" 카운트.
- 자막 영역: AI 최근 발화 + 사용자 최근 발화 (본문 ≥18px, 토큰만 사용).
- 종료 버튼: 빨간 "통화 종료" (높이 ≥56px). `end_call` 도구 수신 시에도 종료.
- 3분 도달 시 자동 종료 + "오늘 통화가 끝났어요" 안내.
- `tool-call(record_medication)` 수신 →
  `matchSchedule` → 기존 `recordIntake`(**upsert, onConflict schedule_id,scheduled_for —
  고정 결정 #2**) 호출, `scheduledFor`는 매칭된 스케줄의 오늘 회차(`doseSlot` 사용),
  `method: "음성"`. 성공/실패를 `sendToolResult`로 회신(실패도 회신해 AI가 말로 안내).
  매칭 실패 시 "해당 약을 찾지 못했습니다" 회신 — 기록은 하지 않는다.
- 실패 처리: 토큰/연결 실패 시 Alert + 화면에 재시도·닫기 버튼(버튼 경로 폴백).
  에러를 삼키지 않는다.
- 통화 진입 시 `stopSpeaking()`(기존 TTS 정지), 알람 화면과의 동시 사용은
  고려하지 않는다(MVP).

## 범위 제외 (후속)

- 예약 자동 발신(알람 풀스크린 연출로 "전화 오는" UX), 보호자 리포트 연동,
  이상 응답 감지 알림, Gemini Live 교체 평가.

## 검증

- jest: `callTools` 순수 로직. `npx tsc --noEmit` 통과.
- WebRTC 통화·barge-in·스피커 라우팅·도구 기록은 **실기기 수동 검증**
  (dev client 재빌드 후): 연결, 자막, 끼어들기, "먹었어요" → intake_records
  upsert 1행, 3분 자동 종료.

## 사람 게이트

1. `supabase functions deploy ai` 재배포 (OPENAI_API_KEY 시크릿은 기존 그대로).
2. 네이티브 모듈 추가로 **dev client 재빌드** (`eas build --profile preview` 등).
3. 실기기 수동 검증.

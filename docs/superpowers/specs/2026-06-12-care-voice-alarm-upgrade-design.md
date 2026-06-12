# 케어(CARE) 음성·알림 고도화 — 설계 문서

**작성일:** 2026-06-12
**상태:** 승인 대기 (브레인스토밍 산출물)
**대상:** 기존 `feat/care-mvp` 브랜치의 RN(Expo SDK 54) 앱 `care-app/`

---

## 1. 목적 (한 줄)

> 고령층 **사용성**을 끌어올리기 위해 ① 실시간 STT(말하는 중 글자가 보임) ② 자연스러운 TTS(기계음 탈피) ③ 놓치지 않는 전체화면 알람을 도입한다.

---

## 2. 배경 / 현재 상태

- 현재 STT: `expo-av`로 녹음 → Supabase Edge Function `ai?op=transcribe` → OpenAI Whisper → 텍스트. **배치 방식**(말 다 하고 버튼 눌러야 결과).
- 현재 TTS: `expo-speech`(OS 기본). **기계음**.
- 현재 알림: `expo-notifications` 로컬 예약. **일반 배너 알림**(놓치기 쉬움).
- 배포: 독립 빌드(EAS Build APK). 이미 Expo Go를 벗어났으므로 **네이티브 모듈 사용 가능**.

---

## 3. 확정된 결정 (브레인스토밍)

| 항목 | 선택 | 비고 |
|------|------|------|
| STT | **온디바이스 `expo-speech-recognition`** | 실시간 부분 결과(interim). 추후 소니옥스 등 클라우드로 교체 가능 |
| TTS | **OpenAI TTS** (`/v1/audio/speech`, `tts-1`, voice `nova`) | 기존 엣지 함수 프록시에 `op=tts` 추가. 키는 서버에만 |
| 알람 | **Notifee 전체화면 알람** (`@notifee/react-native`) | Android full-screen intent. iOS는 제한 → 보완책 |
| 플랫폼 우선 | **Android** | 전체화면 알람이 Android에서만 완전 동작 |

### 핵심 전제

세 기능 모두 **네이티브 모듈**을 추가하므로 **새 EAS 빌드가 필요**하다. 현재 배포된 APK로는 동작하지 않으며, 이 고도화는 **새 빌드를 다시 배포**하는 것을 전제로 한다. 네이티브 추가 이후의 JS-only 변경은 EAS Update OTA로 반영되지만, 네이티브 변경은 재빌드 + 재설치가 필요하다.

---

## 4. 아키텍처 개요

기존 스왑 가능 인터페이스(`lib/stt.ts`, `lib/tts.ts`)와 엣지 함수 프록시 패턴을 유지·확장한다.

```
[마이크 화면들] ──useSpeechToText()──▶ expo-speech-recognition (온디바이스, 실시간 partial)
                                         └─ 최종 텍스트 → classifyIntent | (등록 시) 엣지 함수 op=parse(GPT)

[TTS speak(text)] ──▶ 엣지 함수 ai?op=tts ──▶ OpenAI TTS ──▶ mp3 ──▶ expo-audio 재생

[알람 예약] ──▶ lib/notifications (Notifee) ──▶ full-screen intent ──▶ Alarm 화면(scheduleId)
```

새 의존성: `expo-speech-recognition`, `@notifee/react-native`. **`expo-av`는 TTS mp3 재생용으로 유지**(이미 설치됨, SDK54 호환), STT 녹음 용도에서는 제거.

---

## 5. 구성 요소별 설계

### 5-1. 실시간 STT (`lib/stt.ts` 교체)

- `expo-speech-recognition` 도입(config plugin + 권한). 기존 `startRecording()`/`stopAndTranscribe()`를 **`useSpeechToText()` 훅**으로 대체:
  - 노출: `transcript`(실시간 갱신 문자열), `listening`(boolean), `start()`, `stop()`, `onFinal(text)` 콜백(또는 `final` 상태).
  - 내부: `ExpoSpeechRecognitionModule.start({ lang: "ko-KR", interimResults: true, continuous: false })`, `result` 이벤트에서 `results[0].transcript`와 `isFinal`을 받아 상태 갱신. `end` 또는 `isFinal`에서 최종 처리.
- **마이크 화면 UX 변경** (3곳):
  - **AlarmScreen / STTResponseScreen**: 마이크 누름 → `transcript`가 화면에 실시간 표시 → 발화 종료(자동) 시 최종 텍스트로 `classifyIntent` → 복용완료/미복용/재알림 분기(기존 로직). 버튼 3개는 폴백으로 유지.
  - **VoiceRegisterScreen**: 마이크 누름 → 실시간 표시 → 종료 시 최종 텍스트를 엣지 함수 `op=parse`(GPT)로 → 확인 카드(기존). Whisper 불필요.
- **엣지 함수 `op=transcribe`(Whisper)는 제거** — 더 이상 사용 안 함.
- `classifyIntent`/`parse` 등 순수 로직은 변경 없음.

### 5-2. TTS 고도화 (`lib/tts.ts` + 엣지 함수 `op=tts`)

- **엣지 함수 `ai`에 `op=tts` 추가**:
  - 입력: JSON `{ text: string, speed?: number }`.
  - OpenAI `POST /v1/audio/speech` body: `{ model: "tts-1", voice: "nova", input: text, response_format: "mp3", speed: speed ?? 0.9 }`.
  - 응답: mp3 바이너리를 그대로 반환(`Content-Type: audio/mpeg`). 키는 서버 시크릿 `OPENAI_API_KEY` 사용.
- **`lib/tts.ts`**:
  - `speak(text: string): Promise<void>` (async로 변경) — 엣지 함수에서 mp3 받아 캐시 디렉터리에 파일로 저장 → `expo-av`(Audio.Sound)로 재생.
  - 동일 텍스트는 파일 캐시(텍스트 해시 키)로 재요청 절감.
  - `stopSpeaking()` — 재생 중지.
  - 인터페이스명 유지(스왑 가능). 화면들은 `speak()` 호출부를 `await`로 소폭 조정.
- 안내 멘트(기존: "○○ 드실 시간입니다", "복약 완료로 기록했습니다" 등)는 그대로 사용하되 자연스러운 음성으로 출력.

### 5-3. 전체화면 알람 (`lib/notifications.ts` + Notifee)

- `@notifee/react-native` 추가(config plugin + 권한).
- `lib/notifications.ts`의 `scheduleReminders`/`scheduleSnooze`를 Notifee로 교체:
  - Android 채널: importance HIGH, 알람 사운드(반복), 진동.
  - 트리거 알림: `TriggerType.TIMESTAMP`(또는 반복) + `android.fullScreenAction`(잠금화면에서도 전체화면으로 앱 실행) + `android.pressAction`(탭 시 앱 열기) + `android.ongoing`(지속) + 사운드 루프.
  - 반복(매일/요일): Notifee 반복 트리거 또는 발화 시 다음 발생 예약. **다음 발생 시각 계산은 기존 `schedule.ts`(`nextNotificationTime`/요일) 재사용**.
  - 재알림(+30분): 기존과 동일하게 일회성 트리거.
- **앱의 알람 진입 처리**: Notifee `onForegroundEvent`/`onBackgroundEvent`에서 `pressAction`/`fullScreenAction` 감지 → `data.scheduleId`로 **Alarm 화면 진입**(기존 navRef 패턴과 통합). 콜드스타트 시 `getInitialNotification()` 처리.
- 권한: `POST_NOTIFICATIONS`, `USE_FULL_SCREEN_INTENT`, `SCHEDULE_EXACT_ALARM`.
- **iOS 한계**: 진짜 전체화면 알람 불가(Apple 정책). iOS는 time-sensitive 알림 + 사운드 + 재알림으로 보완. 완전한 전체화면 알람은 **Android 전용**으로 명시.

---

## 6. 데이터 / 스키마 영향

- **없음.** Supabase 스키마(patients/schedules/intake_records) 변경 없음. 기존 dedup(upsert on `(schedule_id, scheduled_for)`), repeat_days, doseSlot 규칙 그대로 적용.

---

## 7. 오류 처리

| 상황 | 처리 |
|------|------|
| 음성 인식 권한 거부 | 버튼 폴백 + 한국어 Alert(기존 패턴) |
| STT 인식 실패/빈 결과 | "다시 말씀해 주세요" + 버튼 노출(기존) |
| TTS 엣지 함수 실패/네트워크 없음 | 음성 재생 생략하고 화면 텍스트로 진행(앱 흐름은 막지 않음), 필요 시 토스트 |
| 알림 권한/정확알람 권한 거부 | 앱 내 안내 + 설정 유도, 일반 알림으로 폴백 |
| Notifee 전체화면 미지원(iOS) | time-sensitive 알림 + 사운드로 폴백 |

---

## 8. 테스트 전략

- **순수 로직 단위 테스트(jest, 기존 21개 유지)**:
  - 신규: TTS 캐시 키 함수(텍스트 → 안정적 해시/파일명), 알람 다음-발생 시각 매핑(기존 `schedule.ts` 재사용 검증).
  - 기존 intent/schedule/parse 그대로 통과.
- **실기기(Android) 수동 검증**: 실시간 partial 표시, TTS 자연스러운 재생, 잠금화면 전체화면 알람 발화, 알람 탭 → Alarm 화면 진입, 콜드스타트 진입.
- 각 네이티브 변경마다 EAS 빌드 후 실기기 확인.

---

## 9. 범위 밖 (YAGNI / 향후)

- TTS 음성 선택 UI(현재 `nova` 고정), ElevenLabs/구글·Azure TTS.
- 소니옥스 등 클라우드 스트리밍 STT(온디바이스 정확도 부족 확인 시 교체).
- iOS critical-alert 엔타이틀먼트(Apple 승인 필요).
- 자유 대화형 음성 AI, OCR, 복약률 분석 등(별도 고도화 주제).

---

## 10. 구현 영향 파일 (요약)

- 교체: `care-app/src/lib/stt.ts`(훅 기반), `care-app/src/lib/tts.ts`(async/cloud), `care-app/src/lib/notifications.ts`(Notifee)
- 수정: `care-app/src/screens/AlarmScreen.tsx`, `STTResponseScreen.tsx`, `VoiceRegisterScreen.tsx`(실시간 transcript UI + await speak), `care-app/App.tsx`(Notifee 이벤트 핸들러 통합)
- 엣지 함수: `care-app/supabase/functions/ai/index.ts`(`op=tts` 추가, `op=transcribe` 제거)
- 설정: `app.json`(plugins/권한 추가), `package.json`(expo-speech-recognition, @notifee/react-native)
- 신규(선택): `care-app/src/hooks/useSpeechToText.ts`, TTS 캐시 유틸 + 테스트

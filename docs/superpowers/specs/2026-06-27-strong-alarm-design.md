# 강한 복약 알람 + 음성/온보딩/가입 수정 설계

**목표:** 고령층이 폰과 떨어져 있어도 놓치지 않도록, 복약 알람을 "응답할 때까지 계속 강하게 울리는" 알람시계 수준으로 강화한다. 더불어 온보딩/가입/음성등록의 작은 사용성 결함을 수정한다.

**핵심 방향(피드백 원문):** 진동 모드여도 지속적으로 울리고(진동 + 소리), 잠금 상태에서 앱이 자동으로 풀스크린으로 떠서 계속 울리며, "잠시 미루기"로 다시 알림을 예약할 수 있어야 한다.

**아키텍처 요약:** 플랫폼 분리 알람.
- **Android:** Notifee 포그라운드 서비스 + `loopSound` + 풀스크린 인텐트 + 강한 반복 진동.
- **iOS:** 30초 간격 반복 알림 버스트(Time-Sensitive) + 알림 진입 시 인앱 소리 루프. (무음 관통용 Critical Alerts는 **이번 범위 밖** — 추후 애플 신청.)

**기술 스택:** React Native + Expo (managed, EAS prebuild/config-plugin), TypeScript, `@notifee/react-native`, `expo-av`, RN `Vibration` API, JS 휠 컴포넌트(미루기 피커).

---

## 1. 알람 동작 흐름 (상태 머신)

```
복약 시각 도달
  ├─ [Android] 포그라운드 서비스 알림 발사
  │     · loopSound=true (알림음 무한 루프)
  │     · 강한 진동 패턴 반복 (서비스 러너에서 Vibration 루프)
  │     · category=ALARM, importance=HIGH, fullScreenAction
  │     → 잠금화면 위로 알람 화면 자동 표시(풀스크린 권한 허용 시)
  │
  ├─ [iOS] 30초 간격 반복 알림 버스트를 "미리" 예약 (예: 6개 ≈ 3분)
  │     · interruptionLevel = timeSensitive
  │     · 각 알림은 1회 재생(iOS는 사운드 루프 불가)
  │     → 사용자가 알림을 누르면 앱 진입
  │
  └─ 알람 화면(AlarmScreen, 공통)
        · 진입 즉시 소리 루프(expo-av isLooping) + 연속 진동(Vibration repeat)
        · 응답 전까지 계속, 최대 ~2.5분 후 자동 정지(서비스/루프 stop)
        · 자동 정지 후에도 무응답이면 기존 30초 반복 체인이 재발사
        · 버튼:
            [지금 약 먹기]      → completed 기록 + 즉시 정지
            [안 먹고 건너뛰기]   → skipped 기록 + 즉시 정지
            [잠시 미루기]        → 미루기 피커 화면으로
```

**정지(stop) 정의(공통 헬퍼):** 응답·화면진입·자동타임아웃 시 → ① Notifee 포그라운드 서비스 중지(`stopForegroundService`) ② expo-av 루프 정지 ③ `Vibration.cancel()` ④ 반복 알림 체인(`-rep`) 취소 ⑤ 해당 scheduleId의 표시 알림 제거.

---

## 2. Android 구현 (Notifee 포그라운드 서비스)

- **포그라운드 서비스 등록:** 앱 진입점(`index.ts`)에서 `notifee.registerForegroundService(runner)` 등록. 러너는 (a) 강한 진동 패턴을 일정 간격으로 반복하고 (b) 최대 지속시간(~2.5분) 후 `stopForegroundService()`로 자가 종료하며 (c) 외부 정지 신호(응답)에도 종료한다.
- **알람 알림 표시:** 발사 시 `android: { asForegroundService: true, loopSound: true, channelId, category: ALARM, importance: HIGH, fullScreenAction, pressAction, actions, ongoing: true, autoCancel: false, vibrationPattern: [강한 패턴] }`.
- **채널:** 시간대별 채널(아침/점심/저녁/취침) + 알람 사운드(번들 mp3) + `vibration: true`. 알람음은 시간대 음성 mp3 유지.
- **정확 발사:** 기존 `alarmManager: { allowWhileIdle: true }`(권한 있을 때) 유지.
- **무음모드 관통:** 1차로 `category=ALARM` 채널에 의존. 실기기 테스트에서 진동모드 무음이면 → 커스텀 네이티브(STREAM_ALARM)는 후속(범위 밖).

## 3. iOS 구현 (반복 알림 버스트)

- 발사 시점에 **N개(기본 6개, 30초 간격) 알림을 미리 예약**. 각 알림 `ios: { interruptionLevel: 'timeSensitive', sound: '<tod>.mp3' }`.
- 응답(완료/건너뛰기/미루기/앱진입) 시 **남은 버스트 알림 전부 취소**.
- 앱 진입(알림 탭) 후 AlarmScreen에서 **인앱 소리 루프 + 진동**으로 보강.
- **Time-Sensitive 엔타이틀먼트** 추가. Critical Alerts(무음 관통)는 추후 애플 신청 — 이번 범위 밖.

## 4. 잠시 미루기 피커 + 카운트다운 화면 (참고 이미지 재현)

**미루기 피커(SnoozePickerScreen 또는 모달):**
- 상단 탭: **[기간] / [정확한 시간]**.
  - 기간: 분 스크롤 휠(JS 휠 컴포넌트, 추가 네이티브 X). 기본 5분.
  - 정확한 시간: 시 + 분 휠.
- 큰 기본 버튼: **"○분 후에 다시 알림"** (또는 "○시 ○분에 다시 알림").
- 하단 프리셋 버튼: **10분 · 30분 · 1시간**.
- 확정 → 스누즈 알림 예약(기존 `scheduleSnooze` 확장: 임의 분/정확시각 지원, 시간대 tod 유지) → 카운트다운 화면으로.

**카운트다운 화면(SnoozeCountdownScreen):**
- "일정 변경됨 / 다음 알림까지 **mm:ss**"(1초 단위 실시간 카운트, 예약 시각까지).
- **[일정 화면으로 돌아가기]** — 누르면 홈(Tabs)로. 약 8초 후 자동으로 홈 이동(참고 이미지의 원형 카운트 재현).
- **[지금 모두 먹기]** — 이 시간대(같은 hour:minute 슬롯)에 예정된 **활성 약 전부를 completed 기록** + 관련 알림/반복 정지 → 홈.
- 예약 시각 도달 시 처음과 동일하게 강하게 재울림.

## 5. 작은 수정 3개

1. **온보딩 로고 삭제** — `OnboardingScreen`에서 상단 `<Logo>` 제거. 인사 말풍선 + [회원가입하기]만. (음성/문구 유지)
2. **가입 플레이스홀더 가시성** — `RoleSelectScreen` `TextInput`의 `placeholderTextColor`를 연한 색 → **진한 회색(`colors.textSecondary` 또는 더 진하게)** 으로. (모든 입력칸: 이름/생년월일/거주지역/전화번호)
3. **음성 등록 개선** — `VoiceRegisterScreen`:
   - **확인 음성 자연화:** 현재 `${hour}시`만 읽어 분 누락 + "스물두시"로 읽힘. → 헬퍼 `spokenTime(hour, minute)`로 **"오후 10시 30분"**(분 0이면 "오후 10시")처럼 12시간 오전/오후 + 분 포함하여 발화.
   - **약 이름 수정:** 음성 인식·파싱 결과 카드에서 **약 이름을 `TextInput`으로 직접 수정** 가능하게. 등록 시 수정된 이름 사용.

## 6. 권한 / 빌드 영향

- **새 EAS 빌드 필요** (포그라운드 서비스·loopSound·풀스크린 강화·Time-Sensitive·피커는 네이티브/설정 변경).
- **권한 유도 3종(첫 알람 등록 시 1회):** 정확 알람(SCHEDULE_EXACT_ALARM) · 배터리 최적화 제외 · 풀스크린 알림 허용. Notifee의 설정 열기 API로 안내.
- `app.json`: 포그라운드 서비스 권한(FOREGROUND_SERVICE, FOREGROUND_SERVICE_SPECIAL_USE 등 Android 14+ 타입), iOS Time-Sensitive 엔타이틀먼트.

## 7. 테스트 / 검증

- **순수 로직 단위테스트(jest):** `spokenTime(hour, minute)`(오전/오후·분 경계), 스누즈 시각 계산(기간/정확시각 → 다음 발사 timestamp), "지금 모두 먹기" 대상 슬롯 선별.
- **수동 실기기 검증(Android 갤럭시 필수):** 잠금상태 자동 풀스크린, 진동모드 소리, 연속 진동/루프, 2.5분 자동정지 후 재발사, 미루기→카운트다운→재발사, 응답 시 즉시 정지.
- `npx tsc --noEmit` 통과, Codex 교차리뷰.

## 8. 범위 밖 (이번 아님)

- LiveSpeech 전화 기반 복약 설정(별도 스펙).
- iOS Critical Alerts(무음 관통) 애플 신청.
- 커스텀 STREAM_ALARM 네이티브(테스트에서 무음모드 소리 안 나면 후속).
- 알람 디자인 고도화(온보딩 마스코트 등).

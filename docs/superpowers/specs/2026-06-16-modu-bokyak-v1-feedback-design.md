# 모두의 복약 V1.0/V1.1 (피드백 반영) — 설계 문서

**작성일:** 2026-06-16
**상태:** 승인 대기 (브레인스토밍 산출물)
**대상:** 기존 `feat/care-mvp` 브랜치의 RN(Expo SDK 54) 앱 `care-app/`
**근거:** 사용자 피드백 "모두의 복약 MVP V1.0 피드백 정리" (P0/P1/P2)

---

## 1. 목적 (한 줄)

> 고령층이 복잡하게 조작하지 않아도 **복약 시간을 인지(알림 즉시 음성)**하고, **버튼으로 "먹었는지"만 쉽게 기록**하게 만든다. 건강 상태 질문은 복약 흐름에서 분리한다.

---

## 2. 범위

- **이번 사이클 = P0(V1.0) + P1(V1.1).**
- **제외(P2, 별도 제품영역):** 보호자 안심케어 유료 기능, 하루 1회 3분 AI 건강전화, 약봉투 OCR, 의료기관/약국 연계.
- 전제: 네이티브 변경(알림 사운드 리소스, Notifee 액션, 달력 라이브러리)이 많아 **새 EAS 빌드 필요**.

### 확정된 결정 (브레인스토밍)

| 항목 | 결정 |
|------|------|
| 알림 응답 | **버튼만** (STT 음성 응답을 복약 흐름에서 제거. 음성 *등록*은 유지) |
| 알림 즉시 음성 | **시간대별 고정 멘트 4종을 사전 생성 mp3 → 알림 채널 사운드** |
| 앱 이름 | **모두의 복약** |
| 로고 | 간단 아이콘 배지(알약/하트) + 워드마크 생성 |
| 회원가입 | **무인증 유지**, 프로필 필드(성별·생년월일·거주지역)만 추가 |
| missed 상태 | **저장 안 함, 달력 렌더 시 파생 계산** |
| 음성 톤 | OpenAI TTS 따뜻한 voice + 느린 속도(≈0.85) |

---

## 3. P0 — 복약 시점 핵심 흐름

### 3-1. 알림 고도화 (즉시 음성 + 진동모드 존중)

- **시간대별 고정 멘트 4종**을 빌드 전 1회 사전 생성:
  - 아침: "아침 약 복용 시간입니다. 약을 드신 후 복용 완료를 눌러주세요."
  - 점심/저녁/취침: 동일 구조, 시간대 단어만 변경.
  - 멘트 끝에 **짧고 잔잔한 chime**을 포함한 단일 mp3로 생성(또는 음성 뒤 무음+chime 합성).
- 생성 방법: OpenAI TTS(`/v1/audio/speech`, 따뜻한 voice, speed≈0.85)로 4개 mp3 생성 → `care-app/assets/sounds/`에 저장 → **Expo config plugin**으로 Android `res/raw` + iOS 번들에 복사.
- **알림 채널을 시간대별로 분리**(`care-alarm-morning/noon/evening/night`), 각 채널 `sound`에 해당 mp3 지정, importance HIGH, full-screen intent 유지.
- 동작:
  - **소리 모드** → 알림 발생 시 채널 사운드(=음성)가 즉시 재생. 앱 안 열어도 됨.
  - **진동 모드/무음** → Android가 채널 사운드를 자동 무음 처리하고 진동만. (별도 분기 코드 불필요 — OS 링거 모드가 처리.)
- 시간대 판정: 일정의 `time_of_day`(아침/점심/저녁/취침)로 채널 선택. 등록 시 정해진 값 사용.

### 3-2. 잠금화면/알림창 액션 버튼

- Notifee `android.actions` **2개만**: `[복용 완료]`, `[30분 후 다시 알림]`.
- `onBackgroundEvent`에서 `EventType.ACTION_PRESS` 처리(앱 안 열고):
  - `복용 완료` → `intake_records` upsert(`completed`, method 버튼) + 해당 표시 알림 해제.
  - `30분 후 다시 알림` → +30분 스누즈 알림 예약 + `intake_records`(`snoozed`) + 현재 알림 해제.
  - 두 경우 모두 `scheduleId`/`scheduledFor`는 알림 `data`에서 읽음. (dedup: 기존 upsert on `(schedule_id, scheduled_for)` 유지.)
- 본문 탭(`PRESS`) → 인앱 복약 확인 화면(3-3) 진입(기존 라우팅 유지).

### 3-3. 인앱 복약 확인 화면

- 알림 본문 탭 시 진입. 큰 글씨/큰 버튼(현재 수준 유지).
- 구성:
  ```
  {아침/점심/저녁/취침} 약 복용 시간입니다
  약을 드신 후 복용 완료를 눌러주세요.
  [ 복용 완료 ]
  [ 30분 후 다시 알림 ]
  [ 건너뛰기 ]
  ```
- **버튼 순서 고정**: 복용 완료 → 30분 후 다시 알림 → 건너뛰기.
- **마이크/STT 제거**, **StatusCheck(건강질문) 제거**. 응답 즉시 처리 후 홈/기록 반영(StatusCheck 경유 없이 Tabs로).
- 동작 매핑:
  - 복용 완료 → `completed`
  - 30분 후 다시 알림 → `snoozed` + 스누즈 예약
  - 건너뛰기 → `skipped`
- 화면 진입 시 표시 중인 해당 알림은 해제(기존 scheduleId 매칭 취소 로직 유지).

### 3-4. 버튼 문구/순서 통일

- "아직 안 먹었어요" → **"건너뛰기"**. 인앱 3버튼 라벨/순서를 3-3대로 통일. 기존 STTResponse 화면은 흐름에서 제거되므로 라우트/참조 정리.

### 3-5. 갤럭시 하단 탭 위치

- `RootNavigator`의 `tabBarStyle`에 **safe-area bottom inset 반영**: `useSafeAreaInsets()`의 `bottom`을 탭바 `height`와 `paddingBottom`에 더해 제스처 네비바와 겹치지 않게. 버튼 크기는 현재 유지.

### 3-6. 앱 이름/로고

- `app.json`의 `expo.name` → **"모두의 복약"**.
- 로고: 둥근 블루 배지 안 알약/하트 아이콘(lucide) + "모두의 복약" 워드마크 컴포넌트(`Logo`). 스플래시·헤더에 적용. 앱 아이콘(`assets/icon.png`, `splash-icon.png`)도 동일 톤으로 교체.

---

## 4. P1 — V1.1 추가

### 4-1. 데이터 상태 모델 정비

- `intake_records.status` 값을 **영문 코드로 통일**:
  - `completed` (복용 완료)
  - `snoozed` (30분 후 다시 알림)
  - `skipped` (건너뛰기)
  - `missed` — **저장하지 않음**. 달력에서 파생.
  - `no_schedule` — 일정 부재(기록 자체가 없음).
- **마이그레이션**: 기존 한글 값 매핑 — `복용완료→completed`, `재알림→snoozed`, `미복용→skipped`. (Supabase에서 1회 `update` 또는 신규 데이터부터 적용. 데모 데이터라 부담 적음.) `복용예정`은 미사용 처리.
- 코드 레벨 타입: `IntakeStatus = "completed" | "snoozed" | "skipped"`. 화면 표시/배지 매핑 함수에서 한글 라벨로 변환.
- **사용자 화면 표시**: completed→"복용 완료", skipped/missed→"복약 누락 또는 미확인", no_schedule→"복약 일정 없음".

### 4-2. missed(미응답) 파생 계산

- **순수 함수**로 구현(테스트 가능): 특정 날짜의 일정 슬롯들과 그 날짜의 기록을 받아, 각 슬롯의 상태를 산출.
  - 슬롯에 `completed` 기록 → 완료
  - 슬롯에 `skipped`/(미해결) 기록 또는 **과거 슬롯인데 기록 없음** → 누락/미확인(missed)
  - `snoozed`만 있고 후속 completed 없음 → 미확인 취급
- 달력은 이 산출로 색을 정함. 오늘/미래의 아직 안 온 슬롯은 누락으로 치지 않음.

### 4-3. 기록 탭 달력 화면

- `react-native-calendars` 추가. 월간 달력 + 상단 "**이번 달 복약 이행률: NN%**".
- **날짜별 색상 규칙(순수 함수, 테스트)**:
  | 조건 | 색 |
  |------|----|
  | 그 날 예정 복약 모두 완료 | 초록 |
  | 1회 누락/미확인 | 노랑 |
  | 2회 이상 누락/미확인 | 빨강 |
  | 등록된 일정 없음 | 회색/표시 없음 |
- 이행률 = (이번 달 completed 슬롯 수) / (이번 달 예정 슬롯 수) × 100.
- 데이터: 해당 월의 `schedules`(예정 슬롯 생성) × `intake_records`(기록) 대조. 기존 RecordScreen은 목록 → 달력 중심으로 재구성(목록은 선택 날짜 상세로 보존 가능).

### 4-4. 음성 톤 개선

- OpenAI TTS voice를 보호자 톤(부드럽고 안정적)으로 선택, speed≈0.85. 사전 생성 알림 멘트(3-1)와 인앱 안내(`lib/tts.ts`)가 동일 톤 사용. 기존 OpenAI TTS 프록시 그대로.

### 4-5. 간단 회원가입(프로필)

- **무인증 유지**(로그인/비번 없음). 기존 환자 온보딩(역할 선택/이름 입력)에 필드 추가:
  - 성별(남/여), 생년월일, 거주지역(예: "전라북도 전주시").
- `patients` 테이블에 컬럼 추가: `gender text`, `birth_date date`, `region text` (모두 nullable — 테스트 단계 임시 가입 허용).
- 입력 UX는 고령층 친화(큰 선택 버튼/간단 입력). 필수화하지 않음(건너뛰고 시작 가능).

---

## 5. 데이터/스키마 영향

- `intake_records.status` 값 체계 변경(영문 코드) + 기존 데이터 매핑 마이그레이션.
- `patients`에 `gender`, `birth_date`, `region` 컬럼 추가.
- 그 외 테이블 구조 변경 없음. dedup(upsert on `(schedule_id, scheduled_for)`), repeat_days, doseSlot 규칙 유지.

---

## 6. 오류 처리

| 상황 | 처리 |
|------|------|
| 알림 권한/정확알람 권한 거부 | 앱 내 안내 + 설정 유도(기존) |
| 액션 버튼 처리 중 Supabase 실패 | 백그라운드에서 실패 시 재시도 큐 없이 다음 앱 실행 때 보정(과거 슬롯 → 달력에서 missed로 표시되므로 데이터 일관성 유지). 인앱 경로 실패는 한국어 Alert(기존) |
| 사전 생성 음성 파일 누락 | 채널 기본 사운드로 폴백 |
| 진동 모드 | OS가 사운드 자동 무음 — 별도 처리 불필요 |
| 달력 데이터 없음 | 회색/빈 표시 |

---

## 7. 테스트 전략

- **순수 로직 단위 테스트(jest)**:
  - 달력 날짜별 색상 규칙 함수(완료/1회/2회+/없음).
  - missed 파생 계산(과거 슬롯 무기록 → missed, 미래 슬롯 제외).
  - status 코드 ↔ 한글 표시 매핑.
  - 월간 이행률 계산.
- **실기기(갤럭시) 수동 검증**: 알림 즉시 음성(소리/진동모드), 잠금화면 액션 버튼으로 앱 안 열고 기록, 인앱 3버튼, 하단 탭 위치, 달력 색상, 회원가입 입력.
- 네이티브 변경마다 EAS 빌드 후 검증.

---

## 8. 영향 파일 (요약)

- 알림: `care-app/src/lib/notifications.ts`(시간대별 채널 + 사운드 + actions), `care-app/index.ts`/`App.tsx`(ACTION_PRESS 처리), config plugin(사운드 리소스 번들), `assets/sounds/*.mp3`(사전 생성).
- 인앱 확인: `care-app/src/screens/AlarmScreen.tsx`(버튼 3개·STT 제거), `StatusCheckScreen` 흐름 제거, `STTResponseScreen` 라우트 정리, `navigation/types.ts`.
- 데이터/표시: `care-app/src/lib/supabase.ts`(IntakeStatus 타입), `records.ts`, 상태/색상/이행률/누락 계산 순수 모듈 + 테스트, `supabase/schema.sql`(컬럼/마이그레이션).
- 달력: `react-native-calendars` 추가, `RecordScreen.tsx` 재구성.
- 탭: `navigation/RootNavigator.tsx`(safe-area).
- 브랜딩: `app.json`(name/아이콘), `components/Logo.tsx`, `SplashScreen.tsx`, 헤더.
- 회원가입: `RoleSelectScreen.tsx`(필드 추가), `lib/storage.ts`/`supabase.ts`.
- TTS: `lib/tts.ts`(voice/speed), 사전 생성 스크립트.

---

## 9. 범위 밖 (P2, 향후)

보호자 안심케어 유료, 하루 1회 3분 AI 건강전화, 이상 응답 보호자 알림, 주간/월간 건강 리포트, 약봉투 OCR 등록, 의료기관/약국 연계. (별도 스펙 사이클.)

# 케어(CARE) MVP — 설계 문서

**작성일:** 2026-06-11
**상태:** 승인 대기 (브레인스토밍 산출물)
**목표 전달 시점:** 2026-06-11 밤 12시 전 (기능 중심 MVP)

---

## 1. 한 줄 정의

> 복약 시간을 음성(TTS)으로 알려 주고, 사용자가 "먹었어요"라고 말하거나 버튼을 누르면 복약 기록이 자동으로 남으며, 보호자가 코드로 그 기록을 확인할 수 있는 React Native + Expo 앱.

기존 Vite 웹 프로토타입(13개 화면)은 **시각 레퍼런스**로 유지하고, 코드는 RN으로 새로 작성한다.

---

## 2. 확정된 핵심 결정 사항

브레인스토밍에서 합의한 내용:

| 결정 | 선택 | 비고 |
|------|------|------|
| 플랫폼 | **React Native + Expo (managed)** | Android·iOS, Expo Go로 실기기 테스트 |
| 백엔드 | **Supabase Postgres, 인증 없음** | 보호자는 환자 코드로 연결 |
| STT | **Cloud STT (OpenAI Whisper) via Expo Go** | `expo-av` 녹음 → Whisper 전사 → 의도 분류. 추후 더 좋은 모델로 교체 |
| TTS | **`expo-speech` (ko-KR, 느린 속도)** | 추후 더 좋은 모델로 교체 |
| 약 등록 | **음성 + 버튼 둘 다** | 버튼이 기본, 음성은 Whisper 전사 + GPT 파싱 |
| 알림 | **`expo-notifications` 로컬 예약 알림** | FCM 서버 불필요 |
| AI | **OpenAI 단일 키** (Whisper + gpt-4o-mini) | 키 확보 완료 |
| 화면 | **기존 13개 + 신규 3개 = 16개** | 아래 §6 |

### 핵심 가설 (MVP가 검증할 것)

> 스마트폰에 익숙하지 않은 고령층 사용자가, 복약 알림을 받은 뒤 **짧은 음성 응답 또는 버튼만으로** 복약 기록을 남길 수 있는가?

---

## 3. 아키텍처

### 3-1. 기술 스택

| 영역 | 기술 |
|------|------|
| 앱 | Expo (managed), React Native, TypeScript |
| 내비게이션 | React Navigation — Bottom Tabs + Native Stack |
| 백엔드 | Supabase Postgres (인증 없음, 환자 코드 기반) |
| 로컬 저장 | AsyncStorage (역할, patient_id, patient_code, 설정) |
| TTS | `expo-speech` |
| STT | `expo-av` 녹음 + OpenAI Whisper |
| 등록 파싱 | OpenAI `gpt-4o-mini` (음성 등록 문장 → 구조화) |
| 알림 | `expo-notifications` (로컬 예약) |

### 3-2. 디렉터리 구조 (신규 RN 앱)

기존 웹 프로토타입은 그대로 두고, 새 Expo 앱을 별도 폴더(`care-app/`)에 생성한다. 레포에 git이 없으므로 먼저 `git init`.

```
care-app/
  app.json
  App.tsx
  src/
    navigation/        # 탭 + 스택 구성, 라우트 타입
    screens/           # 16개 화면 (아래 §6)
    components/        # BigButton, ScheduleCard, StatusBadge, MicButton, TimeChip ...
    lib/
      supabase.ts      # Supabase 클라이언트 + 쿼리
      openai.ts        # Whisper 전사 + GPT 파싱 (키 주입)
      tts.ts           # 음성 출력 인터페이스 (교체 가능)
      stt.ts           # 녹음 + 전사 인터페이스 (교체 가능)
      intent.ts        # 전사 텍스트 → 의도 (순수 함수, 단위 테스트)
      schedule.ts      # 일정 → 알림 시각 계산 (순수 함수, 단위 테스트)
      notifications.ts # 예약/취소/재알림(+30분)
      storage.ts       # AsyncStorage 래퍼 (역할, 코드)
    theme/
      tokens.ts        # 색상/타이포/간격 토큰 (스펙 §1 컬러 재사용)
```

**교체 가능성:** `tts.ts` / `stt.ts`는 좁은 인터페이스(`speak(text)`, `recordAndTranscribe(): Promise<string>`)만 노출한다. 추후 더 좋은 모델로 바꿀 때 이 두 파일만 교체한다.

### 3-3. 역할 & 연결 모델 (인증 없음)

- 첫 실행 시 **역할 선택**(환자 / 보호자) → AsyncStorage에 저장.
- **환자:** 최초 생성 시 6자리 `patient_code` 발급. 본인 데이터를 Supabase에 기록.
- **보호자:** 환자의 `patient_code`를 입력 → 해당 환자의 기록을 **읽기 전용**으로 조회.
- 인증/비밀번호 없음. 코드가 곧 연결 키. (운영 단계에서 인증으로 강화 — §10 참고)

---

## 4. 데이터 모델 (Supabase Postgres)

MVP를 위해 약 정보는 별도 테이블 없이 일정에 약 이름을 합쳐 단순화한다.

### `patients`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | |
| name | text | 사용자 이름 |
| patient_code | text (unique) | 6자리 연결 코드 |
| created_at | timestamptz | |

### `schedules`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | |
| patient_id | uuid (FK→patients) | |
| medicine_name | text | 간단한 약 이름 (예: 고혈압약) |
| time_of_day | text | 아침/점심/저녁/취침 |
| hour | int | 0–23 |
| minute | int | 0–59 |
| repeat_days | int[] | 0–6 (없으면 매일) |
| active | bool | 기본 true |
| created_at | timestamptz | |

### `intake_records`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | |
| patient_id | uuid (FK) | |
| schedule_id | uuid (FK→schedules) | |
| scheduled_for | timestamptz | 예정된 복약 시각 |
| status | text | 복용완료 / 미복용 / 복용예정 / 재알림 |
| response_method | text | 음성 / 버튼 / null |
| responded_at | timestamptz | null 가능 |
| created_at | timestamptz | |

**재알림:** 별도 테이블 없이, 로컬 알림을 +30분으로 다시 예약하고 해당 record의 status를 `재알림`으로 갱신한다.

**RLS:** MVP는 인증이 없으므로 익명 키로 읽기/쓰기를 허용한다. (보안 한계는 §10에 명시)

---

## 5. 음성 · 알림 동작

### 5-1. TTS (`lib/tts.ts`)
- `expo-speech`, 언어 `ko-KR`, 기본 속도 **느리게**(스펙 권장값).
- 사용처: 알림 응답 화면 안내 문구, 등록/기록 확인 멘트.
- 예: "안석찬 님, 저녁 약을 복용할 시간입니다." / "복약 완료로 기록했습니다." / "30분 뒤에 다시 알려드릴게요." / "다시 한번 말씀해 주세요."

### 5-2. STT 응답 (`lib/stt.ts` + `lib/intent.ts`)
1. `expo-av`로 마이크 녹음.
2. 녹음 파일을 OpenAI Whisper(`language=ko`)로 전사.
3. 전사 텍스트를 **순수 함수 `classifyIntent`**로 의도 분류:

| 의도 | 대표 키워드 |
|------|-------------|
| 복용완료 | 먹었, 복용했, 먹음, 했어요 |
| 미복용 | 안 먹, 못 먹, 아직 |
| 재알림 | 나중에, 이따, 30분, 다시 알려 |
| 인식실패 | 위 어디에도 해당 안 됨 |

4. `인식실패` → "다시 말씀해 주세요" 재안내 + 버튼 노출.

### 5-3. 음성 등록 파싱 (`lib/openai.ts`)
1. `expo-av` 녹음 → Whisper 전사 (예: "매일 아침 8시에 고혈압약 먹어요").
2. gpt-4o-mini로 구조화:
   ```json
   { "medicine_name": "고혈압약", "time_of_day": "아침", "hour": 8, "minute": 0, "repeat_days": "매일" }
   ```
3. 파싱 결과를 **확인 화면**에 표시 → 사용자가 버튼으로 수정/확정 후 저장.
4. 저장 시 `schedules` insert + 로컬 알림 예약.

### 5-4. 알림 (`lib/notifications.ts`)
- 일정 저장 시 `hour:minute`에 매일 반복 로컬 알림 예약.
- 알림 탭 → **Alarm(음성 복약 알림)** 화면으로 진입.
- **재알림:** 일회성 알림을 +30분으로 예약, record status `재알림`.
- **데모 트리거:** 발표 시 시계를 기다리지 않도록 "지금 알림 받기" 버튼으로 Alarm 화면 즉시 진입.

---

## 6. 화면 목록 (16개)

### 6-1. 기존 13개 (RN으로 재구현, 폴더 화면을 시각 레퍼런스로)

| # | 화면 | 오늘 역할 | 핵심 동작 |
|---|------|-----------|-----------|
| 1 | Splash | 시각 | 로고 + 로딩 후 진입 |
| 2 | Onboarding | 시각 | 3장 소개 후 시작 |
| 3 | Home (홈) | **핵심** | 다음 복약 시간, 오늘 일정/상태, 빠른 응답 버튼 |
| 4 | MedicineList (복약 관리) | **핵심** | 등록된 일정 목록, 약 등록 진입 |
| 5 | RegisterMethod (등록 방식) | **핵심** | 음성/버튼 선택, 사진은 `준비 중` 배지 |
| 6 | VoiceRegister (음성 등록) | **핵심** | 녹음 → Whisper → GPT 파싱 → 확인 |
| 7 | ButtonRegister (버튼 등록) | **핵심** | 이름 입력 + 시간대/시간 Chip → 저장 |
| 8 | Alarm (음성 복약 알림) | **핵심** | TTS 안내 + 마이크 + 3개 버튼 |
| 9 | AlarmList | 보조 | 예정 알림 목록 |
| 10 | STTResponse (음성 응답 결과) | **핵심** | Whisper + 의도 분류 결과 Variant |
| 11 | StatusCheck (복약 후 증상·컨디션) | 시각 | 증상/컨디션 기록(스펙상 선택 기능) |
| 12 | Record (복약 기록) | **핵심** | 날짜·시간·약·상태·응답방식 목록 |
| 13 | Settings (더보기) | 보조 | 큰 글씨/음성 속도/보호자 연결 진입 |

### 6-2. 신규 3개 (추가)

| # | 화면 | 이유 |
|---|------|------|
| 14 | 역할 선택 (환자/보호자) | 첫 실행에서 역할 결정 — 인증 없는 전체 흐름의 시작점 |
| 15 | 보호자 확인 (대시보드) | 스펙 §8-5: 환자의 오늘 현황 + 최근 7일 + 미복용 목록 |
| 16 | 보호자 연결 (코드) | 환자는 코드 표시, 보호자는 코드 입력으로 연결 |

**핵심(core)** 화면은 오늘 기능까지 연결한다. 보조/시각 화면은 RN으로 시각 재구현하고 시간이 되는 대로 연결한다. 음성 레이어가 늦어지더라도 모든 화면은 버튼으로 데모 가능하다.

---

## 7. 핵심 사용자 흐름

### 7-1. 등록 흐름
```
홈 → 복약 관리 → 약 등록(RegisterMethod)
  → 음성 등록(VoiceRegister): 녹음→전사→GPT 파싱→확인→저장
  또는 버튼 등록(ButtonRegister): 이름+시간대+시간→저장
  → 로컬 알림 예약 → 홈 반영
```

### 7-2. 알림·응답 흐름
```
로컬 알림 발화(또는 "지금 알림 받기")
  → Alarm 화면 진입 + TTS 안내
  → 사용자: 마이크로 말하기 → STTResponse(전사+의도)
    또는 3개 버튼 중 선택
  → 복용완료/미복용/재알림 기록 저장
  → (선택) StatusCheck
  → 홈/기록 반영
```

### 7-3. 보호자 흐름
```
역할 선택(보호자) → 보호자 연결(코드 입력)
  → 보호자 확인 대시보드: 오늘 현황 + 최근 7일 + 미복용(읽기 전용)
```

---

## 8. 오류 처리

| 상황 | 처리 |
|------|------|
| 마이크 권한 거부 | 버튼 입력으로 폴백 + 토스트 안내 |
| STT 전사 실패/저신뢰 | "다시 말씀해 주세요" 재안내 + 버튼 노출 |
| GPT 파싱 저신뢰 | 확인 화면에서 사용자가 버튼으로 수정 후 저장 |
| 알림 권한 거부 | 앱 내 안내 폴백 + 설정 유도 |
| Supabase 쓰기 실패 | 낙관적 UI 유지 + 토스트, 재시도 안내 |
| 네트워크 없음(STT) | 버튼 경로로 즉시 폴백 |

---

## 9. 테스트 전략

깨지기 쉽고 테스트 비용이 낮은 **순수 로직**에 TDD 적용:

- `intent.classifyIntent(text)` — 키워드 → 의도 매핑 단위 테스트.
- `schedule.nextNotificationTime(schedule, now)` — 일정 → 다음 알림 시각 계산.
- GPT 파싱 결과 스키마 검증(필수 필드/범위) 단위 테스트.

화면·음성·알림은 Expo Go 실기기에서 수동 검증.

---

## 10. 보안 · 운영 한계 (의도적으로 MVP에서 미룸)

- **API 키가 클라이언트에 존재:** 데모용. 운영 단계에서는 서버(또는 Supabase Edge Function) 뒤로 이동.
- **인증 없음 / 코드 기반 연결:** 누구나 코드를 알면 조회 가능. 운영 단계에서 Supabase Auth + RLS로 강화.
- **개인정보:** 약 이름만 저장(상세 의료정보 미수집). 저장 범위는 추후 검토.

이 한계들은 핵심 가설 검증 속도를 위해 의도적으로 수용한다.

---

## 11. 오늘 밤 작업 우선순위 (현실적 컷 라인)

1. 프로젝트 스캐폴드 (Expo + 내비게이션 + Supabase 클라이언트 + 토큰)
2. 역할 선택 → Home (핵심)
3. ButtonRegister (신뢰 가능한 등록 기반)
4. Alarm: TTS + 3개 버튼
5. Record (기록 목록)
6. Supabase 연결(저장/조회)
7. 보호자 연결 + 보호자 확인 대시보드
8. STTResponse: Whisper + 의도 분류
9. **VoiceRegister: Whisper + GPT 파싱 (가장 늦게 — 슬립 가능성 최고)**

버튼 경로가 모든 화면을 데모 가능하게 보장하므로, 음성 레이어가 미완성이어도 발표는 가능하다.

---

## 12. MVP에서 제외 (스펙 §7 따름)

자유 대화형 음성 AI, 의료 상담, 관리자 대시보드, 실시간 채팅, 복약률 그래프, 사진/OCR 약 인식, 병원·약국 연동, 장기 대화 기억.

---

## 13. 범위 밖 — 향후 단계

음성 등록 고도화, 큰 글씨 모드 완성, 보호자 미복용 즉시 알림, 최근 7일 복약률, 사진+OCR 등록, 약국·병원 연동, 의료진 리포트, 인증/RLS 강화, TTS/STT 고품질 모델 교체.

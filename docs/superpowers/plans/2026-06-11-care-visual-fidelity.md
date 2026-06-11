# 케어(CARE) 비주얼 충실도 재구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 으로 태스크 단위 실행. 각 화면은 서브에이전트가 (1) 웹 프로토타입 컴포넌트를 디자인 타깃으로 읽고 (2) 현재 RN 화면의 로직을 읽어 보존한 채 (3) 비주얼만 교체한다. 단계는 체크박스(`- [ ]`).

**Goal:** RN 앱의 16개 화면을 `/src`의 피그마 Maker 웹 프로토타입과 시각적으로 일치하도록 재구현한다(로직은 불변).

**Architecture:** 웹 프로토타입(React DOM + Tailwind + lucide-react + SVG)은 RN에서 실행 불가하므로 포팅이 아니라 **RN 재구현**이다. 디자인 소스 오브 트루스는 각 `src/app/components/*.tsx` 프로토타입 파일이다. RN 측은 `View/Text/StyleSheet` + `lucide-react-native`(동일 아이콘 세트) + `react-native-svg`(링/벡터) + 이미 재스타일된 공용 컴포넌트로 동일한 룩을 만든다. 데이터/내비게이션/핸들러/props/훅은 절대 변경하지 않는다.

**Tech Stack:** React Native (Expo SDK 54), TypeScript, lucide-react-native, react-native-svg, React Navigation, design tokens(`src/theme/tokens.ts`).

---

## 불변 계약 (모든 태스크 공통 — 위반 시 리뷰에서 반려)

각 화면 재스타일 시 **반드시 보존**:
- Supabase 호출 및 쿼리(테이블/필터/정렬/select), `useFocusEffect`/`useEffect` 데이터 로딩
- `useNavigation`/`useRoute` 사용, 모든 `nav.navigate(...)`/`nav.reset(...)` 대상과 라우트 파라미터(`scheduleId`, `scheduledFor` 등)
- `useState` 상태, 핸들러 함수(`write`/`snooze`/`commit`/`onMic`/`save`/`link` 등)와 그 내부 동작(녹음·STT·TTS·recordIntake·scheduleReminders·에러 Alert 폴백)
- export 함수명, 컴포넌트 props 시그니처
- pinned 결정(AGENTS.md)과 충돌 금지

**허용**: 렌더링 JSX, StyleSheet, 아이콘, 레이아웃, 색/간격, 공용 컴포넌트 재사용. 새 import는 `react-native`, `@react-navigation/*`, `lucide-react-native`, `react-native-svg`, 기존 `lib/components/theme`로 한정.

**검증(모든 태스크 동일):**
- `cd care-app && npx tsc --noEmit` → EXIT 0
- `npx jest` → 21/21 통과(로직 미변경이므로 그대로)
- 데브서버가 떠 있으면 `curl -s -o /tmp/b.js -w "HTTP %{http_code} %{size_download}\n" "http://localhost:8081/index.bundle?platform=ios&dev=true"` → HTTP 200 (서버를 새로 띄우지는 말 것)

---

## 이미 완료 (참고)

- [x] 공용 컴포넌트 재스타일 (`b49b6c6`): BigButton, StatusBadge(아이콘+pill), ScheduleCard(시간대 아이콘+카드), TimeChip, MicButton(lucide Mic)
- [x] Splash / Onboarding / Home 재스타일 (`9e784c2`): Home은 헤더+네이비 hero+ScheduleCard 목록+react-native-svg 도넛(일정 개수 기반, 추가 쿼리 없음)

---

## Task 1: 복약 관리 목록 + 약 등록 방식 선택

**Files:**
- Modify: `care-app/src/screens/MedicineListScreen.tsx`
- Modify: `care-app/src/screens/RegisterMethodScreen.tsx`
- Design ref: `src/app/components/MedicineListScreen.tsx`, `src/app/components/RegisterMethodScreen.tsx`

- [ ] **Step 1: 두 프로토타입과 두 RN 파일을 읽는다** (디자인 타깃 + 보존 로직 파악)

- [ ] **Step 2: MedicineListScreen 재스타일**
  - 프로토타입 재현: 상단 제목 "복약 관리" + (있으면)필터 탭, 약 카드 목록(ScheduleCard 또는 프로토타입 약카드 스타일: 이름/주기/상태 배지), 하단 고정 "+ 약 등록하기" 버튼(BigButton).
  - 보존: `useFocusEffect`의 `schedules` 조회(`getPatientId`, `.eq("patient_id").order("hour")`), 빈 상태 "등록된 약이 없어요", `nav.navigate("RegisterMethod")`. 시간 표시 포맷 유지.

- [ ] **Step 3: RegisterMethodScreen 재스타일**
  - 프로토타입 재현: 제목 "어떻게 약을 등록할까요?", 큰 선택 카드 3개(음성=primary 강조, 버튼, 사진=`준비 중` 배지). 각 카드 큰 아이콘(lucide: Mic / Hand 또는 ListChecks / Camera).
  - 보존: `nav.navigate("VoiceRegister")`, `nav.navigate("ButtonRegister")`, 사진 카드는 비활성(준비 중) 유지.

- [ ] **Step 4: 검증(공통) 후 커밋**
```bash
git add care-app/src/screens/MedicineListScreen.tsx care-app/src/screens/RegisterMethodScreen.tsx
git commit -m "style: restyle MedicineList + RegisterMethod to match Figma"
```

---

## Task 2: 버튼 등록 + 음성 등록

**Files:**
- Modify: `care-app/src/screens/ButtonRegisterScreen.tsx`
- Modify: `care-app/src/screens/VoiceRegisterScreen.tsx`
- Design ref: `src/app/components/ButtonRegisterScreen.tsx`, `src/app/components/VoiceRegisterScreen.tsx`

- [ ] **Step 1: 프로토타입 2개 + RN 2개 읽기**

- [ ] **Step 2: ButtonRegisterScreen 재스타일**
  - 프로토타입 재현: 약 이름 입력, 시간대 Chip(아침/점심/저녁/취침), 세부 시간 Chip, 하단 "저장하기"(BigButton). TimeChip 재사용. 입력창 프로토타입 스타일.
  - 보존: `name/tod/hour` 상태, `save()` 내부(Supabase `schedules` insert with `repeat_days: []`, `ensurePermission`, `scheduleReminders(data.id, name, hour, 0, data.repeat_days ?? [])`, 성공 Alert, `nav.navigate("Tabs")`), 빈 이름 검증 Alert. `TODS`/`HOURS` 목록 값 유지.

- [ ] **Step 3: VoiceRegisterScreen 재스타일**
  - 프로토타입 재현: 제목 "음성으로 약 등록", 중앙 큰 마이크 버튼(MicButton 재사용) + 안내/예시 문구, 인식 후 결과 확인 카드(약 이름/시간/반복), "이대로 등록하기"/"다시 말하기"(BigButton).
  - 보존: `recording/parsed/transcript` 상태, `onMic()`(startRecording 실패 try/catch + Alert 폴백, stopAndTranscribe, gptParseSchedule, 실패 Alert, speak), `confirm()`(Supabase insert, scheduleReminders, speak, nav), 모든 라우팅 유지.

- [ ] **Step 4: 검증 후 커밋**
```bash
git add care-app/src/screens/ButtonRegisterScreen.tsx care-app/src/screens/VoiceRegisterScreen.tsx
git commit -m "style: restyle ButtonRegister + VoiceRegister to match Figma"
```

---

## Task 3: 알림 응답 + STT 응답 + 복약 후 상태 확인

**Files:**
- Modify: `care-app/src/screens/AlarmScreen.tsx`
- Modify: `care-app/src/screens/STTResponseScreen.tsx`
- Modify: `care-app/src/screens/StatusCheckScreen.tsx`
- Design ref: `src/app/components/AlarmScreen.tsx`, `src/app/components/STTResponseScreen.tsx`, `src/app/components/StatusCheckScreen.tsx`

- [ ] **Step 1: 프로토타입 3개 + RN 3개 읽기**

- [ ] **Step 2: AlarmScreen 재스타일**
  - 프로토타입 재현: 전체화면 모달 느낌, 상단 큰 벨 아이콘(lucide Bell, 음성 파형 느낌의 원형 강조), 시간/제목("○○ 드실 시간이에요"), 안내 문구, 중앙 큰 마이크(MicButton), 하단 큰 버튼 3개(복용 완료/아직 안 먹었어요/30분 뒤). 라이트블루 배경.
  - 보존: `scheduleId`(route), `schedule` 로딩 `useEffect`(Supabase single + speak), `ready` 게이팅, `write/snooze`(doseSlot, recordIntake try/catch+Alert, speak, nav), `onMic`(startRecording try/catch+Alert, await write/snooze, STTResponse 폴백 nav). 버튼 onPress 대상 유지.

- [ ] **Step 3: STTResponseScreen 재스타일**
  - 프로토타입 재현: 인식 상태 Variant 느낌(성공 큰 초록 체크 / 재알림 시계 / 실패 경고). 현재 RN은 재시도 화면이므로: 안내 문구, 들은 내용 표시, MicButton, "버튼으로 선택하기" 큰 버튼 2개. lucide 아이콘으로 상태 표현.
  - 보존: `scheduleId/scheduledFor`(route), `recording/heard` 상태, `commit(status, method)`(recordIntake try/catch+Alert, nav StatusCheck), `snooze()`(schedule 조회+recordIntake+scheduleSnooze try/catch+Alert), `onMic`(startRecording try/catch+Alert, intent 분기). 버튼은 "버튼" method 전달 유지.

- [ ] **Step 4: StatusCheckScreen 재스타일**
  - 프로토타입 재현: 질문("오늘 컨디션은 어떤가요?") + 표정/아이콘 있는 큰 선택 버튼(좋음/보통/나쁨). lucide(Smile/Meh/Frown).
  - 보존: 각 버튼 `nav.navigate("Tabs")`.

- [ ] **Step 5: 검증 후 커밋**
```bash
git add care-app/src/screens/AlarmScreen.tsx care-app/src/screens/STTResponseScreen.tsx care-app/src/screens/StatusCheckScreen.tsx
git commit -m "style: restyle Alarm + STTResponse + StatusCheck to match Figma"
```

---

## Task 4: 복약 기록 + 알림 목록 + 더보기/설정

**Files:**
- Modify: `care-app/src/screens/RecordScreen.tsx`
- Modify: `care-app/src/screens/AlarmListScreen.tsx`
- Modify: `care-app/src/screens/SettingsScreen.tsx`
- Design ref: `src/app/components/RecordScreen.tsx`, `src/app/components/AlarmListScreen.tsx`, `src/app/components/SettingsScreen.tsx`

- [ ] **Step 1: 프로토타입 3개 + RN 3개 읽기**

- [ ] **Step 2: RecordScreen 재스타일**
  - 프로토타입 재현: 제목 "복약 기록"(+달력 아이콘), 요약 카드(복약률 느낌 — 단, 현재 데이터로만), 기록 목록 카드(날짜·시간·약·상태 배지·응답방식). StatusBadge 재사용. 필터 탭은 시각만(없으면 생략 가능).
  - 보존: `useFocusEffect`의 `intake_records`+`schedules` 조회와 `medicine_name` 매핑, 정렬/limit, 빈 상태 "아직 기록이 없어요". 요약에 새 쿼리 추가 금지(있는 데이터로만).

- [ ] **Step 3: AlarmListScreen 재스타일**
  - 프로토타입 재현: 예정 알림 목록 느낌의 카드 UI. 현재 RN은 단순 스텁이므로 프로토타입 룩의 정적 리스트/빈상태로 시각만 정리(데이터 연동은 범위 밖).
  - 보존: 현재 export/동작(스텁) 유지하되 비주얼만.

- [ ] **Step 4: SettingsScreen 재스타일**
  - 프로토타입 재현: 제목 "더보기", 메뉴 리스트(보호자 연결 관리/알림 소리/음성 속도/큰 글씨 모드 등) 행 UI + 아이콘(lucide). 실제 동작이 있는 항목은 "로그아웃/역할 다시 선택"뿐이므로 나머지는 시각적 행으로 표시(비활성 또는 무동작) — 없는 기능을 새로 만들지 말 것.
  - 보존: "로그아웃/역할 다시 선택" → `clearAll()` + `nav.reset RoleSelect` 동작 유지.

- [ ] **Step 5: 검증 후 커밋**
```bash
git add care-app/src/screens/RecordScreen.tsx care-app/src/screens/AlarmListScreen.tsx care-app/src/screens/SettingsScreen.tsx
git commit -m "style: restyle Record + AlarmList + Settings to match Figma"
```

---

## Task 5: 신규 화면 3종 (프로토타입 없음 — 미감 일치)

**Files:**
- Modify: `care-app/src/screens/RoleSelectScreen.tsx`
- Modify: `care-app/src/screens/GuardianLinkScreen.tsx`
- Modify: `care-app/src/screens/GuardianDashboardScreen.tsx`

이 3개는 프로토타입에 대응 화면이 없으므로, **이미 확립된 케어 미감**(네이비/블루 토큰, 카드, 큰 버튼, lucide 아이콘, Splash/Home과 일관)에 맞춰 디자인한다.

- [ ] **Step 1: 세 RN 파일 읽기 + Splash/Home(완성본)에서 미감 참고**

- [ ] **Step 2: RoleSelectScreen 재스타일**
  - 상단 브랜드(케어 로고/아이콘), 이름 입력 카드, 큰 선택 버튼 2개("본인이 복약해요" primary / "가족을 확인해요(보호자)" secondary). 역할 아이콘(lucide: User / Users).
  - 보존: `name` 상태, `makeCode()`, `startAsPatient()`(Supabase insert, setPatient, setRole, nav.reset Tabs), `startAsGuardian()`(nav.navigate GuardianLink), 빈 이름 Alert.

- [ ] **Step 3: GuardianLinkScreen 재스타일**
  - 제목/안내 + 6자리 코드 입력(큰 간격 입력) + "연결하기"(BigButton). 아이콘(lucide: Link 또는 KeyRound).
  - 보존: `code` 상태, `link()`(Supabase patients 코드 조회, setPatient, setRole("guardian"), nav.reset GuardianHome), 실패 Alert, `maxLength/autoCapitalize`.

- [ ] **Step 4: GuardianDashboardScreen 재스타일**
  - 제목 "○○ 님의 복약 현황", (환자 본인일 때) 코드 안내 네이비 카드, 최근 7일 요약, 기록 목록 카드(StatusBadge 재사용). Home 미감과 일관.
  - 보존: `useFocusEffect`(getRole/getPatientCode/getPatientId, patients single, intake_records 7일 조회), `role === "patient"`일 때만 코드 박스 표시, `done`/`recent` 계산.

- [ ] **Step 5: 검증 후 커밋**
```bash
git add care-app/src/screens/RoleSelectScreen.tsx care-app/src/screens/GuardianLinkScreen.tsx care-app/src/screens/GuardianDashboardScreen.tsx
git commit -m "style: restyle RoleSelect + Guardian screens to match CARE aesthetic"
```

---

## Task 6: 하단 탭바 스타일 (프로토타입 BottomNav 일치)

**Files:**
- Modify: `care-app/src/navigation/RootNavigator.tsx` (PatientTabs의 `Tab.Navigator` 옵션만)
- Design ref: `src/app/components/BottomNav.tsx`

- [ ] **Step 1: 프로토타입 BottomNav + 현재 RootNavigator 읽기**

- [ ] **Step 2: 탭바 외형만 변경**
  - `PatientTabs`의 `Tab.Navigator`에 `screenOptions`로 탭별 lucide 아이콘(홈=Home, 기록=ClipboardList, 보호자=Users), 활성/비활성 색(primaryBlue/textSecondary), 라벨 한글("홈"/"기록"/"보호자"), 탭바 배경/보더(colors.cardBg/border), 높이를 프로토타입 감성에 맞춤.
  - **절대 보존:** Stack/Tab 구조, 라우트 이름("Home"/"Record"/"Guardian", "Tabs"/"GuardianHome"/...), `initialRouteName` 계산 로직(role/linked 기반), 모든 `Stack.Screen`/`Tab.Screen` 등록과 component 매핑. **라우팅 로직은 한 줄도 바꾸지 말고 탭바 외형 옵션만 추가.**

- [ ] **Step 3: 검증 후 커밋**
```bash
git add care-app/src/navigation/RootNavigator.tsx
git commit -m "style: themed bottom tab bar with lucide icons (routing unchanged)"
```

---

## Self-Review 메모 (스펙 커버리지)

- 프로토타입 13개 화면(Splash/Onboarding/Home 완료 + Task1~4의 10개) 모두 매핑됨. ✅
- 신규 3화면(RoleSelect/Guardian×2)은 미감 일치로 Task5. ✅
- BottomNav → Task6(탭바 외형). ✅
- StatusBadge/공용 컴포넌트 → 이미 완료. ✅
- 로직 불변 계약을 모든 태스크에 명시(데이터/내비/핸들러/props 보존). ✅
- 신규 기능 추가 금지(설정/알림목록은 시각만, 복약률 요약은 기존 데이터로만) — YAGNI. ✅

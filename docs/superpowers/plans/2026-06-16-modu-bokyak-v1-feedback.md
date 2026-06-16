# 모두의 복약 V1.0/V1.1 (피드백 반영) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 으로 태스크 단위 실행. 단계는 체크박스(`- [ ]`). 모든 보고/주석은 한국어.

**Goal:** 복약 시점을 버튼 중심으로 단순화하고(알림 즉시 음성 + 잠금화면 액션 버튼 + 인앱 3버튼, 건강질문 제거), 기록 탭에 달력/이행률을 추가하며, 앱 이름·로고·프로필 입력을 정비한다.

**Architecture:** 기존 Notifee/Supabase/스왑가능 TTS 패턴 유지·확장. 알림 음성은 시간대별 고정 mp3를 expo-notifications config-plugin의 `sounds`로 번들하여 Notifee 채널 사운드로 사용. 상태값은 영문 코드(completed/snoozed/skipped)로 통일하고 missed는 달력에서 파생. 순수 로직(상태/달력/이행률)은 jest로 테스트.

**Tech Stack:** React Native(Expo SDK 54), TypeScript, @notifee/react-native, expo-notifications(config-only sounds), react-native-calendars, expo-av(TTS 재생), Supabase, OpenAI TTS(엣지 함수), jest.

---

## 공통 검증 (모든 태스크)
- `cd care-app && npx tsc --noEmit` → EXIT 0
- `npx jest` → 기존 25개 + 신규 테스트 통과
- 네이티브/실기기 동작은 마지막 Task(빌드+검증)에서 확인.

## 핵심 전제
네이티브 변경(알림 채널/사운드/액션, react-native-calendars) → **새 EAS 빌드 필요**. 코드 먼저 작성·tsc/jest 통과 후 마지막에 빌드.

## 실행 순서
P0(Task 1~7) 먼저 → P1(Task 8~10) → 빌드/검증(Task 11). P0까지만 해도 V1.0으로 동작.

---

## Task 1: 상태 코드 통일 (TDD) + 표시 매핑 + 마이그레이션

**Files:**
- Create: `care-app/src/lib/intakeStatus.ts`
- Test: `care-app/src/__tests__/intakeStatus.test.ts`
- Modify: `care-app/src/lib/supabase.ts`, `care-app/src/components/StatusBadge.tsx`, `care-app/src/lib/records.ts`, `care-app/src/screens/RecordScreen.tsx`, `care-app/src/screens/GuardianDashboardScreen.tsx`, `care-app/src/screens/AlarmScreen.tsx`, `care-app/src/screens/STTResponseScreen.tsx`
- Create(SQL): `care-app/supabase/migrate-status.sql`

- [ ] **Step 1: 실패 테스트 작성** `care-app/src/__tests__/intakeStatus.test.ts`

```ts
import { statusLabel } from "../lib/intakeStatus";

describe("statusLabel", () => {
  it("completed → 복용 완료", () => expect(statusLabel("completed")).toBe("복용 완료"));
  it("snoozed → 30분 후 다시 알림", () => expect(statusLabel("snoozed")).toBe("30분 후 다시 알림"));
  it("skipped → 복약 누락 또는 미확인", () => expect(statusLabel("skipped")).toBe("복약 누락 또는 미확인"));
  it("missed → 복약 누락 또는 미확인", () => expect(statusLabel("missed")).toBe("복약 누락 또는 미확인"));
  it("no_schedule → 복약 일정 없음", () => expect(statusLabel("no_schedule")).toBe("복약 일정 없음"));
});
```

- [ ] **Step 2: 실패 확인** `cd care-app && npx jest src/__tests__/intakeStatus.test.ts` → FAIL(모듈 없음).

- [ ] **Step 3: 구현** `care-app/src/lib/intakeStatus.ts`

```ts
export type IntakeStatus = "completed" | "snoozed" | "skipped";
export type DisplayStatus = IntakeStatus | "missed" | "no_schedule";

export function statusLabel(s: DisplayStatus): string {
  switch (s) {
    case "completed": return "복용 완료";
    case "snoozed": return "30분 후 다시 알림";
    case "skipped": return "복약 누락 또는 미확인";
    case "missed": return "복약 누락 또는 미확인";
    case "no_schedule": return "복약 일정 없음";
  }
}
```

- [ ] **Step 4: 통과 확인** `npx jest src/__tests__/intakeStatus.test.ts` → 5 PASS.

- [ ] **Step 5: 타입/사용처 일괄 교체** (tsc 한 번에 맞추기)

`care-app/src/lib/supabase.ts`의 `IntakeStatus`/`IntakeRecord` 정의를 교체:
```ts
import type { IntakeStatus } from "./intakeStatus";
export type { IntakeStatus };
export type IntakeRecord = {
  id: string; patient_id: string; schedule_id: string;
  scheduled_for: string; status: IntakeStatus;
  response_method: "음성" | "버튼" | null; responded_at: string | null;
  created_at: string;
};
```
(기존 `export type IntakeStatus = "복용완료" | ...` 줄 제거.)

`care-app/src/components/StatusBadge.tsx`의 MAP을 영문 코드로:
```tsx
import { colors, radii, fontSizes } from "../theme/tokens";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react-native";
import type { IntakeStatus } from "../lib/intakeStatus";
import { statusLabel } from "../lib/intakeStatus";

const MAP: Record<IntakeStatus, { bg: string; Icon: any }> = {
  completed: { bg: colors.successGreen, Icon: CheckCircle2 },
  snoozed:   { bg: colors.warningOrange, Icon: Clock },
  skipped:   { bg: colors.dangerRed, Icon: AlertCircle },
};
```
그리고 라벨은 `statusLabel(status)` 사용. (배지 렌더 구조는 기존 유지, label/아이콘만 위 MAP/statusLabel로.)

`records.ts`/화면들에서 status 리터럴 사용처를 영문 코드로 교체:
- `AlarmScreen.tsx`: `write("복용완료"...)` → `write("completed"...)`, `write("미복용"...)` → (이 줄은 Task 4에서 "건너뛰기"=skipped로 바뀌지만 지금은) `write("skipped"...)`, `snooze`의 status `"재알림"` → `"snoozed"`.
- `STTResponseScreen.tsx`: 동일하게 `"복용완료"→"completed"`, `"미복용"→"skipped"`, 재알림 `"snoozed"`.
- `RecordScreen.tsx`, `GuardianDashboardScreen.tsx`: `r.status === "복용완료"` 비교 → `=== "completed"`, StatusBadge에 그대로 status 전달(영문). 표시 텍스트는 statusLabel 사용.

`records.ts`의 `recordIntake` status 파라미터 타입은 `IntakeStatus`(영문)로 자동 정합.

- [ ] **Step 6: 마이그레이션 SQL 작성 + 실행** `care-app/supabase/migrate-status.sql`
```sql
update intake_records set status = 'completed' where status = '복용완료';
update intake_records set status = 'snoozed'   where status = '재알림';
update intake_records set status = 'skipped'   where status in ('미복용','복용예정');
```
Supabase SQL Editor에서 1회 실행. (데모 데이터라 부담 적음.)

- [ ] **Step 7: 검증 + 커밋**
```bash
cd care-app && npx tsc --noEmit && npx jest
git add care-app/src/lib/intakeStatus.ts care-app/src/__tests__/intakeStatus.test.ts care-app/src/lib/supabase.ts care-app/src/components/StatusBadge.tsx care-app/src/lib/records.ts care-app/src/screens/RecordScreen.tsx care-app/src/screens/GuardianDashboardScreen.tsx care-app/src/screens/AlarmScreen.tsx care-app/src/screens/STTResponseScreen.tsx care-app/supabase/migrate-status.sql
git -c user.name="cruel" -c user.email="ahn1st2024@gmail.com" commit -m "refactor: unify intake status to english codes + status label mapping (TDD)"
```

---

## Task 2: 달력 로직 — 미응답 파생 + 색상 + 이행률 (TDD)

**Files:**
- Create: `care-app/src/lib/adherence.ts`
- Test: `care-app/src/__tests__/adherence.test.ts`

- [ ] **Step 1: 실패 테스트** `care-app/src/__tests__/adherence.test.ts`
```ts
import { dayMark, markColor, monthlyAdherence } from "../lib/adherence";

describe("dayMark", () => {
  it("일정 없음 → empty", () => expect(dayMark(0, 0, true)).toBe("empty"));
  it("모두 완료 → complete", () => expect(dayMark(3, 3, true)).toBe("complete"));
  it("과거 1회 누락 → warn", () => expect(dayMark(3, 2, true)).toBe("warn"));
  it("과거 2회+ 누락 → danger", () => expect(dayMark(3, 1, true)).toBe("danger"));
  it("미래/오늘 미완료 → future(중립)", () => expect(dayMark(3, 1, false)).toBe("future"));
});

describe("monthlyAdherence", () => {
  it("12/14 → 86", () => expect(monthlyAdherence(14, 12)).toBe(86));
  it("예정 0 → 0", () => expect(monthlyAdherence(0, 0)).toBe(0));
});
```

- [ ] **Step 2: 실패 확인** `npx jest src/__tests__/adherence.test.ts` → FAIL.

- [ ] **Step 3: 구현** `care-app/src/lib/adherence.ts`
```ts
import { colors } from "../theme/tokens";

export type DayMark = "complete" | "warn" | "danger" | "empty" | "future";

// slots: 그 날 예정 복약 수, completed: 완료 수, isPast: 그 날짜가 오늘 이전인지.
// 미래/오늘은 미완료여도 누락으로 penalize하지 않는다(future).
export function dayMark(slots: number, completed: number, isPast: boolean): DayMark {
  if (slots === 0) return "empty";
  if (completed >= slots) return "complete";
  if (!isPast) return "future";
  const missing = slots - completed;
  return missing >= 2 ? "danger" : "warn";
}

export function markColor(mark: DayMark): string | null {
  switch (mark) {
    case "complete": return colors.successGreen;
    case "warn": return colors.warningOrange;
    case "danger": return colors.dangerRed;
    case "empty":
    case "future": return null;
  }
}

export function monthlyAdherence(totalScheduled: number, totalCompleted: number): number {
  if (totalScheduled <= 0) return 0;
  return Math.round((totalCompleted / totalScheduled) * 100);
}
```

- [ ] **Step 4: 통과 확인** `npx jest src/__tests__/adherence.test.ts` → PASS.

- [ ] **Step 5: 커밋**
```bash
git add care-app/src/lib/adherence.ts care-app/src/__tests__/adherence.test.ts
git -c user.name="cruel" -c user.email="ahn1st2024@gmail.com" commit -m "feat: calendar day-mark + monthly adherence pure logic (TDD)"
```

---

## Task 3: 앱 이름 + 로고 컴포넌트

**Files:**
- Modify: `care-app/app.json` (skip-worktree — 로컬 편집, 커밋 안 됨)
- Create: `care-app/src/components/Logo.tsx`
- Modify: `care-app/src/screens/SplashScreen.tsx`

- [ ] **Step 1: 앱 이름 변경** `care-app/app.json`의 `expo.name`을 `"모두의 복약"`으로 변경. (skip-worktree라 git엔 안 올라가지만 빌드엔 반영.)

- [ ] **Step 2: Logo 컴포넌트** `care-app/src/components/Logo.tsx`
```tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pill } from "lucide-react-native";
import { colors, fontSizes } from "../theme/tokens";

export function Logo({ size = 64, showWordmark = true }: { size?: number; showWordmark?: boolean }) {
  return (
    <View style={styles.row}>
      <View style={[styles.badge, { width: size, height: size, borderRadius: size / 4 }]}>
        <Pill size={size * 0.5} color="#fff" />
      </View>
      {showWordmark ? <Text style={styles.wordmark}>모두의 복약</Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  badge: { backgroundColor: colors.primaryBlue, alignItems: "center", justifyContent: "center" },
  wordmark: { fontSize: fontSizes.title, fontWeight: "800", color: colors.primaryNavy },
});
```

- [ ] **Step 3: SplashScreen에 로고 반영** `care-app/src/screens/SplashScreen.tsx`에서 기존 브랜드 표시를 `<Logo size={88} />` + 문구로 교체(중앙 정렬). 문구는 "말로 쉽게 기록하는 복약 관리" 유지 가능.

- [ ] **Step 4: 검증 + 커밋**
```bash
cd care-app && npx tsc --noEmit
git add care-app/src/components/Logo.tsx care-app/src/screens/SplashScreen.tsx
git -c user.name="cruel" -c user.email="ahn1st2024@gmail.com" commit -m "feat: 모두의 복약 logo component + splash branding"
```
(app.json은 skip-worktree로 커밋 제외 — 정상.)

---

## Task 4: 인앱 복약 확인 화면 (버튼 3개, STT/건강질문 제거)

**Files:**
- Modify: `care-app/src/screens/AlarmScreen.tsx`
- Modify: `care-app/src/navigation/RootNavigator.tsx`, `care-app/src/navigation/types.ts` (StatusCheck/STTResponse 정리)
- Modify: `care-app/src/screens/STTResponseScreen.tsx` (흐름 제거)

- [ ] **Step 1: AlarmScreen 재구성**
- 마이크/`useSpeechToText`/`speech` 관련 코드 제거. 상단 `Bell` + 제목 "{시간대} 약 복용 시간입니다" + 안내문 "약을 드신 후 복용 완료를 눌러주세요." 유지.
- 버튼 3개(순서 고정):
```tsx
  <BigButton label="복용 완료" onPress={() => respond("completed")} />
  <BigButton label="30분 후 다시 알림" variant="secondary" onPress={() => respond("snoozed")} />
  <BigButton label="건너뛰기" variant="secondary" onPress={() => respond("skipped")} />
```
- `respond(status)` 통합 핸들러:
```tsx
  async function respond(status: "completed" | "snoozed" | "skipped") {
    const pid = await getPatientId();
    if (!pid || !scheduleId || !schedule) { nav.navigate("Tabs"); return; }
    const slot = doseSlot(schedule.hour, schedule.minute, new Date());
    try {
      await recordIntake({ patientId: pid, scheduleId, scheduledFor: slot, status, method: "버튼" });
      if (status === "snoozed") await scheduleSnooze(scheduleId, schedule.medicine_name, 30);
    } catch {
      Alert.alert("저장에 실패했어요", "인터넷 연결을 확인하고 다시 눌러 주세요.");
      return;
    }
    nav.navigate("Tabs");
  }
```
- **StatusCheck 경유 제거**: 응답 후 `nav.navigate("Tabs")`로 바로. 기존 `write`/`snooze`(음성/STTResponse 분기) 및 `speak` 호출은 정리(인앱 진입 시 안내 음성은 알림 사운드로 이미 재생됐으므로 인앱 TTS는 생략 가능 — 단순화).
- 표시 알림 해제(scheduleId 매칭) effect는 유지.

- [ ] **Step 2: 라우트 정리** `navigation/types.ts`에서 `StatusCheck` 라우트 제거(또는 보존하되 흐름에서 미사용). `RootNavigator.tsx`에서 `StatusCheck`/`STTResponse` Stack.Screen 등록 제거(파일은 남겨도 무방하나 라우트 미등록). `STTResponseScreen`은 복약 흐름에서 빠짐.

- [ ] **Step 3: 검증 + 커밋**
```bash
cd care-app && npx tsc --noEmit && npx jest
git add care-app/src/screens/AlarmScreen.tsx care-app/src/navigation/types.ts care-app/src/navigation/RootNavigator.tsx care-app/src/screens/STTResponseScreen.tsx
git -c user.name="cruel" -c user.email="ahn1st2024@gmail.com" commit -m "feat: in-app confirm screen with 3 buttons (complete/snooze/skip), remove STT+health question from flow"
```

---

## Task 5: 시간대별 고정 음성 mp3 사전 생성

**Files:**
- Create: `care-app/scripts/generate-sounds.mjs`
- Create: `care-app/assets/sounds/{morning,noon,evening,night}.mp3`

- [ ] **Step 1: 생성 스크립트** `care-app/scripts/generate-sounds.mjs`
```js
// 시간대별 고정 멘트를 엣지 함수 op=tts로 생성해 assets/sounds/에 저장.
import { writeFileSync, mkdirSync } from "node:fs";
const URL = "https://atzosfqrzsfrveympcfj.supabase.co/functions/v1/ai?op=tts";
const ANON = "sb_publishable_IxiFvJXOgllELr1E69-u-Q_34H6Oz8a";
const ments = {
  morning: "아침 약 복용 시간입니다. 약을 드신 후 복용 완료를 눌러주세요.",
  noon: "점심 약 복용 시간입니다. 약을 드신 후 복용 완료를 눌러주세요.",
  evening: "저녁 약 복용 시간입니다. 약을 드신 후 복용 완료를 눌러주세요.",
  night: "취침 약 복용 시간입니다. 약을 드신 후 복용 완료를 눌러주세요.",
};
mkdirSync("assets/sounds", { recursive: true });
for (const [key, text] of Object.entries(ments)) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ text, speed: 0.85 }),
  });
  if (!res.ok) throw new Error(`${key}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(`assets/sounds/${key}.mp3`, buf);
  console.log(`saved ${key}.mp3 (${buf.length} bytes)`);
}
```

- [ ] **Step 2: 실행 + 확인**
```bash
cd care-app && node scripts/generate-sounds.mjs
ls -la assets/sounds/ && file assets/sounds/morning.mp3
```
Expected: 4개 mp3 생성, `file`이 MPEG audio로 인식.

- [ ] **Step 3: 커밋**
```bash
git add care-app/scripts/generate-sounds.mjs care-app/assets/sounds
git -c user.name="cruel" -c user.email="ahn1st2024@gmail.com" commit -m "chore: pre-generate time-of-day alarm voice mp3s"
```

(참고: chime은 1차로 음성만으로 진행. 잔잔한 효과음 합성이 필요하면 Task 11 검증 후 별도 추가.)

---

## Task 6: 알림 사운드 번들 + 시간대별 채널 + 액션 버튼

**Files:**
- Modify: `care-app/app.json` (skip-worktree — plugins.sounds)
- Modify: `care-app/src/lib/notifications.ts`

- [ ] **Step 1: 사운드 번들 설정** `care-app/app.json`의 `plugins`에서 `"expo-notifications"`를 sounds 포함 형태로 교체:
```json
["expo-notifications", { "sounds": ["./assets/sounds/morning.mp3", "./assets/sounds/noon.mp3", "./assets/sounds/evening.mp3", "./assets/sounds/night.mp3"] }]
```
(이 config plugin이 mp3를 Android `res/raw` + iOS 번들로 복사. 런타임은 Notifee가 사용.)

- [ ] **Step 2: notifications.ts — 시간대별 채널 + 사운드 + 액션**
```ts
import notifee, {
  AndroidImportance, AndroidVisibility, AndroidCategory, TriggerType, RepeatFrequency,
} from "@notifee/react-native";
import { nextNotificationTime } from "./schedule";

type TOD = "아침" | "점심" | "저녁" | "취침";
const SOUND: Record<TOD, string> = { 아침: "morning", 점심: "noon", 저녁: "evening", 취침: "night" };
const CH: Record<TOD, string> = { 아침: "care-morning", 점심: "care-noon", 저녁: "care-evening", 취침: "care-night" };

async function ensureChannel(tod: TOD): Promise<string> {
  return notifee.createChannel({
    id: CH[tod], name: `복약 알람(${tod})`,
    importance: AndroidImportance.HIGH, sound: SOUND[tod], vibration: true,
    visibility: AndroidVisibility.PUBLIC,
  });
}

export async function ensurePermission(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= 1;
}

function androidAlarm(scheduleId: string, ch: string, sound: string) {
  return {
    channelId: ch, category: AndroidCategory.ALARM, importance: AndroidImportance.HIGH,
    sound,
    fullScreenAction: { id: "alarm", launchActivity: "default" },
    pressAction: { id: "alarm", launchActivity: "default" },
    actions: [
      { title: "복용 완료", pressAction: { id: "complete" } },
      { title: "30분 후 다시 알림", pressAction: { id: "snooze" } },
    ],
    loopSound: false, ongoing: true, autoCancel: false,
  };
}

function todOf(tod: string): TOD {
  return (["아침","점심","저녁","취침"].includes(tod) ? tod : "아침") as TOD;
}

export async function scheduleReminders(
  scheduleId: string, medicineName: string, hour: number, minute: number,
  repeatDays: number[], timeOfDay: string
): Promise<string[]> {
  const tod = todOf(timeOfDay);
  const ch = await ensureChannel(tod);
  const now = new Date();
  const base = {
    title: `${tod} 약 복용 시간입니다`,
    body: "약을 드신 후 복용 완료를 눌러주세요.",
    data: { scheduleId, hour: String(hour), minute: String(minute) },
    android: androidAlarm(scheduleId, ch, SOUND[tod]),
  };
  const ids: string[] = [];
  if (repeatDays.length === 0) {
    const t = nextNotificationTime({ hour, minute, repeat_days: [] }, now);
    ids.push(await notifee.createTriggerNotification(
      { id: `alarm-${scheduleId}`, ...base },
      { type: TriggerType.TIMESTAMP, timestamp: t.getTime(), repeatFrequency: RepeatFrequency.DAILY }));
  } else {
    for (const d of repeatDays) {
      const t = nextNotificationTime({ hour, minute, repeat_days: [d] }, now);
      ids.push(await notifee.createTriggerNotification(
        { id: `alarm-${scheduleId}-${d}`, ...base },
        { type: TriggerType.TIMESTAMP, timestamp: t.getTime(), repeatFrequency: RepeatFrequency.WEEKLY }));
    }
  }
  return ids;
}

export async function scheduleSnooze(
  scheduleId: string, medicineName: string, minutes: number
): Promise<string[]> {
  const ch = await ensureChannel("아침"); // 스누즈는 기본 채널 사운드
  const id = await notifee.createTriggerNotification(
    { id: `alarm-${scheduleId}-snooze`, title: "다시 알림", body: "약을 드신 후 복용 완료를 눌러주세요.",
      data: { scheduleId }, android: androidAlarm(scheduleId, ch, SOUND["아침"]) },
    { type: TriggerType.TIMESTAMP, timestamp: new Date().getTime() + minutes * 60 * 1000 });
  return [id];
}

export async function cancel(notificationId: string): Promise<void> {
  await notifee.cancelNotification(notificationId);
}
```
**호출부 수정**: `scheduleReminders`에 `timeOfDay` 인자 추가됨 → `ButtonRegisterScreen`/`VoiceRegisterScreen`의 호출에 `data.time_of_day`(또는 `tod` 상태) 전달:
- ButtonRegister: `scheduleReminders(data.id, data.medicine_name, hour, 0, data.repeat_days ?? [], data.time_of_day)`
- VoiceRegister: `scheduleReminders(data.id, data.medicine_name, parsed.hour, parsed.minute, parsed.repeat_days, parsed.time_of_day)`

- [ ] **Step 3: 검증 + 커밋**
```bash
cd care-app && npx tsc --noEmit && npx jest
git add care-app/src/lib/notifications.ts care-app/src/screens/ButtonRegisterScreen.tsx care-app/src/screens/VoiceRegisterScreen.tsx
git -c user.name="cruel" -c user.email="ahn1st2024@gmail.com" commit -m "feat: per-time-of-day alarm channels with bundled voice sound + lockscreen action buttons"
```

---

## Task 7: 알림 액션 버튼 백그라운드 처리

**Files:**
- Modify: `care-app/index.ts`, `care-app/App.tsx`

- [ ] **Step 1: index.ts onBackgroundEvent에서 ACTION_PRESS 처리**
```ts
import notifee, { EventType } from "@notifee/react-native";
import { setPendingAlarm } from "./src/lib/storage";
import { getPatientId } from "./src/lib/storage";
import { recordIntake } from "./src/lib/records";
import { scheduleSnooze, cancel } from "./src/lib/notifications";
import { doseSlot } from "./src/lib/schedule";

notifee.onBackgroundEvent(async ({ type, detail }) => {
  const data = detail.notification?.data as any;
  const scheduleId = data?.scheduleId as string | undefined;
  const nid = detail.notification?.id;
  if (type === EventType.PRESS) {
    if (scheduleId) await setPendingAlarm(scheduleId);
    return;
  }
  if (type === EventType.ACTION_PRESS && scheduleId) {
    const pid = await getPatientId();
    const hour = Number(data?.hour ?? 0), minute = Number(data?.minute ?? 0);
    const slot = doseSlot(hour, minute, new Date());
    try {
      if (detail.pressAction?.id === "complete" && pid) {
        await recordIntake({ patientId: pid, scheduleId, scheduledFor: slot, status: "completed", method: "버튼" });
      } else if (detail.pressAction?.id === "snooze" && pid) {
        await recordIntake({ patientId: pid, scheduleId, scheduledFor: slot, status: "snoozed", method: "버튼" });
        await scheduleSnooze(scheduleId, "", 30);
      }
    } catch {}
    if (nid) await cancel(nid).catch(() => {});
  }
});
```
(기존 registerRootComponent 유지.)

- [ ] **Step 2: App.tsx 포그라운드 ACTION_PRESS도 처리** `onForegroundEvent`에서 `EventType.ACTION_PRESS` 분기를 동일 로직으로 추가(포그라운드일 때 액션 버튼 눌러도 동작). 기존 PRESS→navigateToAlarm, pending 소비는 유지.

- [ ] **Step 3: 검증 + 커밋**
```bash
cd care-app && npx tsc --noEmit && npx jest
git add care-app/index.ts care-app/App.tsx
git -c user.name="cruel" -c user.email="ahn1st2024@gmail.com" commit -m "feat: handle lockscreen action buttons (complete/snooze) in background + foreground"
```

---

## Task 8: 갤럭시 하단 탭 safe-area

**Files:**
- Modify: `care-app/src/navigation/RootNavigator.tsx`

- [ ] **Step 1: PatientTabs에 safe-area bottom 반영**
`PatientTabs`에서 `useSafeAreaInsets()`의 `bottom`을 탭바에 반영:
```tsx
import { useSafeAreaInsets } from "react-native-safe-area-context";
// PatientTabs 내부:
const insets = useSafeAreaInsets();
// tabBarStyle:
tabBarStyle: {
  backgroundColor: colors.cardBg, borderTopColor: colors.border, borderTopWidth: 1,
  height: 64 + insets.bottom, paddingBottom: 8 + insets.bottom, paddingTop: 8,
},
```
(라우팅/initialRouteName/아이콘은 변경 없음.)

- [ ] **Step 2: 검증 + 커밋**
```bash
cd care-app && npx tsc --noEmit
git add care-app/src/navigation/RootNavigator.tsx
git -c user.name="cruel" -c user.email="ahn1st2024@gmail.com" commit -m "fix: bottom tab safe-area inset (avoid Galaxy nav bar overlap)"
```

---

## Task 9: 기록 탭 달력 화면 (P1)

**Files:**
- Modify: `care-app/package.json` (react-native-calendars)
- Modify: `care-app/src/screens/RecordScreen.tsx`

- [ ] **Step 1: 의존성 설치**
```bash
cd care-app && npx expo install react-native-calendars
```

- [ ] **Step 2: RecordScreen을 달력 중심으로 재구성**
- 상단 ScreenHeader "복약 기록" 유지 + "이번 달 복약 이행률: NN%"(monthlyAdherence).
- `useFocusEffect`에서: 이번 달 `schedules`(active) + `intake_records`(이번 달 범위) 조회.
- 날짜별 계산: 각 날짜의 예정 슬롯 수 = 그 날 active schedule 중 해당 요일에 해당하는 것 수(repeat_days 빈배열=매일), 완료 수 = 그 날 `completed` 기록 수. `dayMark(slots, completed, isPast)` → `markColor` → `react-native-calendars`의 `markedDates`에 `{ [yyyy-mm-dd]: { selected: true, selectedColor } }` 또는 `dots`로 색 적용.
- 이행률 = `monthlyAdherence(sum(slots, 과거+오늘), sum(completed))`.
- 날짜 탭 시 그 날짜의 기록 목록(약 이름 + statusLabel + StatusBadge)을 하단에 표시(기존 목록 재사용).
- 슬롯 계산 헬퍼는 `adherence.ts`/`schedule.ts`의 순수 함수 활용. (요일 매칭은 `repeat_days`로.)

- [ ] **Step 3: 검증 + 커밋**
```bash
cd care-app && npx tsc --noEmit && npx jest
git add care-app/package.json care-app/package-lock.json care-app/src/screens/RecordScreen.tsx
git -c user.name="cruel" -c user.email="ahn1st2024@gmail.com" commit -m "feat: calendar record view with day colors + monthly adherence"
```

---

## Task 10: 간단 회원가입(프로필) (P1)

**Files:**
- Modify: `care-app/supabase/schema.sql` + `care-app/supabase/migrate-profile.sql`
- Modify: `care-app/src/lib/supabase.ts` (Patient 타입), `care-app/src/screens/RoleSelectScreen.tsx`

- [ ] **Step 1: 스키마 컬럼 추가** `care-app/supabase/migrate-profile.sql`
```sql
alter table patients add column if not exists gender text;
alter table patients add column if not exists birth_date date;
alter table patients add column if not exists region text;
```
Supabase SQL Editor에서 1회 실행. `schema.sql`에도 동일 컬럼 반영(신규 환경용).

- [ ] **Step 2: Patient 타입 확장** `care-app/src/lib/supabase.ts`
```ts
export type Patient = {
  id: string; name: string; patient_code: string; created_at: string;
  gender?: string | null; birth_date?: string | null; region?: string | null;
};
```

- [ ] **Step 3: RoleSelectScreen 환자 가입에 필드 추가**
- 이름(기존) + 성별(남/여 큰 선택 버튼) + 생년월일(간단 입력, 예: 1948-03-05) + 거주지역(텍스트, 예: 전라북도 전주시). 모두 선택(필수 아님, 비워도 시작 가능).
- `startAsPatient`의 insert에 `gender, birth_date, region` 포함(빈 값은 null). 나머지 로직(makeCode/setPatient/setRole/nav.reset) 유지.

- [ ] **Step 4: 검증 + 커밋**
```bash
cd care-app && npx tsc --noEmit && npx jest
git add care-app/supabase/schema.sql care-app/supabase/migrate-profile.sql care-app/src/lib/supabase.ts care-app/src/screens/RoleSelectScreen.tsx
git -c user.name="cruel" -c user.email="ahn1st2024@gmail.com" commit -m "feat: simple profile signup (gender/birth_date/region)"
```

---

## Task 11: TTS 톤 튜닝 + 빌드 + 실기기 검증

**Files:**
- Modify: `care-app/supabase/functions/ai/index.ts` (op=tts voice/speed), `care-app/src/lib/tts.ts` (speed)

- [ ] **Step 1: 따뜻한 톤 적용** 엣지 함수 `op=tts`의 `voice`를 보호자 톤(예: `"shimmer"`)으로, speed 0.85로. `lib/tts.ts`의 기본 speed도 0.85. 재배포: `npx supabase functions deploy ai --project-ref atzosfqrzsfrveympcfj --use-api`. (사전 생성 mp3도 동일 톤이 되도록 Task 5 스크립트 voice/speed와 일치시킬 것 — 필요 시 Task 5 재실행.)

- [ ] **Step 2: 커밋**
```bash
git add care-app/supabase/functions/ai/index.ts care-app/src/lib/tts.ts
git -c user.name="cruel" -c user.email="ahn1st2024@gmail.com" commit -m "feat: warmer TTS voice + slower rate (caregiver tone)"
```

- [ ] **Step 3: 안드로이드 빌드** `npx eas-cli build -p android --profile preview --non-interactive --no-wait` → 완료까지 대기 → APK 설치.

- [ ] **Step 4: 실기기(갤럭시) 검증**
  - 소리모드: 알림 발생 시 **음성 즉시 재생**. 진동모드: 진동만.
  - 잠금화면 알림에 **[복용 완료][30분 후 다시 알림]** 버튼 → 눌러서 **앱 안 열고** 기록되는지(Supabase 확인).
  - 알림 본문 탭 → 인앱 3버튼 화면(복용완료/30분후/건너뛰기), 건강질문 없음.
  - 하단 탭이 시스템 네비바와 안 겹치는지.
  - 기록 탭 달력 색상/이행률, 회원가입 필드 입력.
  - 앱 이름 "모두의 복약" + 로고 표시.

- [ ] **Step 5: 이상 시 보완** 알림 사운드가 안 나오면 res/raw 번들/채널 sound 이름(확장자 없이) 확인. 액션 버튼 미동작 시 onBackgroundEvent 등록(index.ts) 확인.

---

## Self-Review 메모 (스펙 커버리지)

- §3-1 알림 즉시 음성 → Task 5(생성)+Task 6(채널/사운드). 진동모드는 OS 처리. ✅
- §3-2 액션 버튼 → Task 6(actions)+Task 7(백그라운드 처리). ✅
- §3-3/3-4 인앱 3버튼·STT/건강질문 제거·라벨 → Task 4. ✅
- §3-5 갤럭시 탭 → Task 8. ✅
- §3-6 이름/로고 → Task 3. ✅
- §4-1 status 코드 통일+마이그레이션 → Task 1. §4-2 missed 파생 → Task 2. ✅
- §4-3 달력 → Task 2(로직)+Task 9(화면). ✅
- §4-4 음성 톤 → Task 11. ✅
- §4-5 회원가입 → Task 10. ✅
- §2 P2 제외 — 어떤 태스크도 보호자 유료/AI전화/OCR 안 건드림. ✅
- 시그니처 일관성: `scheduleReminders(...timeOfDay)` 인자 추가를 호출부(Task 6 Step2)에 반영. `IntakeStatus=completed|snoozed|skipped` 전 사용처 Task 1에서 통일. `recordIntake` status 타입 정합. ✅
- 알려진 리스크: 알림 사운드 res/raw 번들(expo-notifications sounds 플러그인) 동작은 Task 11 빌드 후 검증(분기 명시). app.json은 skip-worktree라 plugins.sounds/name 변경이 커밋 안 됨 — 빌드는 로컬 app.json 사용하므로 OK(단 재클론 시 재설정 필요, 메모).

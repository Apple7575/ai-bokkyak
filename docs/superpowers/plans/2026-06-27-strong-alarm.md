# 강한 복약 알람 + 음성/온보딩/가입 수정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 복약 알람을 "응답할 때까지 계속 강하게 울리는" 알람시계 수준으로 끌어올리고(Android 포그라운드 서비스+loopSound+풀스크린, iOS 반복 알림 버스트), 잠시 미루기 피커/카운트다운 화면을 추가하며, 온보딩/가입/음성등록의 작은 결함을 고친다.

**Architecture:** 플랫폼 분리 알람. Android는 Notifee 포그라운드 서비스 + `loopSound`(소리 무한 루프) + 풀스크린 인텐트로 잠금화면 위에서 연속 울림. iOS는 30초 간격 Time-Sensitive 반복 알림 버스트 + 알림 진입 시 인앱 소리 루프. 순수 로직(발화 문장/스누즈 시각/슬롯 선별)은 분리해 jest로 단위 테스트하고, 화면·네이티브·알림은 실기기 수동 검증한다.

**Tech Stack:** React Native + Expo (managed, EAS), TypeScript, `@notifee/react-native`, `expo-av`, RN `Vibration`, jest. 미루기 휠은 추가 네이티브 모듈 없이 JS(ScrollView 스냅)로 구현.

## Global Constraints

- 모든 사용자 노출 문구는 **한국어**. 본문 ≥18px, 주요 버튼 높이 ≥56px.
- 디자인 토큰은 `src/theme/tokens.ts`에서만 가져온다. 색·폰트 하드코딩 금지.
- TTS/STT/알림 같은 SDK는 `lib/` 뒤에 둔다. 화면이 SDK를 직접 호출하지 않는다.
- 순수 로직(`spokenTime`, `snooze`, 슬롯 선별)은 RN/네트워크 의존 없이 jest 테스트.
- 설계 결정 유지: `repeat_days` 빈 배열=매일 / `intake_records`는 `onConflict:"schedule_id,scheduled_for"` upsert / 의도 우선순위 재알림>미복용>복용완료.
- 비동기 호출에 `await` 누락 금지. Supabase/`fetch` 에러는 Alert로 노출.
- 작업은 `feat/care-mvp` 브랜치. 구현 후 `npx tsc --noEmit` + `npx jest` 통과 + Codex 교차리뷰.
- 알람음 mp3는 시간대별 번들(`assets/sounds/{morning,noon,evening,night}.mp3`) 유지.

---

## File Structure

- **Create** `care-app/src/lib/spokenTime.ts` — `spokenTime(hour, minute)` 순수 발화 문장 생성.
- **Create** `care-app/src/lib/snooze.ts` — 스누즈 다음 발사 시각 계산(기간/정확시각) 순수 함수.
- **Create** `care-app/src/lib/doseSlotSelect.ts` — "지금 모두 먹기" 대상(같은 시각 슬롯) 선별 순수 함수.
- **Create** `care-app/src/lib/alarmRinger.ts` — 인앱 소리 루프 + 연속 진동 + 자동정지 컨트롤러.
- **Create** `care-app/src/lib/alarmPermissions.ts` — 정확알람/배터리최적화/풀스크린 권한 확인·안내.
- **Create** `care-app/src/components/WheelPicker.tsx` — JS 스크롤 스냅 휠.
- **Create** `care-app/src/screens/SnoozePickerScreen.tsx` — 미루기 피커.
- **Create** `care-app/src/screens/SnoozeCountdownScreen.tsx` — 미루기 후 카운트다운.
- **Create** tests: `care-app/src/__tests__/spokenTime.test.ts`, `snooze.test.ts`, `doseSlotSelect.test.ts`.
- **Modify** `care-app/src/lib/notifications.ts` — 포그라운드서비스/loopSound/강한진동 알람, iOS 버스트, `scheduleSnooze` 확장, `stopAlarm`.
- **Modify** `care-app/index.ts` — 포그라운드 서비스 러너 등록 + 이벤트에서 `stopAlarm`.
- **Modify** `care-app/App.tsx` — foreground 이벤트에서 `stopAlarm`, iOS 버스트 재무장(AppState).
- **Modify** `care-app/src/screens/AlarmScreen.tsx` — 진입 시 링어 시작, 응답/언마운트 시 정지.
- **Modify** `care-app/src/screens/VoiceRegisterScreen.tsx` — `spokenTime` 발화 + 약 이름 수정 입력칸.
- **Modify** `care-app/src/screens/OnboardingScreen.tsx` — 로고 제거.
- **Modify** `care-app/src/screens/RoleSelectScreen.tsx` — `placeholderTextColor` 진하게.
- **Modify** `care-app/src/navigation/types.ts` + `RootNavigator.tsx` — SnoozePicker/SnoozeCountdown 라우트.
- **Modify** `care-app/app.json` — 포그라운드 서비스 권한 + iOS Time-Sensitive 엔타이틀먼트 + notifee 플러그인.

---

## Task 1: 발화 문장 헬퍼 `spokenTime` (음성 "오후 10시 30분")

**Files:**
- Create: `care-app/src/lib/spokenTime.ts`
- Test: `care-app/src/__tests__/spokenTime.test.ts`

**Interfaces:**
- Produces: `spokenTime(hour: number, minute: number): string`

- [ ] **Step 1: Write the failing test**

```ts
// care-app/src/__tests__/spokenTime.test.ts
import { spokenTime } from "../lib/spokenTime";

describe("spokenTime", () => {
  it("오전/오후 + 12시간제로 읽고 분을 포함한다", () => {
    expect(spokenTime(22, 30)).toBe("오후 10시 30분");
    expect(spokenTime(8, 0)).toBe("오전 8시");        // 분 0이면 분 생략
    expect(spokenTime(13, 5)).toBe("오후 1시 5분");
  });
  it("자정/정오 경계", () => {
    expect(spokenTime(0, 0)).toBe("오전 12시");
    expect(spokenTime(12, 0)).toBe("오후 12시");
    expect(spokenTime(0, 15)).toBe("오전 12시 15분");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd care-app && npx jest spokenTime`
Expected: FAIL — `Cannot find module '../lib/spokenTime'`

- [ ] **Step 3: Write minimal implementation**

```ts
// care-app/src/lib/spokenTime.ts
// 복약 시각을 자연스러운 한국어 음성 문장으로. TTS가 "22시"를 "스물두시"로 읽거나
// 분을 빠뜨리던 문제 해결 — 오전/오후 12시간제 + 분 포함.
export function spokenTime(hour: number, minute: number): string {
  const ap = hour < 12 ? "오전" : "오후";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const base = `${ap} ${h12}시`;
  return minute > 0 ? `${base} ${minute}분` : base;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd care-app && npx jest spokenTime`
Expected: PASS (5 assertions)

- [ ] **Step 5: Commit**

```bash
git add care-app/src/lib/spokenTime.ts care-app/src/__tests__/spokenTime.test.ts
git commit -m "feat: spokenTime 발화 헬퍼(오전/오후+분)"
```

---

## Task 2: 음성 등록 화면 — 자연 발화 + 약 이름 수정

**Files:**
- Modify: `care-app/src/screens/VoiceRegisterScreen.tsx`

**Interfaces:**
- Consumes: `spokenTime(hour, minute)` (Task 1)

- [ ] **Step 1: 확인 음성에 `spokenTime` 적용 + 약 이름을 편집 가능한 상태로 보관**

`VoiceRegisterScreen.tsx` 상단 import에 추가:
```ts
import { TextInput } from "react-native";
import { spokenTime } from "../lib/spokenTime";
```
`onSpeechFinal` 안의 확인 음성 한 줄을 교체:
```ts
// 변경 전: await speak(`${result.value.hour}시, ${result.value.medicine_name}으로 등록할까요?`);
await speak(`${spokenTime(result.value.hour, result.value.minute)}, ${result.value.medicine_name}으로 등록할까요?`);
```

- [ ] **Step 2: 결과 카드의 약 이름을 TextInput으로 수정 가능하게**

`parsed` 상태는 그대로 두되, 약 이름 행(`resultValue`로 `parsed.medicine_name`을 보여주던 부분)을 편집 입력칸으로 교체:
```tsx
{/* 약 이름 — 직접 수정 가능 */}
<View style={styles.resultRow}>
  <View style={styles.resultIcon}><Pill size={18} color={colors.primaryBlue} /></View>
  <Text style={styles.resultLabel}>약 이름</Text>
  <TextInput
    style={styles.nameInput}
    value={parsed.medicine_name}
    onChangeText={(t) => setParsed({ ...parsed, medicine_name: t })}
    placeholder="약 이름"
    placeholderTextColor={colors.textSecondary}
  />
</View>
```
스타일에 추가:
```ts
nameInput: {
  marginLeft: "auto", minWidth: 140, textAlign: "right",
  fontSize: fontSizes.body, fontWeight: "700", color: colors.text,
  borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 4,
},
```
`confirm()`은 이미 `parsed.medicine_name`을 사용하므로 수정된 이름이 그대로 저장된다.

- [ ] **Step 3: 타입체크**

Run: `cd care-app && npx tsc --noEmit`
Expected: 출력 없음(에러 0).

- [ ] **Step 4: 수동 검증(실기기/시뮬레이터)**

"저녁 10시 30분에 혈압약" 음성 → 확인 음성이 **"오후 10시 30분, 혈압약으로 등록할까요?"** 로 들리는지, 약 이름 칸을 "고혈압약"으로 고쳐 등록하면 그 이름으로 저장되는지 확인.

- [ ] **Step 5: Commit**

```bash
git add care-app/src/screens/VoiceRegisterScreen.tsx
git commit -m "feat: 음성등록 자연 발화(분 포함) + 약 이름 수정"
```

---

## Task 3: 온보딩 로고 제거 + 가입 플레이스홀더 가시성

**Files:**
- Modify: `care-app/src/screens/OnboardingScreen.tsx`
- Modify: `care-app/src/screens/RoleSelectScreen.tsx`

- [ ] **Step 1: 온보딩에서 로고 제거**

`OnboardingScreen.tsx`에서 `import { Logo } ...` 줄과 `<View style={s.logoWrap}><Logo .../></View>` 블록을 삭제. (말풍선 카드와 회원가입하기 버튼·음성 안내는 유지.) `logoWrap` 스타일도 제거.

- [ ] **Step 2: 가입 플레이스홀더 색 진하게**

`RoleSelectScreen.tsx`의 모든 `TextInput`(이름/생년월일/거주지역/전화번호)에 `placeholderTextColor={colors.textSecondary}`가 없으면 추가. 이름 칸은 현재 placeholder 색이 지정되지 않아 시스템 기본(연한 색)이므로 명시 추가:
```tsx
<TextInput style={styles.input} value={name} onChangeText={setName}
  placeholder="예: 김복약" placeholderTextColor={colors.textSecondary} />
```
(`colors.textSecondary`가 너무 연하면 `colors.text`로. 토큰 확인: `src/theme/tokens.ts`.)

- [ ] **Step 3: 타입체크 + 수동 확인**

Run: `cd care-app && npx tsc --noEmit` → 에러 0.
온보딩에 로고가 사라지고, 가입 입력칸 예시 문구가 또렷하게 보이는지 확인.

- [ ] **Step 4: Commit**

```bash
git add care-app/src/screens/OnboardingScreen.tsx care-app/src/screens/RoleSelectScreen.tsx
git commit -m "fix: 온보딩 로고 제거 + 가입 플레이스홀더 가시성"
```

---

## Task 4: 스누즈 시각 계산 헬퍼 `snooze`

**Files:**
- Create: `care-app/src/lib/snooze.ts`
- Test: `care-app/src/__tests__/snooze.test.ts`

**Interfaces:**
- Produces:
  - `type SnoozeSpec = { mode: "duration"; minutes: number } | { mode: "exact"; hour: number; minute: number }`
  - `nextSnoozeFire(spec: SnoozeSpec, now: Date): Date` — 다음 발사 시각.

- [ ] **Step 1: Write the failing test**

```ts
// care-app/src/__tests__/snooze.test.ts
import { nextSnoozeFire } from "../lib/snooze";

describe("nextSnoozeFire", () => {
  const now = new Date("2026-06-27T11:00:00");
  it("기간: now + 분", () => {
    expect(nextSnoozeFire({ mode: "duration", minutes: 5 }, now).getTime())
      .toBe(new Date("2026-06-27T11:05:00").getTime());
  });
  it("정확시각: 오늘의 그 시각(미래면 오늘)", () => {
    expect(nextSnoozeFire({ mode: "exact", hour: 13, minute: 30 }, now).getTime())
      .toBe(new Date("2026-06-27T13:30:00").getTime());
  });
  it("정확시각이 이미 지났으면 내일", () => {
    expect(nextSnoozeFire({ mode: "exact", hour: 9, minute: 0 }, now).getTime())
      .toBe(new Date("2026-06-28T09:00:00").getTime());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd care-app && npx jest snooze`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// care-app/src/lib/snooze.ts
export type SnoozeSpec =
  | { mode: "duration"; minutes: number }
  | { mode: "exact"; hour: number; minute: number };

// 미루기 다음 발사 시각. 기간이면 now+분, 정확시각이면 오늘 그 시각(지났으면 내일).
export function nextSnoozeFire(spec: SnoozeSpec, now: Date): Date {
  if (spec.mode === "duration") {
    return new Date(now.getTime() + spec.minutes * 60_000);
  }
  const d = new Date(now);
  d.setHours(spec.hour, spec.minute, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd care-app && npx jest snooze` → PASS (3 assertions).

- [ ] **Step 5: Commit**

```bash
git add care-app/src/lib/snooze.ts care-app/src/__tests__/snooze.test.ts
git commit -m "feat: 스누즈 다음 발사 시각 계산"
```

---

## Task 5: "지금 모두 먹기" 슬롯 선별 헬퍼 `doseSlotSelect`

**Files:**
- Create: `care-app/src/lib/doseSlotSelect.ts`
- Test: `care-app/src/__tests__/doseSlotSelect.test.ts`

**Interfaces:**
- Produces: `dueAtSlot(schedules: {id:string;hour:number;minute:number;active?:boolean}[], hour: number, minute: number): string[]` — 같은 시각(hour:minute)의 활성 일정 id 목록.

- [ ] **Step 1: Write the failing test**

```ts
// care-app/src/__tests__/doseSlotSelect.test.ts
import { dueAtSlot } from "../lib/doseSlotSelect";

const S = (id: string, h: number, m: number, active = true) => ({ id, hour: h, minute: m, active });

describe("dueAtSlot", () => {
  it("같은 시각의 활성 일정 id만 반환", () => {
    const list = [S("a", 13, 0), S("b", 13, 0), S("c", 8, 0), S("d", 13, 0, false)];
    expect(dueAtSlot(list, 13, 0).sort()).toEqual(["a", "b"]);
  });
  it("일치 없으면 빈 배열", () => {
    expect(dueAtSlot([S("a", 8, 0)], 13, 0)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd care-app && npx jest doseSlotSelect` → FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// care-app/src/lib/doseSlotSelect.ts
// "지금 모두 먹기" 대상: 같은 시각(hour:minute)에 예정된 활성 일정들.
type Slot = { id: string; hour: number; minute: number; active?: boolean };
export function dueAtSlot(schedules: Slot[], hour: number, minute: number): string[] {
  return schedules
    .filter((s) => s.active !== false && s.hour === hour && s.minute === minute)
    .map((s) => s.id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd care-app && npx jest doseSlotSelect` → PASS.

- [ ] **Step 5: Commit**

```bash
git add care-app/src/lib/doseSlotSelect.ts care-app/src/__tests__/doseSlotSelect.test.ts
git commit -m "feat: 지금 모두 먹기 슬롯 선별 헬퍼"
```

---

## Task 6: 인앱 링어 `alarmRinger` (소리 루프 + 연속 진동 + 자동정지)

**Files:**
- Create: `care-app/src/lib/alarmRinger.ts`

**Interfaces:**
- Produces:
  - `startRinging(timeOfDay: string, onAutoStop?: () => void): Promise<void>` — 번들 알람음 루프 + 강한 진동 반복 시작, ~2.5분 후 자동정지(콜백 호출).
  - `stopRinging(): Promise<void>` — 소리·진동·타이머 모두 정지.

- [ ] **Step 1: 구현 (expo-av 루프 + RN Vibration 반복 + 타임아웃)**

```ts
// care-app/src/lib/alarmRinger.ts
import { Audio } from "expo-av";
import { Vibration, Platform } from "react-native";

const SOUNDS: Record<string, number> = {
  아침: require("../../assets/sounds/morning.mp3"),
  점심: require("../../assets/sounds/noon.mp3"),
  저녁: require("../../assets/sounds/evening.mp3"),
  취침: require("../../assets/sounds/night.mp3"),
};
const MAX_MS = 150_000; // ~2.5분 후 자동정지
const VIBRATION_PATTERN = [0, 800, 400, 800, 400]; // 강한 진동

let sound: Audio.Sound | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

export async function startRinging(timeOfDay: string, onAutoStop?: () => void): Promise<void> {
  await stopRinging();
  try {
    Vibration.vibrate(VIBRATION_PATTERN, true); // 두 번째 인자 true=반복
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: false });
    const asset = SOUNDS[timeOfDay] ?? SOUNDS["아침"];
    const created = await Audio.Sound.createAsync(asset, { isLooping: true, shouldPlay: true });
    sound = created.sound;
    timer = setTimeout(() => { stopRinging().finally(() => onAutoStop?.()); }, MAX_MS);
  } catch {
    // 실패해도 화면 흐름은 막지 않는다.
  }
}

export async function stopRinging(): Promise<void> {
  if (timer) { clearTimeout(timer); timer = null; }
  Vibration.cancel();
  if (sound) {
    try { await sound.stopAsync(); await sound.unloadAsync(); } catch {}
    sound = null;
  }
}

// (Platform import는 추후 iOS 분기 확장 여지를 위해 유지)
void Platform;
```

- [ ] **Step 2: 타입체크**

Run: `cd care-app && npx jest && npx tsc --noEmit`
Expected: 기존 테스트 그대로 통과, tsc 에러 0.

- [ ] **Step 3: Commit**

```bash
git add care-app/src/lib/alarmRinger.ts
git commit -m "feat: 인앱 알람 링어(소리 루프+연속 진동+자동정지)"
```

---

## Task 7: 알림 코어 — Android 포그라운드 서비스 + loopSound + 강한 진동, iOS 버스트, stopAlarm

**Files:**
- Modify: `care-app/src/lib/notifications.ts`

**Interfaces:**
- Consumes: 기존 `ensureChannel`, `exactAlarmOption`, `todOf`, `nextNotificationTime`.
- Produces (export):
  - `scheduleReminders(...)` (기존 시그니처 유지, 내부 강화)
  - `scheduleSnooze(scheduleId, medicineName, spec: SnoozeSpec, hour, minute, timeOfDay)` — **시그니처 변경**(분/정확시각 지원)
  - `scheduleIosBurst(scheduleId, timeOfDay, hour, minute)` — iOS 다음 발사용 30초 간격 6개 예약
  - `stopAlarm(scheduleId)` — 포그라운드 서비스 중지 + 반복/버스트/표시 알림 제거
  - `cancelSchedule`, `cancelRepeat` (기존 유지)

- [ ] **Step 1: 강한 알람 알림 빌더로 교체 (loopSound + asForegroundService + 강한 진동)**

`androidAlarm`을 아래로 교체(강한 진동 패턴 + 루프 + 포그라운드 서비스):
```ts
const STRONG_VIBRATION = [0, 800, 400, 800, 400, 800];
function androidAlarm(scheduleId: string, ch: string, sound: string) {
  return {
    channelId: ch, category: AndroidCategory.ALARM, importance: AndroidImportance.HIGH,
    sound, loopSound: true, vibrationPattern: STRONG_VIBRATION,
    asForegroundService: true,
    fullScreenAction: { id: "alarm", launchActivity: "default" },
    pressAction: { id: "alarm", launchActivity: "default" },
    actions: [
      { title: "지금 약 먹기", pressAction: { id: "complete" } },
      { title: "잠시 미루기", pressAction: { id: "snooze" } },
    ],
    ongoing: true, autoCancel: false,
  };
}
```
iOS는 `alarmNotification`에서 `ios: { categoryId: "care-alarm", sound: \`${SOUND[tod]}.mp3\`, interruptionLevel: "timeSensitive" }` 로 설정(분기 추가).

- [ ] **Step 2: `stopAlarm` 추가 (응답·정지 공통)**

```ts
// 포그라운드 서비스 중지 + 반복/버스트/표시 알림 제거
export async function stopAlarm(scheduleId: string): Promise<void> {
  try { await notifee.stopForegroundService(); } catch {}
  await cancelRepeat(scheduleId);
  // iOS 버스트(-burstN) 및 표시 알림 제거
  for (let i = 0; i < 8; i++) { try { await notifee.cancelNotification(`alarm-${scheduleId}-burst-${i}`); } catch {} }
  try {
    const displayed = await notifee.getDisplayedNotifications();
    for (const n of displayed) {
      if (n.notification?.data?.scheduleId === scheduleId && n.id) await notifee.cancelDisplayedNotification(n.id);
    }
  } catch {}
}
```

- [ ] **Step 3: iOS 버스트 예약 함수**

```ts
// iOS는 백그라운드 체인이 안 되므로 다음 발사분의 30초 간격 6개를 미리 예약(Time-Sensitive).
// 응답 시 stopAlarm이 모두 취소. 매일 재무장은 App의 AppState에서.
export async function scheduleIosBurst(scheduleId: string, timeOfDay: string, hour: number, minute: number): Promise<void> {
  if (Platform.OS !== "ios") return;
  const tod = todOf(timeOfDay);
  const base = nextNotificationTime({ hour, minute, repeat_days: [] }, new Date()).getTime();
  for (let i = 1; i <= 6; i++) {
    await notifee.createTriggerNotification(
      { id: `alarm-${scheduleId}-burst-${i}`, title: `${tod} 약 복용 시간입니다`,
        body: "약을 드신 후 '지금 약 먹기'를 눌러주세요.",
        data: { scheduleId, hour: String(hour), minute: String(minute), tod, seq: String(i) },
        ios: { categoryId: "care-alarm", sound: `${SOUND[tod]}.mp3`, interruptionLevel: "timeSensitive" } },
      { type: TriggerType.TIMESTAMP, timestamp: base + i * 30_000 });
  }
}
```
(파일 상단에 `import { Platform } from "react-native";` 추가.)

- [ ] **Step 4: `scheduleSnooze` 시그니처 확장 (분/정확시각)**

```ts
import { SnoozeSpec, nextSnoozeFire } from "./snooze";
export async function scheduleSnooze(
  scheduleId: string, medicineName: string, spec: SnoozeSpec,
  hour: number, minute: number, timeOfDay: string = "아침"
): Promise<string[]> {
  const tod = todOf(timeOfDay);
  const ch = await ensureChannel(tod);
  const fireAt = nextSnoozeFire(spec, new Date()).getTime();
  const id = await notifee.createTriggerNotification(
    { id: `alarm-${scheduleId}-snooze`, ...alarmNotification(scheduleId, tod, ch, hour, minute, 0), title: "다시 알림" },
    { type: TriggerType.TIMESTAMP, timestamp: fireAt, ...(await exactAlarmOption()) });
  return [id];
}
```

- [ ] **Step 5: `scheduleReminders`에서 iOS 버스트 동반 예약**

`scheduleReminders` 마지막 `return ids;` 직전에:
```ts
await scheduleIosBurst(scheduleId, timeOfDay, hour, minute);
```

- [ ] **Step 6: 타입체크**

Run: `cd care-app && npx tsc --noEmit`
Expected: 에러 0. (`scheduleSnooze` 호출부는 Task 9·App에서 새 시그니처로 갱신.)

- [ ] **Step 7: Commit**

```bash
git add care-app/src/lib/notifications.ts
git commit -m "feat: 강한 알람(loopSound+포그라운드서비스+강진동) + iOS 버스트 + stopAlarm"
```

---

## Task 8: 포그라운드 서비스 러너 등록 + 이벤트에서 stopAlarm (index.ts / App.tsx)

**Files:**
- Modify: `care-app/index.ts`
- Modify: `care-app/App.tsx`

**Interfaces:**
- Consumes: `stopAlarm`, `scheduleSnooze`, `scheduleIosBurst`(App), `cancelRepeat`.

- [ ] **Step 1: index.ts — 포그라운드 서비스 러너 등록**

`registerRootComponent(App);` 앞에:
```ts
// 포그라운드 서비스: 알림이 asForegroundService로 표시되는 동안 서비스를 살려둠.
// 소리는 loopSound가, 표시 알림 정지는 stopAlarm이 담당. 러너는 외부 정지까지 대기.
notifee.registerForegroundService(() => new Promise(() => {}));
```

- [ ] **Step 2: index.ts — 백그라운드 이벤트에서 stopAlarm 사용**

`onBackgroundEvent`의 ACTION_PRESS 처리에서 `complete`는 그대로 기록하되, snooze 버튼은 이제 **미루기 화면을 열어야** 하므로 앱을 띄운다(잠금화면 액션에서 직접 시각선택은 불가). 처리:
```ts
if (detail.pressAction?.id === "complete") {
  await recordIntake({ patientId: pid, scheduleId, scheduledFor: slot, status: "completed", method: "버튼" });
  await stopAlarm(scheduleId);
} else if (detail.pressAction?.id === "snooze") {
  // 미루기 화면에서 시각 선택하도록 앱 진입 예약
  await setPendingAlarm(scheduleId);
  await stopAlarm(scheduleId);
}
```
DELIVERED의 30초 반복 체인(`scheduleRepeatFollowup`)은 **Android에서만** 의미가 있으므로 유지(자동정지 이후 재발사). import에 `stopAlarm` 추가, 기존 `scheduleSnooze(...,"")` 호출은 제거(미루기는 화면에서).

- [ ] **Step 3: App.tsx — foreground 이벤트에서 stopAlarm + 미루기 진입**

ACTION_PRESS의 complete/snooze를 index와 동일 의미로 맞추고, snooze는 `navigateToAlarm(sid)`로 알람 화면 진입(거기서 잠시 미루기 버튼). `cancelRepeat` 대신 `stopAlarm(sid)` 사용. import 갱신.

- [ ] **Step 4: App.tsx — iOS 버스트 매일 재무장**

AppState `active` 핸들러(`consumePending` 옆)에서 iOS면 활성 일정들의 다음 버스트를 재예약:
```ts
// iOS: 앱이 활성화될 때 활성 일정의 다음 버스트를 재무장(매일 1회분 미리 깔기)
if (Platform.OS === "ios") {
  const pid = await getPatientId();
  if (pid) {
    const { data } = await supabase.from("schedules").select("*").eq("patient_id", pid).eq("active", true);
    for (const s of data ?? []) await scheduleIosBurst(s.id, s.time_of_day, s.hour, s.minute);
  }
}
```
(import: `Platform`, `supabase`, `getPatientId`, `scheduleIosBurst`.)

- [ ] **Step 5: 타입체크**

Run: `cd care-app && npx tsc --noEmit` → 에러 0.

- [ ] **Step 6: Commit**

```bash
git add care-app/index.ts care-app/App.tsx
git commit -m "feat: 포그라운드 서비스 러너 + 이벤트 stopAlarm + iOS 버스트 재무장"
```

---

## Task 9: AlarmScreen — 진입 시 연속 울림, 응답/언마운트 시 정지

**Files:**
- Modify: `care-app/src/screens/AlarmScreen.tsx`

**Interfaces:**
- Consumes: `startRinging`, `stopRinging` (Task 6), `stopAlarm` (Task 7), `scheduleSnooze`(미사용 — 미루기는 SnoozePicker로 이동).

- [ ] **Step 1: 진입 시 링어 시작 (개인화 음성 1회 후 루프)**

기존 announce useEffect를 교체: 개인화 안내(`speak`) 1회 재생 후 **연속 링어 시작**. 그리고 `cancelRepeat`였던 자리를 `stopAlarm`로:
```ts
import { startRinging, stopRinging } from "../lib/alarmRinger";
import { stopAlarm } from "../lib/notifications";
// ...
useEffect(() => {
  let cancelled = false;
  (async () => {
    if (!scheduleId) return;
    await stopAlarm(scheduleId); // 화면 진입=인지 → 알림측 소리/반복 정지
    const { data } = await supabase.from("schedules").select("*").eq("id", scheduleId).single();
    if (cancelled) return;
    setSchedule(data);
    if (data) {
      const todStr = data.time_of_day || "아침";
      // 인앱 연속 울림(소리 루프+진동). ~2.5분 자동정지.
      await startRinging(todStr, () => {});
    }
  })();
  return () => { cancelled = true; stopRinging(); };
}, [scheduleId]);
```
(기존 개인화 `speak` 호출은 제거 또는 startRinging 전 1회 호출로 유지. 우선 단순화를 위해 링어만.)

- [ ] **Step 2: 버튼 동작 — 응답 시 링어+알림 정지**

`respond(status)`에서 기록 전 `await stopRinging();`를, snooze 버튼은 미루기 화면으로 이동:
```ts
async function respond(status: "completed" | "skipped") {
  await stopRinging();
  const pid = await getPatientId();
  if (!pid || !scheduleId || !schedule) { nav.navigate("Tabs"); return; }
  const slot = doseSlot(schedule.hour, schedule.minute, new Date());
  try {
    await recordIntake({ patientId: pid, scheduleId, scheduledFor: slot, status, method: "버튼" });
    await stopAlarm(scheduleId);
  } catch { Alert.alert("저장에 실패했어요", "인터넷 연결을 확인하고 다시 눌러 주세요."); return; }
  nav.navigate("Tabs");
}
function goSnooze() {
  stopRinging();
  nav.navigate("SnoozePicker", { scheduleId });
}
```
버튼 3개: `[지금 약 먹기]`→`respond("completed")`, `[안 먹고 건너뛰기]`→`respond("skipped")`, `[잠시 미루기]`→`goSnooze()`.

- [ ] **Step 3: 타입체크 + 수동 검증(실기기)**

Run: `cd care-app && npx tsc --noEmit` → 에러 0.
실기기: 알람 화면 진입 시 소리가 끊김 없이 루프 + 진동 지속, 버튼 누르면 즉시 정지, 2.5분 방치 시 자동 정지.

- [ ] **Step 4: Commit**

```bash
git add care-app/src/screens/AlarmScreen.tsx
git commit -m "feat: AlarmScreen 연속 울림(링어) + 잠시 미루기 진입"
```

---

## Task 10: JS 휠 컴포넌트 `WheelPicker`

**Files:**
- Create: `care-app/src/components/WheelPicker.tsx`

**Interfaces:**
- Produces: `WheelPicker({ values: number[]; value: number; onChange: (v: number) => void; suffix?: string })`

- [ ] **Step 1: 구현 (ScrollView 스냅 휠)**

```tsx
// care-app/src/components/WheelPicker.tsx
import React, { useRef } from "react";
import { ScrollView, View, Text, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { colors, fontSizes } from "../theme/tokens";

const ITEM_H = 48;
type Props = { values: number[]; value: number; onChange: (v: number) => void; suffix?: string };

export function WheelPicker({ values, value, onChange, suffix }: Props) {
  const ref = useRef<ScrollView>(null);
  const idx = Math.max(0, values.indexOf(value));
  function onEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const v = values[Math.min(values.length - 1, Math.max(0, i))];
    if (v !== value) onChange(v);
  }
  return (
    <View style={styles.wrap}>
      <View style={styles.selBar} pointerEvents="none" />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: idx * ITEM_H }}
        contentContainerStyle={{ paddingVertical: ITEM_H }}
        onMomentumScrollEnd={onEnd}
      >
        {values.map((v) => (
          <View key={v} style={styles.item}>
            <Text style={[styles.txt, v === value && styles.txtOn]}>{v}{suffix ?? ""}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { height: ITEM_H * 3, width: 120, justifyContent: "center" },
  selBar: { position: "absolute", top: ITEM_H, left: 0, right: 0, height: ITEM_H,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  item: { height: ITEM_H, alignItems: "center", justifyContent: "center" },
  txt: { fontSize: fontSizes.emphasis, color: colors.textSecondary },
  txtOn: { color: colors.primaryNavy, fontWeight: "800" },
});
```

- [ ] **Step 2: 타입체크**

Run: `cd care-app && npx tsc --noEmit` → 에러 0.

- [ ] **Step 3: Commit**

```bash
git add care-app/src/components/WheelPicker.tsx
git commit -m "feat: JS 휠 피커 컴포넌트"
```

---

## Task 11: 잠시 미루기 화면 `SnoozePickerScreen`

**Files:**
- Create: `care-app/src/screens/SnoozePickerScreen.tsx`

**Interfaces:**
- Consumes: `WheelPicker`(Task 10), `SnoozeSpec`/`nextSnoozeFire`(Task 4), `scheduleSnooze`(Task 7), `BigButton`, `TimeChip`.
- Produces: 라우트 `SnoozePicker: { scheduleId: string }`(Task 13에서 등록).

- [ ] **Step 1: 구현 (기간/정확시각 탭 + 휠 + 프리셋)**

```tsx
// care-app/src/screens/SnoozePickerScreen.tsx
import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { BigButton } from "../components/BigButton";
import { ScreenHeader } from "../components/ScreenHeader";
import { WheelPicker } from "../components/WheelPicker";
import { supabase } from "../lib/supabase";
import { scheduleSnooze } from "../lib/notifications";
import { SnoozeSpec, nextSnoozeFire } from "../lib/snooze";
import { spokenTime } from "../lib/spokenTime";
import { colors, fontSizes, spacing, radii } from "../theme/tokens";

const MIN_VALUES = Array.from({ length: 60 }, (_, i) => i + 1);
const HOUR_VALUES = Array.from({ length: 24 }, (_, i) => i);

export function SnoozePickerScreen() {
  const nav = useNavigation<any>();
  const scheduleId: string = useRoute<any>().params?.scheduleId;
  const [tab, setTab] = useState<"duration" | "exact">("duration");
  const [minutes, setMinutes] = useState(5);
  const [exH, setExH] = useState(new Date().getHours());
  const [exM, setExM] = useState(0);

  async function apply(spec: SnoozeSpec) {
    const { data: sch } = await supabase.from("schedules").select("*").eq("id", scheduleId).single();
    if (!sch) { nav.navigate("Tabs"); return; }
    try {
      await scheduleSnooze(scheduleId, sch.medicine_name, spec, sch.hour, sch.minute, sch.time_of_day);
    } catch { Alert.alert("다시 알림 설정 실패", "인터넷 연결을 확인해 주세요."); return; }
    const fireAt = nextSnoozeFire(spec, new Date()).toISOString();
    nav.reset({ index: 0, routes: [{ name: "SnoozeCountdown", params: { scheduleId, fireAt, hour: sch.hour, minute: sch.minute } }] });
  }

  const label = tab === "duration" ? `${minutes}분 후에 다시 알림` : `${spokenTime(exH, exM)}에 다시 알림`;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="잠시 미루기" />
      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === "duration" && styles.tabOn]} onPress={() => setTab("duration")}>
          <Text style={[styles.tabTxt, tab === "duration" && styles.tabTxtOn]}>기간</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === "exact" && styles.tabOn]} onPress={() => setTab("exact")}>
          <Text style={[styles.tabTxt, tab === "exact" && styles.tabTxtOn]}>정확한 시간</Text>
        </Pressable>
      </View>

      <View style={styles.wheels}>
        {tab === "duration" ? (
          <WheelPicker values={MIN_VALUES} value={minutes} onChange={setMinutes} suffix="분" />
        ) : (
          <>
            <WheelPicker values={HOUR_VALUES} value={exH} onChange={setExH} suffix="시" />
            <WheelPicker values={Array.from({ length: 60 }, (_, i) => i)} value={exM} onChange={setExM} suffix="분" />
          </>
        )}
      </View>

      <View style={styles.footer}>
        <BigButton label={label} onPress={() => apply(tab === "duration" ? { mode: "duration", minutes } : { mode: "exact", hour: exH, minute: exM })} />
        <View style={styles.presets}>
          {[10, 30, 60].map((m) => (
            <Pressable key={m} style={styles.preset} onPress={() => apply({ mode: "duration", minutes: m })}>
              <Text style={styles.presetTxt}>{m === 60 ? "1시간" : `${m}분`}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cardBg },
  tabs: { flexDirection: "row", margin: spacing.lg, backgroundColor: colors.lightBlueBg, borderRadius: radii.button, padding: 4 },
  tab: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.button },
  tabOn: { backgroundColor: colors.cardBg },
  tabTxt: { fontSize: fontSizes.body, fontWeight: "700", color: colors.textSecondary },
  tabTxtOn: { color: colors.primaryNavy },
  wheels: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.md },
  footer: { padding: spacing.lg },
  presets: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  preset: { flex: 1, minHeight: 56, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.lightBlueBg, borderRadius: radii.button },
  presetTxt: { fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.primaryBlue },
});
```

- [ ] **Step 2: 타입체크**

Run: `cd care-app && npx tsc --noEmit`
Expected: 에러 0(라우트 타입은 Task 13 후 최종 통과 — 먼저 Task 13을 끝내면 깔끔).

- [ ] **Step 3: Commit**

```bash
git add care-app/src/screens/SnoozePickerScreen.tsx
git commit -m "feat: 잠시 미루기 피커(기간/정확시각/프리셋)"
```

---

## Task 12: 카운트다운 화면 `SnoozeCountdownScreen`

**Files:**
- Create: `care-app/src/screens/SnoozeCountdownScreen.tsx`

**Interfaces:**
- Consumes: `dueAtSlot`(Task 5), `recordIntake`, `stopAlarm`(Task 7), `getPatientId`, `doseSlot`.
- Produces: 라우트 `SnoozeCountdown: { scheduleId: string; fireAt: string; hour: number; minute: number }`.

- [ ] **Step 1: 구현 (실시간 카운트 + 일정 화면으로(자동) + 지금 모두 먹기)**

```tsx
// care-app/src/screens/SnoozeCountdownScreen.tsx
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { BigButton } from "../components/BigButton";
import { supabase } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { recordIntake } from "../lib/records";
import { stopAlarm } from "../lib/notifications";
import { dueAtSlot } from "../lib/doseSlotSelect";
import { doseSlot } from "../lib/schedule";
import { colors, fontSizes, spacing } from "../theme/tokens";

function mmss(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function SnoozeCountdownScreen() {
  const nav = useNavigation<any>();
  const p = useRoute<any>().params as { scheduleId: string; fireAt: string; hour: number; minute: number };
  const target = new Date(p.fireAt).getTime();
  const [remain, setRemain] = useState(target - Date.now());
  const [autoLeft, setAutoLeft] = useState(8); // 8초 후 자동으로 홈

  useEffect(() => {
    const t = setInterval(() => {
      setRemain(target - Date.now());
      setAutoLeft((x) => x - 1);
    }, 1000);
    return () => clearInterval(t);
  }, [target]);

  useEffect(() => { if (autoLeft <= 0) nav.reset({ index: 0, routes: [{ name: "Tabs" }] }); }, [autoLeft, nav]);

  async function takeAll() {
    const pid = await getPatientId();
    if (pid) {
      const { data } = await supabase.from("schedules").select("*").eq("patient_id", pid).eq("active", true);
      const ids = dueAtSlot(data ?? [], p.hour, p.minute);
      const slot = doseSlot(p.hour, p.minute, new Date());
      for (const id of ids) {
        try { await recordIntake({ patientId: pid, scheduleId: id, scheduledFor: slot, status: "completed", method: "버튼" }); await stopAlarm(id); } catch {}
      }
    }
    nav.reset({ index: 0, routes: [{ name: "Tabs" }] });
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>일정 변경됨</Text>
      <Text style={styles.sub}>다음 알림까지 남은 시간</Text>
      <Text style={styles.count}>{mmss(remain)}</Text>
      <View style={{ flex: 1 }} />
      <BigButton label={`일정 화면으로 돌아가기 (${autoLeft})`} onPress={() => nav.reset({ index: 0, routes: [{ name: "Tabs" }] })} />
      <BigButton label="지금 모두 먹기" variant="secondary" onPress={takeAll} />
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cardBg, padding: spacing.lg, paddingTop: spacing.xl * 2, alignItems: "center" },
  title: { fontSize: fontSizes.title, fontWeight: "800", color: colors.primaryNavy, marginTop: spacing.xl },
  sub: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: spacing.sm },
  count: { fontSize: 64, fontWeight: "800", color: colors.text, marginTop: spacing.lg },
});
```

- [ ] **Step 2: 타입체크 + 수동 검증**

Run: `cd care-app && npx tsc --noEmit` → 에러 0.
미루기 5분 설정 → "04:5x" 카운트 감소, 8초 후 자동 홈, "지금 모두 먹기" 누르면 같은 시각 약들 완료 처리.

- [ ] **Step 3: Commit**

```bash
git add care-app/src/screens/SnoozeCountdownScreen.tsx
git commit -m "feat: 미루기 카운트다운 화면(+지금 모두 먹기)"
```

---

## Task 13: 네비게이션 라우트 등록

**Files:**
- Modify: `care-app/src/navigation/types.ts`
- Modify: `care-app/src/navigation/RootNavigator.tsx`

- [ ] **Step 1: 라우트 타입 추가**

`types.ts` `RootStackParamList`에:
```ts
  SnoozePicker: { scheduleId: string };
  SnoozeCountdown: { scheduleId: string; fireAt: string; hour: number; minute: number };
```

- [ ] **Step 2: 스크린 등록**

`RootNavigator.tsx` import + `<Stack.Screen>` 추가:
```tsx
import { SnoozePickerScreen } from "../screens/SnoozePickerScreen";
import { SnoozeCountdownScreen } from "../screens/SnoozeCountdownScreen";
// ...
<Stack.Screen name="SnoozePicker" component={SnoozePickerScreen} options={{ headerShown: false }} />
<Stack.Screen name="SnoozeCountdown" component={SnoozeCountdownScreen} options={{ headerShown: false }} />
```

- [ ] **Step 3: 전체 타입체크 + 테스트**

Run: `cd care-app && npx tsc --noEmit && npx jest`
Expected: tsc 에러 0, 기존+신규 테스트 전부 통과.

- [ ] **Step 4: Commit**

```bash
git add care-app/src/navigation/types.ts care-app/src/navigation/RootNavigator.tsx
git commit -m "feat: 미루기 피커/카운트다운 라우트 등록"
```

---

## Task 14: 네이티브 설정(app.json) + 권한 유도

**Files:**
- Modify: `care-app/app.json`
- Create: `care-app/src/lib/alarmPermissions.ts`
- Modify: `care-app/src/screens/ButtonRegisterScreen.tsx` (첫 등록 시 권한 유도 호출)

- [ ] **Step 1: app.json — 포그라운드 서비스 권한 + iOS 엔타이틀먼트**

`android.permissions`에 추가:
```json
"android.permission.FOREGROUND_SERVICE",
"android.permission.FOREGROUND_SERVICE_SPECIAL_USE"
```
`ios.infoPlist`는 그대로 두고, EAS가 Time-Sensitive를 쓰도록 `ios.entitlements`에:
```json
"com.apple.developer.usernotifications.time-sensitive": true
```
(Notifee 플러그인이 이미 설치돼 있으면 포그라운드 서비스는 동작. 없으면 `plugins`에 `"@notifee/react-native"` 추가.)

- [ ] **Step 2: 권한 유도 헬퍼**

```ts
// care-app/src/lib/alarmPermissions.ts
import notifee, { AndroidNotificationSetting } from "@notifee/react-native";
import { Platform, Alert, Linking } from "react-native";

// 첫 알람 등록 시 1회: 정확 알람/배터리 최적화/풀스크린 권한을 점검·안내한다.
export async function ensureStrongAlarmReady(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    const s = await notifee.getNotificationSettings();
    if (s.android?.alarm === AndroidNotificationSetting.DISABLED) {
      await new Promise<void>((res) => Alert.alert(
        "정확한 알람 허용 필요",
        "정시에 울리려면 '알람 및 리마인더'를 허용해 주세요.",
        [{ text: "나중에", onPress: () => res() }, { text: "설정 열기", onPress: async () => { await notifee.openAlarmPermissionSettings(); res(); } }],
      ));
    }
    await notifee.openBatteryOptimizationSettings?.().catch(() => {});
  } catch {}
  void Linking;
}
```

- [ ] **Step 3: 첫 등록 시 호출**

`ButtonRegisterScreen.tsx`의 `save()`에서 `scheduleReminders` 직전 1회:
```ts
import { ensureStrongAlarmReady } from "../lib/alarmPermissions";
// ... 알림 예약 전:
await ensureStrongAlarmReady();
```
(이미 `ensurePermission()` 호출 위치 옆.)

- [ ] **Step 4: 타입체크**

Run: `cd care-app && npx tsc --noEmit` → 에러 0.

- [ ] **Step 5: Commit**

```bash
git add care-app/app.json care-app/src/lib/alarmPermissions.ts care-app/src/screens/ButtonRegisterScreen.tsx
git commit -m "feat: 포그라운드서비스/Time-Sensitive 설정 + 강한 알람 권한 유도"
```

---

## Task 15: 통합 검증 + 새 빌드

- [ ] **Step 1: 전체 타입체크 + 테스트**

Run: `cd care-app && npx tsc --noEmit && npx jest`
Expected: tsc 에러 0, 테스트 전부 통과(기존 51 + spokenTime/snooze/doseSlotSelect 신규).

- [ ] **Step 2: Codex 교차리뷰**

Run: `cd /Users/cruel/Desktop/AI-bokkyak && codex review --uncommitted`
지적(P0~P2) 수정 후 재검토 → 승인까지 반복.

- [ ] **Step 3: 실기기 시나리오 검증(갤럭시 우선)**

잠금상태 자동 풀스크린 / 진동모드 소리 / 연속 진동·소리 루프 / 2.5분 자동정지 후 재발사 / 잠시 미루기→카운트다운→재발사 / 응답 즉시 정지 / 음성등록 "오후 10시 30분" / 온보딩 로고 없음 / 가입 플레이스홀더 가시성.

- [ ] **Step 4: 새 EAS 빌드**

```bash
cd care-app && eas build -p android --profile preview   # APK
# (iOS는) eas build -p ios --profile production && eas submit -p ios --profile production --latest
```

---

## Self-Review (작성자 체크)

- **스펙 커버리지:** 강한 알람(Task 6~9·14), iOS 버스트(7·8), 미루기 피커+카운트다운(10~13), "지금 모두 먹기"(5·12), 음성 자연발화+분+이름수정(1·2), 온보딩 로고/플레이스홀더(3), 권한 유도(14) — 스펙 §1~6 모두 매핑됨. iOS Critical Alerts/STREAM_ALARM/LiveSpeech는 스펙 §8 범위 밖으로 제외(일치).
- **플레이스홀더:** 각 코드 단계에 실제 코드 포함. "적절한 처리" 류 없음.
- **타입 일관성:** `scheduleSnooze`는 Task 7에서 `SnoozeSpec` 시그니처로 변경, 호출부(AlarmScreen Task 9는 미루기를 화면 이동으로 대체, SnoozePicker Task 11이 새 시그니처로 호출, App/index Task 8은 snooze 직접예약 제거)로 일관. `stopAlarm`/`startRinging`/`stopRinging`/`dueAtSlot`/`nextSnoozeFire`/`spokenTime` 명칭 전 구간 동일.
- **주의(실행자):** 포그라운드 서비스·loopSound·interruptionLevel·full-screen은 **Notifee 버전별 옵션명 차이**가 있을 수 있으니 타입 에러 시 설치된 `@notifee/react-native` 타입 정의를 확인할 것. iOS 버스트의 64개 제한을 넘지 않도록 활성 일정 수가 많아지면 버스트 개수를 줄인다.

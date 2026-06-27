# 알람 신뢰성 v2 + 앱 아이콘 수정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 복약 알람을 "예약했으면 재부팅·시간변경·다회차에도 정시에 울린다" 수준으로 끌어올리고(반복 트리거→1회 재예약, iOS 윈도우, 부팅/시간 재예약, 권한 경고), 잘려 보이는 앱 아이콘을 엠블럼 중심으로 고친다.

**Architecture:** 매일/주간 반복 트리거를 폐기하고 "다음 1회 정확 알람"을 예약한다. Android는 알람 발사(DELIVERED 백그라운드 이벤트)·응답 시 다음 발생분을 재계산해 다시 1회 예약(체이닝). iOS는 백그라운드 체이닝이 불가하므로 가까운 48시간치를 윈도우로 예약하고 앱 실행/응답 시 재무장한다. 재부팅·시간변경은 네이티브 BroadcastReceiver→HeadlessJsTask→전체 재동기화로 복구한다.

**Tech Stack:** React Native + Expo (EAS, config-plugin), TypeScript, `@notifee/react-native`, RN HeadlessJsTask + 커스텀 Android BroadcastReceiver(Kotlin, config-plugin 주입), jest, sips(아이콘).

## Global Constraints

- 모든 사용자 문구 한국어. 본문 ≥18px, 주요 버튼 ≥56px. 디자인 토큰은 `src/theme/tokens.ts`에서만.
- 순수 로직(`schedule.ts`, 새 헬퍼)은 RN/네트워크 의존 없이 jest 테스트. 화면·알림·네이티브는 실기기 수동 검증.
- 설계 결정 유지: `repeat_days` 빈 배열=매일 / `intake_records` upsert `onConflict:"schedule_id,scheduled_for"` / 의도 우선순위 재알림>미복용>복용완료.
- 작업 디렉토리 `/Users/cruel/Desktop/AI-bokkyak/care-app`. 검증: `npx tsc --noEmit`, `npx jest`, Codex 교차리뷰.
- 알람음 mp3는 시간대별 번들 유지. 정확 알람은 `alarmManager:{ allowWhileIdle:true }`(권한 시), 미허용 시 일반 트리거 폴백.
- iOS 대기 알림 64개 한도를 넘기지 않는다.
- 브랜치 `feat/care-mvp`. `app.json`은 skip-worktree라 커밋에 포함되지 않음(디스크 수정만).

---

## File Structure

- **Create** `care-app/src/lib/doseTimes.ts` — 다음 발사 시각 + N시간 내 도즈 목록(순수).
- **Create** `care-app/src/lib/alarmSync.ts` — `resyncAllAlarms()`(전체 재동기화), `rescheduleAfterFire()`.
- **Create** `care-app/src/__tests__/doseTimes.test.ts`.
- **Create** `care-app/plugins/withAlarmReceiver.js` — Android 부팅/시간 리시버 + 헤드리스 서비스 주입 config-plugin.
- **Modify** `care-app/src/lib/notifications.ts` — 1회 예약화, iOS 48h 윈도우, stopAlarm 재무장.
- **Modify** `care-app/index.ts` — DELIVERED→다음 재예약, HeadlessJsTask 등록.
- **Modify** `care-app/App.tsx` — 콜드스타트/AppState active 재동기화.
- **Modify** `care-app/src/screens/HomeScreen.tsx` — 정확알람 꺼짐 경고 배너.
- **Modify** `care-app/src/lib/alarmPermissions.ts` — `hasExactAlarm()`.
- **Modify** `care-app/app.json` — config-plugin 등록.
- **Modify** `care-app/assets/icon.png`, `assets/android-icon-foreground.png` — 엠블럼 중심 재생성.

---

## Task 1: 순수 헬퍼 `doseTimes` (다음 발사 + 윈도우 목록)

**Files:**
- Create: `care-app/src/lib/doseTimes.ts`
- Test: `care-app/src/__tests__/doseTimes.test.ts`

**Interfaces:**
- Produces:
  - `type DoseSpec = { hour: number; minute: number; repeat_days: number[] }`
  - `nextDoseAt(spec: DoseSpec, now: Date): Date` — 다음(>= now) 발사 시각.
  - `dosesWithin(spec: DoseSpec, now: Date, hours: number): Date[]` — now부터 hours시간 내 모든 발사 시각(오름차순).

- [ ] **Step 1: Write the failing test**

```ts
// care-app/src/__tests__/doseTimes.test.ts
import { nextDoseAt, dosesWithin } from "../lib/doseTimes";

const now = new Date("2026-06-27T11:00:00"); // 토요일

describe("nextDoseAt", () => {
  it("매일(빈 배열): 오늘 미래 시각", () => {
    expect(nextDoseAt({ hour: 13, minute: 0, repeat_days: [] }, now).getTime())
      .toBe(new Date("2026-06-27T13:00:00").getTime());
  });
  it("매일: 이미 지난 시각이면 내일", () => {
    expect(nextDoseAt({ hour: 9, minute: 0, repeat_days: [] }, now).getTime())
      .toBe(new Date("2026-06-28T09:00:00").getTime());
  });
  it("요일(월,수,금=1,3,5): 다음 해당 요일", () => {
    // 토(6) 기준 다음은 월요일 6/29
    expect(nextDoseAt({ hour: 8, minute: 0, repeat_days: [1, 3, 5] }, now).getTime())
      .toBe(new Date("2026-06-29T08:00:00").getTime());
  });
});

describe("dosesWithin", () => {
  it("매일 08:00 — 48시간 내 2~3회", () => {
    const list = dosesWithin({ hour: 8, minute: 0, repeat_days: [] }, now, 48);
    // 6/28 08:00, 6/29 08:00 (6/27 08:00은 과거)
    expect(list.map((d) => d.toISOString())).toEqual([
      new Date("2026-06-28T08:00:00").toISOString(),
      new Date("2026-06-29T08:00:00").toISOString(),
    ]);
  });
  it("요일(토=6) 13:00 — 48시간 내 오늘 1회만", () => {
    const list = dosesWithin({ hour: 13, minute: 0, repeat_days: [6] }, now, 48);
    expect(list.map((d) => d.toISOString())).toEqual([new Date("2026-06-27T13:00:00").toISOString()]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd care-app && npx jest doseTimes`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// care-app/src/lib/doseTimes.ts
// 복약 발사 시각 계산(순수). repeat_days 빈 배열=매일, 아니면 0=일…6=토 요일 일치.
export type DoseSpec = { hour: number; minute: number; repeat_days: number[] };

function dueOnDay(spec: DoseSpec, day: Date): boolean {
  return spec.repeat_days.length === 0 || spec.repeat_days.includes(day.getDay());
}

export function nextDoseAt(spec: DoseSpec, now: Date): Date {
  const c = new Date(now);
  c.setSeconds(0, 0);
  c.setHours(spec.hour, spec.minute, 0, 0);
  for (let i = 0; i < 8; i++) {
    if (c.getTime() >= now.getTime() && dueOnDay(spec, c)) return c;
    c.setDate(c.getDate() + 1);
    c.setHours(spec.hour, spec.minute, 0, 0);
  }
  return c;
}

export function dosesWithin(spec: DoseSpec, now: Date, hours: number): Date[] {
  const end = now.getTime() + hours * 3_600_000;
  const out: Date[] = [];
  const c = new Date(now);
  c.setSeconds(0, 0);
  c.setHours(spec.hour, spec.minute, 0, 0);
  for (let i = 0; i < hours / 24 + 2; i++) {
    if (c.getTime() >= now.getTime() && c.getTime() <= end && dueOnDay(spec, c)) out.push(new Date(c));
    c.setDate(c.getDate() + 1);
    c.setHours(spec.hour, spec.minute, 0, 0);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd care-app && npx jest doseTimes`
Expected: PASS (5 assertions).

- [ ] **Step 5: Commit**

```bash
git add care-app/src/lib/doseTimes.ts care-app/src/__tests__/doseTimes.test.ts
git commit -m "feat: doseTimes 순수 헬퍼(다음 발사+윈도우 목록)"
```

---

## Task 2: 알림 코어 A — 반복 트리거 폐기, "다음 1회" 예약 + 재예약 함수

**Files:**
- Modify: `care-app/src/lib/notifications.ts`

**Interfaces:**
- Consumes: `nextDoseAt`(Task 1), 기존 `alarmNotification`, `exactAlarmOption`, `ensureChannel`, `todOf`.
- Produces:
  - `scheduleReminders(scheduleId, medicineName, hour, minute, repeatDays, timeOfDay)` — 기존 시그니처 유지, 내부는 **다음 1회만** 예약(+iOS 윈도우는 Task 3).
  - `rescheduleNext(scheduleId, hour, minute, repeatDays, timeOfDay)` — 다음 1회 재예약(체이닝/재동기화 공용).

- [ ] **Step 1: `scheduleReminders` 1회 예약화 + `rescheduleNext` 추가**

`scheduleReminders` 내부에서 `RepeatFrequency` 사용 부분을 제거하고 아래로 교체. 기존 매일/요일 분기를 없애고 **단일 id `alarm-${scheduleId}`** 에 다음 발사 1회만 예약:
```ts
import { nextDoseAt } from "./doseTimes";

// 다음 1회 정확 알람을 예약(반복 트리거 대신 — 매 회차 setExactAndAllowWhileIdle 유지).
export async function rescheduleNext(
  scheduleId: string, hour: number, minute: number, repeatDays: number[], timeOfDay: string
): Promise<void> {
  const tod = todOf(timeOfDay);
  const ch = await ensureChannel(tod);
  const fireAt = nextDoseAt({ hour, minute, repeat_days: repeatDays }, new Date()).getTime();
  await notifee.createTriggerNotification(
    { id: `alarm-${scheduleId}`, ...alarmNotification(scheduleId, tod, ch, hour, minute, 0) },
    { type: TriggerType.TIMESTAMP, timestamp: fireAt, ...(await exactAlarmOption()) }); // repeatFrequency 없음
}
```
`scheduleReminders`는 `rescheduleNext`를 부르고 iOS 윈도우(Task 3)도 부르도록:
```ts
export async function scheduleReminders(
  scheduleId: string, medicineName: string, hour: number, minute: number,
  repeatDays: number[], timeOfDay: string
): Promise<string[]> {
  await rescheduleNext(scheduleId, hour, minute, repeatDays, timeOfDay);
  await scheduleIosWindow(scheduleId, timeOfDay, hour, minute, repeatDays); // Task 3
  return [`alarm-${scheduleId}`];
}
```
`RepeatFrequency` import가 다른 곳에서 안 쓰이면 제거. `nextNotificationTime` import도 미사용이면 제거(단 `scheduleIosWindow`/`scheduleSnooze`에서 쓰면 유지).

- [ ] **Step 2: 타입체크 + 기존 테스트**

Run: `cd care-app && npx tsc --noEmit && npx jest`
Expected: tsc 에러 0(미사용 import 정리), 기존 테스트 통과. (`scheduleIosWindow`는 Task 3에서 추가 — 먼저 stub로 `export async function scheduleIosWindow(){}` 두고 Task 3에서 구현, 또는 Task 3을 먼저 머지.)

- [ ] **Step 3: Commit**

```bash
git add care-app/src/lib/notifications.ts
git commit -m "feat: 알람을 반복 트리거→다음 1회 정확 예약(rescheduleNext)"
```

---

## Task 3: 알림 코어 B — iOS 48시간 윈도우 예약(개수 캡) + 오래된 것 취소

**Files:**
- Modify: `care-app/src/lib/notifications.ts`

**Interfaces:**
- Consumes: `dosesWithin`(Task 1), `Platform`, `todOf`, `SOUND`, `getTriggerNotificationIds`.
- Produces: `scheduleIosWindow(scheduleId, timeOfDay, hour, minute, repeatDays)`, `cancelIosWindow(scheduleId)`.

- [ ] **Step 1: 구현 (윈도우 + 버스트 캡)**

```ts
import { dosesWithin } from "./doseTimes";

const WINDOW_HOURS = 48;
const BURST_GAP_MS = 30_000;

// iOS: 앞으로 48시간 내 도즈마다 (기본 1 + 버스트) 예약. 64개 한도를 넘지 않게 버스트 수를 동적 캡.
export async function scheduleIosWindow(
  scheduleId: string, timeOfDay: string, hour: number, minute: number, repeatDays: number[]
): Promise<void> {
  if (Platform.OS !== "ios") return;
  await cancelIosWindow(scheduleId);
  const tod = todOf(timeOfDay);
  const doses = dosesWithin({ hour, minute, repeat_days: repeatDays }, new Date(), WINDOW_HOURS);
  // 현재 예약 개수 기준 남은 여유로 버스트 수 결정(도즈당 최소 1, 여유 있으면 최대 5 버스트).
  let pending = 0;
  try { pending = (await notifee.getTriggerNotificationIds()).length; } catch {}
  const room = Math.max(0, 60 - pending);            // 64 한도에서 약간 여유
  const perDose = doses.length > 0 ? Math.max(1, Math.min(6, Math.floor(room / doses.length))) : 0;
  for (let di = 0; di < doses.length; di++) {
    const base = doses[di].getTime();
    for (let b = 0; b < perDose; b++) {
      await notifee.createTriggerNotification(
        { id: `alarm-${scheduleId}-win-${di}-${b}`, title: `${tod} 약 복용 시간입니다`,
          body: "약을 드신 후 '지금 약 먹기'를 눌러주세요.",
          data: { scheduleId, hour: String(hour), minute: String(minute), tod, seq: String(b) },
          ios: { categoryId: "care-alarm", sound: `${SOUND[tod]}.mp3` } },
        { type: TriggerType.TIMESTAMP, timestamp: base + b * BURST_GAP_MS });
    }
  }
}

// 이 일정의 윈도우 알림(-win-*) 전부 취소.
export async function cancelIosWindow(scheduleId: string): Promise<void> {
  try {
    const ids = await notifee.getTriggerNotificationIds();
    for (const id of ids) {
      if (id.startsWith(`alarm-${scheduleId}-win-`)) { try { await notifee.cancelTriggerNotification(id); } catch {} }
    }
  } catch {}
}
```
기존 `scheduleIosBurst`/`-burst-` 관련 코드는 제거하고, `stopAlarm`·`cancelSchedule`의 `-burst-` 취소를 `cancelIosWindow(scheduleId)` 호출로 교체. `stopAlarm`의 iOS 재무장도 `scheduleIosWindow`로 교체(다음 윈도우 재예약).

- [ ] **Step 2: 타입체크 + 테스트**

Run: `cd care-app && npx tsc --noEmit && npx jest`
Expected: 에러 0, 통과.

- [ ] **Step 3: Commit**

```bash
git add care-app/src/lib/notifications.ts
git commit -m "feat: iOS 48h 윈도우 예약(64한도 캡)+오래된 것 취소, 버스트 폐기"
```

---

## Task 4: 이벤트 체이닝 — 발사/응답 시 다음 1회 재예약 (index.ts / App.tsx)

**Files:**
- Modify: `care-app/index.ts`
- Modify: `care-app/App.tsx`

**Interfaces:**
- Consumes: `rescheduleNext`(Task 2), `scheduleIosWindow`(Task 3), `stopAlarm`, `supabase`.
- 알림 `data`에는 hour/minute/tod만 있고 **repeat_days가 없으므로**, 재예약 시 schedules에서 조회해 repeat_days를 얻는다.

- [ ] **Step 1: index.ts — DELIVERED에서 다음 회차 재예약(Android 체이닝)**

기존 30초 반복 체인(`scheduleRepeatFollowup`)은 유지하되, **DELIVERED 시 다음 정시 회차도 재예약**한다(반복 트리거가 없어졌으므로 필수). `onBackgroundEvent`의 DELIVERED 분기:
```ts
if (type === EventType.DELIVERED && scheduleId) {
  const seq = Number(data?.seq ?? 0);
  // 같은 회차의 30초 반복(미응답 시 끈질기게)
  await scheduleRepeatFollowup(scheduleId, String(data?.tod ?? "아침"), hour, minute, seq + 1);
  // 다음 정시 회차 재예약(반복 트리거 대체) — 일정의 repeat_days를 조회해서
  try {
    const { data: s } = await supabase.from("schedules").select("*").eq("id", scheduleId).eq("active", true).maybeSingle();
    if (s) await rescheduleNext(scheduleId, s.hour, s.minute, s.repeat_days ?? [], s.time_of_day);
  } catch {}
  return;
}
```
import에 `rescheduleNext`, `supabase` 추가.

- [ ] **Step 2: 응답 시에도 다음 회차 보장**

`stopAlarm`이 현재 회차 알림을 지우므로, 응답(complete/skip/snooze) 처리 후 `rescheduleNext`를 한 번 더 호출(멱등). index.ts와 App.tsx의 ACTION_PRESS complete/snooze 처리 끝에:
```ts
try {
  const { data: s } = await supabase.from("schedules").select("*").eq("id", scheduleId).eq("active", true).maybeSingle();
  if (s) await rescheduleNext(scheduleId, s.hour, s.minute, s.repeat_days ?? [], s.time_of_day);
} catch {}
```

- [ ] **Step 3: 타입체크 + 테스트**

Run: `cd care-app && npx tsc --noEmit && npx jest`
Expected: 에러 0, 통과.

- [ ] **Step 4: Commit**

```bash
git add care-app/index.ts care-app/App.tsx
git commit -m "feat: 발사/응답 시 다음 1회 재예약(반복 트리거 대체 체이닝)"
```

---

## Task 5: 전체 재동기화 `alarmSync` + 앱 실행/활성화 시 호출 (C)

**Files:**
- Create: `care-app/src/lib/alarmSync.ts`
- Modify: `care-app/App.tsx`

**Interfaces:**
- Consumes: `rescheduleNext`, `scheduleIosWindow`, `cancelSchedule`, `getPatientId`, `supabase`.
- Produces: `resyncAllAlarms(): Promise<void>`.

- [ ] **Step 1: 구현**

```ts
// care-app/src/lib/alarmSync.ts
import { supabase } from "./supabase";
import { getPatientId } from "./storage";
import { rescheduleNext, scheduleIosWindow } from "./notifications";

// 활성 일정 전체의 "다음 1회(+iOS 윈도우)"를 재예약. 부팅/시간변경/앱 실행 시 호출(멱등).
export async function resyncAllAlarms(): Promise<void> {
  const pid = await getPatientId();
  if (!pid) return;
  const { data } = await supabase.from("schedules").select("*").eq("patient_id", pid).eq("active", true);
  for (const s of data ?? []) {
    try {
      await rescheduleNext(s.id, s.hour, s.minute, s.repeat_days ?? [], s.time_of_day);
      await scheduleIosWindow(s.id, s.time_of_day, s.hour, s.minute, s.repeat_days ?? []);
    } catch {}
  }
}
```

- [ ] **Step 2: App.tsx — 콜드스타트 + AppState active에서 호출**

`App.tsx`의 `useEffect`에서 마운트 시 `resyncAllAlarms()` 1회, AppState `active` 핸들러에도 추가(기존 `consumePending`/`rearmIosBursts` 옆). `rearmIosBursts`는 `resyncAllAlarms`로 대체. import 추가.

- [ ] **Step 3: 타입체크 + 테스트**

Run: `cd care-app && npx tsc --noEmit && npx jest`
Expected: 에러 0, 통과.

- [ ] **Step 4: Commit**

```bash
git add care-app/src/lib/alarmSync.ts care-app/App.tsx
git commit -m "feat: 앱 실행/활성화 시 전체 알람 재동기화(resyncAllAlarms)"
```

---

## Task 6: 권한 꺼짐 강한 경고 — 홈 배너 + 설정 버튼 (D)

**Files:**
- Modify: `care-app/src/lib/alarmPermissions.ts`
- Modify: `care-app/src/screens/HomeScreen.tsx`

**Interfaces:**
- Produces: `hasExactAlarm(): Promise<boolean>`.

- [ ] **Step 1: `hasExactAlarm` 추가**

```ts
// alarmPermissions.ts 에 추가
import notifee, { AndroidNotificationSetting } from "@notifee/react-native";
export async function hasExactAlarm(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  try {
    const s = await notifee.getNotificationSettings();
    return s.android?.alarm !== AndroidNotificationSetting.DISABLED;
  } catch { return true; }
}
```

- [ ] **Step 2: HomeScreen 경고 배너**

`HomeScreen`에서 포커스 시 `hasExactAlarm()` 확인해 false면 헤더 아래 빨간 배너 표시:
```tsx
import { Pressable } from "react-native";
import notifee from "@notifee/react-native";
import { hasExactAlarm } from "../lib/alarmPermissions";
import { AlertTriangle } from "lucide-react-native";
// 상태:
const [alarmOk, setAlarmOk] = useState(true);
useFocusEffect(useCallback(() => { hasExactAlarm().then(setAlarmOk); }, []));
// JSX(헤더 아래):
{!alarmOk ? (
  <Pressable style={styles.warn} onPress={() => notifee.openAlarmPermissionSettings()}>
    <AlertTriangle size={20} color={colors.dangerRed} />
    <Text style={styles.warnText}>정확한 복약 알람을 위해 '알람 및 리마인더' 권한이 필요해요. 이 권한이 꺼져 있으면 알람이 늦게 울릴 수 있습니다. 눌러서 설정 열기</Text>
  </Pressable>
) : null}
```
스타일:
```ts
warn: { flexDirection: "row", gap: spacing.sm, alignItems: "center", backgroundColor: "#FFF0F0",
  borderColor: colors.dangerRed, borderWidth: 1, borderRadius: radii.card, padding: spacing.md, marginBottom: spacing.md },
warnText: { flex: 1, fontSize: fontSizes.body, color: colors.dangerRed, fontWeight: "700" },
```

- [ ] **Step 3: 타입체크 + 수동 확인**

Run: `cd care-app && npx tsc --noEmit` → 에러 0. 정확알람 권한 끄면 홈에 배너, 탭하면 설정 열림.

- [ ] **Step 4: Commit**

```bash
git add care-app/src/lib/alarmPermissions.ts care-app/src/screens/HomeScreen.tsx
git commit -m "feat: 정확알람 꺼짐 홈 경고 배너 + 설정 이동"
```

---

## Task 7: 네이티브 리시버 (E) — 부팅/시간변경 → HeadlessJS 재동기화

**Files:**
- Create: `care-app/plugins/withAlarmReceiver.js`
- Modify: `care-app/index.ts`
- Modify: `care-app/app.json`

**Interfaces:**
- Consumes: `resyncAllAlarms`(Task 5).

- [ ] **Step 1: HeadlessJsTask 등록 (index.ts)**

`registerRootComponent(App)` 앞에:
```ts
import { AppRegistry } from "react-native";
import { resyncAllAlarms } from "./src/lib/alarmSync";
// 네이티브 리시버(BOOT/TIME 변경)가 이 태스크를 호출 → 활성 알람 전체 재예약.
AppRegistry.registerHeadlessTask("AlarmResync", () => async () => { await resyncAllAlarms(); });
```

- [ ] **Step 2: config-plugin 작성 (Kotlin 리시버 + 서비스 주입)**

```js
// care-app/plugins/withAlarmReceiver.js
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const RECEIVER_KT = `package com.shawn777.careapp
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.facebook.react.HeadlessJsTaskService

class AlarmBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val service = Intent(context, AlarmResyncService::class.java)
    context.startService(service)
    HeadlessJsTaskService.acquireWakeLockNow(context)
  }
}
`;

const SERVICE_KT = `package com.shawn777.careapp
import android.content.Intent
import android.os.Bundle
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.jstasks.HeadlessJsTaskConfig

class AlarmResyncService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent): HeadlessJsTaskConfig {
    return HeadlessJsTaskConfig("AlarmResync", Bundle(), 30000, true)
  }
}
`;

module.exports = function withAlarmReceiver(config) {
  // 1) 네이티브 소스 파일 작성
  config = withDangerousMod(config, ["android", async (cfg) => {
    const pkgDir = path.join(cfg.modRequest.platformProjectRoot, "app/src/main/java/com/shawn777/careapp");
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, "AlarmBootReceiver.kt"), RECEIVER_KT);
    fs.writeFileSync(path.join(pkgDir, "AlarmResyncService.kt"), SERVICE_KT);
    return cfg;
  }]);
  // 2) 매니페스트에 권한 + 리시버 + 서비스
  config = withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    const manifest = cfg.modResults.manifest;
    manifest["uses-permission"] = manifest["uses-permission"] || [];
    if (!manifest["uses-permission"].some((p) => p.$["android:name"] === "android.permission.RECEIVE_BOOT_COMPLETED")) {
      manifest["uses-permission"].push({ $: { "android:name": "android.permission.RECEIVE_BOOT_COMPLETED" } });
    }
    app.service = app.service || [];
    app.service.push({ $: { "android:name": ".AlarmResyncService", "android:exported": "false" } });
    app.receiver = app.receiver || [];
    app.receiver.push({
      $: { "android:name": ".AlarmBootReceiver", "android:exported": "true" },
      "intent-filter": [{
        action: [
          { $: { "android:name": "android.intent.action.BOOT_COMPLETED" } },
          { $: { "android:name": "android.intent.action.QUICKBOOT_POWERON" } },
          { $: { "android:name": "android.intent.action.TIME_SET" } },
          { $: { "android:name": "android.intent.action.TIMEZONE_CHANGED" } },
          { $: { "android:name": "android.intent.action.DATE_CHANGED" } },
        ],
      }],
    });
    return cfg;
  });
  return config;
};
```
(패키지명 `com.shawn777.careapp` — app.json android.package와 일치 확인.)

- [ ] **Step 3: app.json plugins에 등록**

`app.json`의 `plugins` 배열에 `"./plugins/withAlarmReceiver"` 추가.

- [ ] **Step 4: 타입체크 + prebuild 검증**

Run: `cd care-app && npx tsc --noEmit` → 에러 0.
Run: `npx expo prebuild -p android --no-install` → 성공, `android/app/src/main/AndroidManifest.xml`에 RECEIVE_BOOT_COMPLETED·AlarmBootReceiver·AlarmResyncService 존재 확인. 확인 후 `rm -rf android`.

- [ ] **Step 5: Commit**

```bash
git add care-app/plugins/withAlarmReceiver.js care-app/index.ts
git commit -m "feat: 부팅/시간변경 BroadcastReceiver→HeadlessJS 재동기화(config-plugin)"
```
(app.json은 skip-worktree라 커밋 제외 — 디스크 수정만.)

---

## Task 8: 앱 아이콘 잘림 수정 — 엠블럼 중심 재생성

**Files:**
- Modify: `care-app/assets/icon.png`, `care-app/assets/android-icon-foreground.png`

**문제:** `assets/logo.png`(엠블럼+"모두의 복약" 워드마크)를 그대로 아이콘에 써서, 안드로이드 어댑티브 마스크가 워드마크까지 잘라내 **로고가 크고 잘려** 보인다. → 어댑티브 **foreground는 엠블럼만, 가운데 안전영역(약 66%)에 들어가게 여백**을 둬야 한다.

- [ ] **Step 1: 엠블럼만 잘라 여백 둔 아이콘 생성 (sips)**

`assets/logo.png`는 1254×1254. 엠블럼(원형 마크)은 상단 중앙 ~y:40~800. 아래 명령으로 엠블럼을 잘라 1024 캔버스 가운데에 **약 70% 크기로** 배치(여백 확보):
```bash
cd care-app/assets
# 1) 엠블럼 영역 크롭(워드마크 제외): 가로 전체, 세로 0~840 → 정사각 1024로
sips -c 840 1024 logo.png --out emblem-crop.png         # 중앙 크롭(상단 워드마크 위쪽 엠블럼)
# 위 중앙크롭이 엠블럼을 못 맞추면 오프셋 크롭 사용(예시):
#   sips 자체는 오프셋 크롭이 약하므로, 안 맞으면 아래 Python(Quartz 미사용) 대신 수동 비율 조정.
# 2) 어댑티브 foreground: 흰 1024 캔버스 가운데 엠블럼을 ~72%로
sips -z 740 740 emblem-crop.png --out emblem-740.png
# 흰 배경 1024 캔버스에 합성(ImageMagick 없으면 sips padToHeightWidth + 배경 흰색):
sips -p 1024 1024 --padColor FFFFFF emblem-740.png --out android-icon-foreground.png
# 3) iOS/일반 아이콘도 동일(흰 배경 + 엠블럼 + 약간 여백)
cp android-icon-foreground.png icon.png
rm -f emblem-crop.png emblem-740.png
```
> 구현자 주의: sips 중앙 크롭이 엠블럼을 정확히 못 잡으면, 비율을 눈으로 맞춰 `-c <h> <w>` 값을 조정한다(목표: 결과 미리보기에서 원형 마크가 가운데, 워드마크 없음, 사방 여백). 최종 `android-icon-foreground.png`/`icon.png`는 1024×1024 흰 배경 + 가운데 엠블럼.

- [ ] **Step 2: app.json 어댑티브 배경 흰색 확인**

`app.json` `android.adaptiveIcon.backgroundColor`가 `"#FFFFFF"`인지 확인(이미 그러함). foregroundImage가 `./assets/android-icon-foreground.png`인지 확인.

- [ ] **Step 3: 수동 확인**

`assets/android-icon-foreground.png`를 미리보기로 열어 **원형 엠블럼이 가운데, 워드마크 없음, 사방 여백**인지 확인(빌드 후 런처에서 안 잘림).

- [ ] **Step 4: Commit**

```bash
git add care-app/assets/icon.png care-app/assets/android-icon-foreground.png
git commit -m "fix: 앱 아이콘을 엠블럼 중심+여백으로(어댑티브 잘림 해결)"
```

---

## Task 9: 통합 검증 + 새 빌드

- [ ] **Step 1: 전체 tsc + jest**

Run: `cd care-app && npx tsc --noEmit && npx jest`
Expected: tsc 0, 기존+신규(doseTimes) 테스트 통과.

- [ ] **Step 2: Codex 교차리뷰**

Run: `cd /Users/cruel/Desktop/AI-bokkyak && codex review --base <feature-base>` → P0~P2 수정 후 클린까지 반복.

- [ ] **Step 3: 실기기 시나리오(안드로이드 필수)**

발사→다음 회차 자동 재예약(다음날 울림), **재부팅 후 알람 유지**, **시간/타임존 변경 후 앱 열면 정정**, 정확알람 끄면 홈 배너+설정 이동, iOS 윈도우 예약 64한도 내, 앱 아이콘 안 잘림.

- [ ] **Step 4: 새 빌드**

```bash
# Android(로컬, 클라우드 할당량 소진 시): JAVA_HOME/ANDROID_HOME export 후
cd care-app && eas build -p android --profile preview --local --non-interactive
# iOS(클라우드): eas build -p ios --profile production && (대화형) eas submit -p ios --profile production --latest
```

---

## Self-Review (작성자 체크)

- **스펙 커버리지:** A(Task2·4) / B(Task3) / C(Task5) / D(Task6) / E(Task7) / 아이콘(Task8) — 스펙 A~E + 아이콘 모두 매핑. iOS Critical Alerts·STREAM_ALARM은 범위 밖(일치).
- **플레이스홀더:** 각 단계 실제 코드 포함. Task8 sips는 "엠블럼 못 잡으면 비율 조정"이라는 수동 판단이 남아 있음 — 자산 작업 특성상 미리보기 확인으로 보완(구현자 주의 명시).
- **타입 일관성:** `rescheduleNext`(Task2)·`scheduleIosWindow`/`cancelIosWindow`(Task3)·`resyncAllAlarms`(Task5)·`hasExactAlarm`(Task6)·`nextDoseAt`/`dosesWithin`(Task1) 명칭 전 구간 동일. Task2가 `scheduleIosWindow`를 호출하므로 Task3과 함께(또는 stub 먼저) 머지해야 tsc 통과 — Task2 Step2에 명시.
- **주의(실행자):** Task7 네이티브(config-plugin+Kotlin+HeadlessJS)는 prebuild 검증 + 실기기 재부팅/시간변경으로만 확인 가능. 패키지명·HeadlessJsTaskService import 경로(`com.facebook.react`)가 설치된 RN 버전과 맞는지 확인. iOS 64한도는 활성 일정이 많을수록 perDose가 1로 수렴.

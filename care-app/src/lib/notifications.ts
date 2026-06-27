import { Platform } from "react-native";
import notifee, {
  AndroidImportance, AndroidVisibility, AndroidCategory, TriggerType,
  AndroidNotificationSetting,
} from "@notifee/react-native";
import { nextDoseAt, dosesWithin } from "./doseTimes";
import { SnoozeSpec, nextSnoozeFire } from "./snooze";
import { supabase } from "./supabase";

// 정확 알람(SCHEDULE_EXACT_ALARM)이 허용된 경우에만 alarmManager 옵션을 켠다.
// 권한이 없는 Android(14+ 등)에서 alarmManager를 주면 Notifee가 트리거를 거부해
// 등록 흐름이 깨질 수 있으므로, 불가하면 일반(부정확) 트리거로 폴백한다.
async function exactAlarmOption(): Promise<{ alarmManager: { allowWhileIdle: true } } | {}> {
  try {
    const settings = await notifee.getNotificationSettings();
    if (settings.android?.alarm === AndroidNotificationSetting.DISABLED) return {};
  } catch {}
  return { alarmManager: { allowWhileIdle: true } };
}

type TOD = "아침" | "점심" | "저녁" | "취침";
const SOUND: Record<TOD, string> = { 아침: "morning", 점심: "noon", 저녁: "evening", 취침: "night" };
const CH: Record<TOD, string> = { 아침: "care-morning", 점심: "care-noon", 저녁: "care-evening", 취침: "care-night" };

// notifee는 vibrationPattern의 모든 값이 양수여야 한다(0 포함 시 createTriggerNotification이
// JS 검증에서 throw → 알람이 아예 예약 안 됨). RN Vibration의 [지연,진동,...]과 달리
// notifee는 [진동,멈춤,진동,멈춤...] 형식이라 선행 0이 불필요하다.
const STRONG_VIBRATION = [800, 400, 800, 400, 800, 400];

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

export async function ensureIOSCategory(): Promise<void> {
  await notifee.setNotificationCategories([
    {
      id: "care-alarm",
      actions: [
        { id: "complete", title: "지금 약 먹기" },
        { id: "snooze", title: "잠시 미루기" },
      ],
    },
  ]);
}

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

function todOf(tod: string): TOD {
  return (["아침", "점심", "저녁", "취침"].includes(tod) ? tod : "아침") as TOD;
}

// 반복 알람: 30초 간격, 최대 6회(primary seq0 + 후속 seq1~5). 응답하면 후속을 취소한다.
const REPEAT_INTERVAL_MS = 30_000;
const MAX_SEQ = 5;

// 알람 알림 본문(primary/후속 공용). data.seq로 반복 단계를 추적한다.
function alarmNotification(scheduleId: string, tod: TOD, ch: string, hour: number, minute: number, seq: number) {
  return {
    title: `${tod} 약 복용 시간입니다`,
    body: "약을 드신 후 복용 완료를 눌러주세요.",
    data: { scheduleId, hour: String(hour), minute: String(minute), tod, seq: String(seq) },
    android: androidAlarm(scheduleId, ch, SOUND[tod]),
    ios: { categoryId: "care-alarm", sound: `${SOUND[tod]}.mp3`, interruptionLevel: "timeSensitive" as const },
  };
}

// 알람이 전달됐는데 아직 응답이 없을 때, 다음 반복 알림을 30초 뒤로 예약한다(이벤트 핸들러에서 호출).
// seq는 "다음" 단계 번호. MAX_SEQ를 넘으면 더 울리지 않는다.
export async function scheduleRepeatFollowup(
  scheduleId: string, timeOfDay: string, hour: number, minute: number, seq: number
): Promise<void> {
  if (seq > MAX_SEQ) return;
  const tod = todOf(timeOfDay);
  const ch = await ensureChannel(tod);
  await notifee.createTriggerNotification(
    { id: `alarm-${scheduleId}-rep`, ...alarmNotification(scheduleId, tod, ch, hour, minute, seq) },
    { type: TriggerType.TIMESTAMP, timestamp: Date.now() + REPEAT_INTERVAL_MS, ...(await exactAlarmOption()) });
}

// 응답(복용완료/건너뛰기/스누즈/알람화면 진입) 시 대기 중인 반복 알림을 중단한다.
export async function cancelRepeat(scheduleId: string): Promise<void> {
  try { await notifee.cancelTriggerNotification(`alarm-${scheduleId}-rep`); } catch {}
  try { await notifee.cancelDisplayedNotification(`alarm-${scheduleId}-rep`); } catch {}
}

// iOS: 앞으로 48시간 내 도즈마다 (기본 1 + 버스트) 예약. 64개 한도를 넘지 않게 버스트 수를 동적 캡.
const WINDOW_HOURS = 48;
const BURST_GAP_MS = 30_000;

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
      // 64한도 초과 시 createTriggerNotification이 throw할 수 있으므로 graceful — 크래시 방지.
      // (도즈별 b=0부터 예약하므로 한도에 닿아도 기본 알람이 우선 등록된다.)
      try {
        await notifee.createTriggerNotification(
          { id: `alarm-${scheduleId}-win-${di}-${b}`, title: `${tod} 약 복용 시간입니다`,
            body: "약을 드신 후 '지금 약 먹기'를 눌러주세요.",
            data: { scheduleId, hour: String(hour), minute: String(minute), tod, seq: String(b) },
            ios: { categoryId: "care-alarm", sound: `${SOUND[tod]}.mp3`, interruptionLevel: "timeSensitive" as const } },
          { type: TriggerType.TIMESTAMP, timestamp: base + b * BURST_GAP_MS });
      } catch {}
    }
  }
}

// 이 일정의 윈도우 알림(-win-*)을 예약분 + 표시 중인 것까지 전부 취소.
export async function cancelIosWindow(scheduleId: string): Promise<void> {
  try {
    const ids = await notifee.getTriggerNotificationIds();
    for (const id of ids) {
      if (id.startsWith(`alarm-${scheduleId}-win-`)) { try { await notifee.cancelTriggerNotification(id); } catch {} }
    }
  } catch {}
  try {
    const disp = await notifee.getDisplayedNotifications();
    for (const n of disp) {
      if (n.id && n.id.startsWith(`alarm-${scheduleId}-win-`)) { try { await notifee.cancelDisplayedNotification(n.id); } catch {} }
    }
  } catch {}
}

// 일정 삭제/수정 시 해당 일정의 모든 예약 알림(정확 1회/스누즈/반복/iOS 윈도우)을 제거한다.
export async function cancelSchedule(scheduleId: string): Promise<void> {
  const ids = [`alarm-${scheduleId}`, `alarm-${scheduleId}-snooze`, `alarm-${scheduleId}-rep`];
  for (const id of ids) { try { await notifee.cancelNotification(id); } catch {} }
  await cancelIosWindow(scheduleId);
}

// 포그라운드 서비스 중지 + 반복/윈도우/표시 알림 제거.
// 복용완료·건너뛰기·스누즈 등 응답 시 공통 호출.
export async function stopAlarm(scheduleId: string): Promise<void> {
  try { await notifee.stopForegroundService(); } catch {}
  await cancelRepeat(scheduleId);
  // 예약된 스누즈 트리거 제거 (스누즈 후 복용완료 시 울리지 않도록)
  try { await notifee.cancelNotification(`alarm-${scheduleId}-snooze`); } catch {}
  // iOS 윈도우(-win-*) 알림 제거
  await cancelIosWindow(scheduleId);
  try {
    const displayed = await notifee.getDisplayedNotifications();
    for (const n of displayed) {
      if (n.notification?.data?.scheduleId === scheduleId && n.id) await notifee.cancelDisplayedNotification(n.id);
    }
  } catch {}
  // iOS: 방금 취소한 윈도우를 "다음 발생분"으로 다시 무장 — 응답 후에도 미래 반복 핑 유지.
  // (Android는 scheduleIosWindow가 즉시 return하므로 영향 없음.)
  if (Platform.OS === "ios") {
    try {
      const { data } = await supabase
        .from("schedules")
        .select("*")
        .eq("id", scheduleId)
        .eq("active", true)
        .maybeSingle();
      if (data) {
        await scheduleIosWindow(
          scheduleId,
          data.time_of_day,
          data.hour,
          data.minute,
          data.repeat_days ?? []
        );
      }
    } catch {}
  }
}

// 다음 1회 정확 알람을 예약(반복 트리거 대신 — 매 회차 setExactAndAllowWhileIdle 유지).
export async function rescheduleNext(
  scheduleId: string, hour: number, minute: number, repeatDays: number[], timeOfDay: string
): Promise<void> {
  const tod = todOf(timeOfDay);
  const ch = await ensureChannel(tod);
  // 버퍼 없이 "지금" 기준 다음 슬롯. 정시 발사 직후 DELIVERED 재예약 때도
  // "방금 울린 슬롯"은 자연히 제외된다: 알람이 HH:MM:00에 울리고 이 코드는 그보다 수 ms
  // 뒤에 실행되므로 now가 이미 슬롯(초=0)을 지나 다음날로 잡힌다. (예전엔 60초 버퍼를
  // 두는 바람에 "지금부터 2분 내" 등록·재동기화 알람이 내일로 밀리던 버그가 있었다.)
  const fireAt = nextDoseAt({ hour, minute, repeat_days: repeatDays }, new Date()).getTime();
  await notifee.createTriggerNotification(
    { id: `alarm-${scheduleId}`, ...alarmNotification(scheduleId, tod, ch, hour, minute, 0) },
    { type: TriggerType.TIMESTAMP, timestamp: fireAt, ...(await exactAlarmOption()) }); // repeatFrequency 없음
}

export async function scheduleReminders(
  scheduleId: string, medicineName: string, hour: number, minute: number,
  repeatDays: number[], timeOfDay: string
): Promise<string[]> {
  await rescheduleNext(scheduleId, hour, minute, repeatDays, timeOfDay);
  await scheduleIosWindow(scheduleId, timeOfDay, hour, minute, repeatDays);
  return [`alarm-${scheduleId}`];
}

export async function scheduleSnooze(
  scheduleId: string, medicineName: string, spec: SnoozeSpec,
  hour: number, minute: number, timeOfDay: string = "아침"
): Promise<string[]> {
  const tod = todOf(timeOfDay); // 원래 시간대 사운드/채널/반복 라벨 유지(저녁 약이 아침으로 바뀌지 않게)
  const ch = await ensureChannel(tod);
  const fireAt = nextSnoozeFire(spec, new Date()).getTime();
  const id = await notifee.createTriggerNotification(
    { id: `alarm-${scheduleId}-snooze`, ...alarmNotification(scheduleId, tod, ch, hour, minute, 0), title: "다시 알림" },
    { type: TriggerType.TIMESTAMP, timestamp: fireAt, ...(await exactAlarmOption()) });
  return [id];
}

export async function cancel(notificationId: string): Promise<void> {
  await notifee.cancelNotification(notificationId);
}

import { Platform } from "react-native";
import notifee, {
  AndroidImportance, AndroidVisibility, AndroidCategory, TriggerType, RepeatFrequency,
  AndroidNotificationSetting,
} from "@notifee/react-native";
import { nextNotificationTime } from "./schedule";
import { SnoozeSpec, nextSnoozeFire } from "./snooze";

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

const STRONG_VIBRATION = [0, 800, 400, 800, 400, 800];

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
        { id: "complete", title: "복용 완료" },
        { id: "snooze", title: "30분 후 다시 알림" },
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

// 일정 삭제/수정 시 해당 일정의 모든 예약 알림(매일/요일/스누즈/반복)을 제거한다.
export async function cancelSchedule(scheduleId: string): Promise<void> {
  const ids = [`alarm-${scheduleId}`, `alarm-${scheduleId}-snooze`, `alarm-${scheduleId}-rep`];
  for (let d = 0; d <= 6; d++) ids.push(`alarm-${scheduleId}-${d}`);
  for (let i = 1; i <= 6; i++) ids.push(`alarm-${scheduleId}-burst-${i}`);
  for (const id of ids) { try { await notifee.cancelNotification(id); } catch {} }
}

// 포그라운드 서비스 중지 + 반복/버스트/표시 알림 제거.
// 복용완료·건너뛰기·스누즈 등 응답 시 공통 호출.
export async function stopAlarm(scheduleId: string): Promise<void> {
  try { await notifee.stopForegroundService(); } catch {}
  await cancelRepeat(scheduleId);
  // iOS 버스트(-burstN) 알림 제거
  for (let i = 1; i <= 6; i++) { try { await notifee.cancelNotification(`alarm-${scheduleId}-burst-${i}`); } catch {} }
  try {
    const displayed = await notifee.getDisplayedNotifications();
    for (const n of displayed) {
      if (n.notification?.data?.scheduleId === scheduleId && n.id) await notifee.cancelDisplayedNotification(n.id);
    }
  } catch {}
}

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
        ios: { categoryId: "care-alarm", sound: `${SOUND[tod]}.mp3`, interruptionLevel: "timeSensitive" as const } },
      { type: TriggerType.TIMESTAMP, timestamp: base + i * 30_000 });
  }
}

export async function scheduleReminders(
  scheduleId: string, medicineName: string, hour: number, minute: number,
  repeatDays: number[], timeOfDay: string
): Promise<string[]> {
  const tod = todOf(timeOfDay);
  const ch = await ensureChannel(tod);
  const now = new Date();
  const base = { id: "", ...alarmNotification(scheduleId, tod, ch, hour, minute, 0) }; // primary = seq 0
  const exact = await exactAlarmOption(); // 권한 있을 때만 정확 알람
  const ids: string[] = [];
  if (repeatDays.length === 0) {
    const t = nextNotificationTime({ hour, minute, repeat_days: [] }, now);
    ids.push(await notifee.createTriggerNotification(
      { ...base, id: `alarm-${scheduleId}` },
      { type: TriggerType.TIMESTAMP, timestamp: t.getTime(), repeatFrequency: RepeatFrequency.DAILY, ...exact }));
  } else {
    for (const d of repeatDays) {
      const t = nextNotificationTime({ hour, minute, repeat_days: [d] }, now);
      ids.push(await notifee.createTriggerNotification(
        { ...base, id: `alarm-${scheduleId}-${d}` },
        { type: TriggerType.TIMESTAMP, timestamp: t.getTime(), repeatFrequency: RepeatFrequency.WEEKLY, ...exact }));
    }
  }
  await scheduleIosBurst(scheduleId, timeOfDay, hour, minute);
  return ids;
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

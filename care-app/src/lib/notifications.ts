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
  return (["아침", "점심", "저녁", "취침"].includes(tod) ? tod : "아침") as TOD;
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

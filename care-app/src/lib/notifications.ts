import notifee, {
  AndroidImportance, AndroidVisibility, AndroidCategory, TriggerType, RepeatFrequency,
} from "@notifee/react-native";
import { nextNotificationTime } from "./schedule";

let channelId: string | null = null;
async function ensureChannel(): Promise<string> {
  if (channelId) return channelId;
  channelId = await notifee.createChannel({
    id: "care-alarm", name: "복약 알람",
    importance: AndroidImportance.HIGH, sound: "default", vibration: true,
    visibility: AndroidVisibility.PUBLIC,
  });
  return channelId;
}

export async function ensurePermission(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= 1;
}

function androidAlarm(scheduleId: string, ch: string) {
  return {
    channelId: ch,
    category: AndroidCategory.ALARM,
    importance: AndroidImportance.HIGH,
    fullScreenAction: { id: "alarm", launchActivity: "default" },
    pressAction: { id: "alarm", launchActivity: "default" },
    loopSound: true,
    ongoing: true,
    autoCancel: false,
  };
}

export async function scheduleReminders(
  scheduleId: string, medicineName: string, hour: number, minute: number, repeatDays: number[]
): Promise<string[]> {
  const ch = await ensureChannel();
  const now = new Date();
  const base = {
    title: "복약 시간이에요",
    body: `${medicineName} 드실 시간입니다.`,
    data: { scheduleId },
    android: androidAlarm(scheduleId, ch),
  };
  const ids: string[] = [];
  if (repeatDays.length === 0) {
    const t = nextNotificationTime({ hour, minute, repeat_days: [] }, now);
    ids.push(await notifee.createTriggerNotification({ id: `alarm-${scheduleId}`, ...base }, {
      type: TriggerType.TIMESTAMP, timestamp: t.getTime(), repeatFrequency: RepeatFrequency.DAILY,
    }));
  } else {
    for (const d of repeatDays) {
      const t = nextNotificationTime({ hour, minute, repeat_days: [d] }, now);
      ids.push(await notifee.createTriggerNotification({ id: `alarm-${scheduleId}-${d}`, ...base }, {
        type: TriggerType.TIMESTAMP, timestamp: t.getTime(), repeatFrequency: RepeatFrequency.WEEKLY,
      }));
    }
  }
  return ids;
}

export async function scheduleSnooze(
  scheduleId: string, medicineName: string, minutes: number
): Promise<string[]> {
  const ch = await ensureChannel();
  const id = await notifee.createTriggerNotification(
    {
      id: `alarm-${scheduleId}-snooze`,
      title: "다시 알림",
      body: `${medicineName} 드실 시간입니다.`,
      data: { scheduleId },
      android: androidAlarm(scheduleId, ch),
    },
    { type: TriggerType.TIMESTAMP, timestamp: new Date().getTime() + minutes * 60 * 1000 }
  );
  return [id];
}

export async function cancel(notificationId: string): Promise<void> {
  await notifee.cancelNotification(notificationId);
}

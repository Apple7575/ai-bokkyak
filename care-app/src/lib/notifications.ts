import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true,
    shouldPlaySound: true, shouldSetBadge: false,
  }),
});

export async function ensurePermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === "granted";
}

export async function scheduleReminders(
  scheduleId: string,
  medicineName: string,
  hour: number,
  minute: number,
  repeatDays: number[]
): Promise<string[]> {
  const content = {
    title: "복약 시간이에요",
    body: `${medicineName} 드실 시간입니다.`,
    data: { scheduleId },
  };
  if (repeatDays.length === 0) {
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
    });
    return [id];
  }
  const ids: string[] = [];
  for (const day of repeatDays) {
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: day + 1, hour, minute },
    });
    ids.push(id);
  }
  return ids;
}

export async function scheduleSnooze(
  scheduleId: string, medicineName: string, minutes: number
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: { title: "다시 알림", body: `${medicineName} 드실 시간입니다.`, data: { scheduleId } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: minutes * 60 },
  });
}

export async function cancel(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

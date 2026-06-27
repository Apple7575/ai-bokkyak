import { registerRootComponent } from 'expo';
import notifee, { EventType } from '@notifee/react-native';

import App from './App';
import { setPendingAlarm, getPatientId } from './src/lib/storage';
import { recordIntake } from './src/lib/records';
import { scheduleSnooze, scheduleRepeatFollowup, cancelRepeat } from './src/lib/notifications';
import { doseSlot } from './src/lib/schedule';

notifee.onBackgroundEvent(async ({ type, detail }) => {
  const data = detail.notification?.data as any;
  const scheduleId = data?.scheduleId as string | undefined;
  const nid = detail.notification?.id;
  const hour = Number(data?.hour ?? 0), minute = Number(data?.minute ?? 0);
  // 알람이 전달됐는데 잠금화면에서 아직 응답이 없으면 30초 뒤 반복 알림을 예약(최대 6회).
  if (type === EventType.DELIVERED && scheduleId) {
    const seq = Number(data?.seq ?? 0);
    await scheduleRepeatFollowup(scheduleId, String(data?.tod ?? "아침"), hour, minute, seq + 1);
    return;
  }
  if (type === EventType.PRESS) {
    if (scheduleId) { await setPendingAlarm(scheduleId); await cancelRepeat(scheduleId); }
    return;
  }
  if (type === EventType.ACTION_PRESS && scheduleId) {
    const pid = await getPatientId();
    if (!pid) { await cancelRepeat(scheduleId); return; }
    const slot = doseSlot(hour, minute, new Date());
    try {
      if (detail.pressAction?.id === "complete") {
        await recordIntake({ patientId: pid, scheduleId, scheduledFor: slot, status: "completed", method: "버튼" });
      } else if (detail.pressAction?.id === "snooze") {
        await recordIntake({ patientId: pid, scheduleId, scheduledFor: slot, status: "snoozed", method: "버튼" });
        await scheduleSnooze(scheduleId, "", { mode: "duration", minutes: 30 }, hour, minute, String(data?.tod ?? "아침"));
      }
      await cancelRepeat(scheduleId); // 반복 중단
      // 이 일정의 표시 중인 알림 전부 제거(primary가 ongoing이라 반복 알림에서 응답해도 남을 수 있음)
      const displayed = await notifee.getDisplayedNotifications();
      for (const n of displayed) {
        if (n.notification?.data?.scheduleId === scheduleId && n.id) await notifee.cancelDisplayedNotification(n.id);
      }
    } catch {}
  }
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

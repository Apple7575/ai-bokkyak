import { registerRootComponent } from 'expo';
import notifee, { EventType } from '@notifee/react-native';

import App from './App';
import { setPendingAlarm, getPatientId } from './src/lib/storage';
import { recordIntake } from './src/lib/records';
import { scheduleSnooze } from './src/lib/notifications';
import { doseSlot } from './src/lib/schedule';

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
    if (!pid) return;
    const hour = Number(data?.hour ?? 0), minute = Number(data?.minute ?? 0);
    const slot = doseSlot(hour, minute, new Date());
    try {
      if (detail.pressAction?.id === "complete") {
        await recordIntake({ patientId: pid, scheduleId, scheduledFor: slot, status: "completed", method: "버튼" });
      } else if (detail.pressAction?.id === "snooze") {
        await recordIntake({ patientId: pid, scheduleId, scheduledFor: slot, status: "snoozed", method: "버튼" });
        await scheduleSnooze(scheduleId, "", 30, hour, minute);
      }
      if (nid) await notifee.cancelDisplayedNotification(nid);
    } catch {}
  }
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

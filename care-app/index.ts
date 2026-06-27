import { registerRootComponent } from 'expo';
import notifee, { EventType } from '@notifee/react-native';

import App from './App';
import { setPendingAlarm, getPatientId } from './src/lib/storage';
import { recordIntake } from './src/lib/records';
import { scheduleRepeatFollowup, stopAlarm } from './src/lib/notifications';
import { doseSlot } from './src/lib/schedule';

notifee.onBackgroundEvent(async ({ type, detail }) => {
  const data = detail.notification?.data as any;
  const scheduleId = data?.scheduleId as string | undefined;
  const hour = Number(data?.hour ?? 0), minute = Number(data?.minute ?? 0);
  // 알람이 전달됐는데 잠금화면에서 아직 응답이 없으면 30초 뒤 반복 알림을 예약(최대 6회, Android 전용).
  if (type === EventType.DELIVERED && scheduleId) {
    const seq = Number(data?.seq ?? 0);
    await scheduleRepeatFollowup(scheduleId, String(data?.tod ?? "아침"), hour, minute, seq + 1);
    return;
  }
  if (type === EventType.PRESS) {
    if (scheduleId) { await setPendingAlarm(scheduleId); await stopAlarm(scheduleId); }
    return;
  }
  if (type === EventType.ACTION_PRESS && scheduleId) {
    const pid = await getPatientId();
    if (!pid) { await stopAlarm(scheduleId); return; }
    const slot = doseSlot(hour, minute, new Date());
    try {
      if (detail.pressAction?.id === "complete") {
        await recordIntake({ patientId: pid, scheduleId, scheduledFor: slot, status: "completed", method: "버튼" });
        await stopAlarm(scheduleId);
      } else if (detail.pressAction?.id === "snooze") {
        // 미루기 화면에서 시각 선택하도록 앱 진입 예약
        await setPendingAlarm(scheduleId);
        await stopAlarm(scheduleId);
      }
    } catch {}
  }
});

// 포그라운드 서비스: 알림이 asForegroundService로 표시되는 동안 서비스를 살려둠.
// 소리는 loopSound가, 표시 알림 정지는 stopAlarm이 담당. 러너는 외부 정지까지 대기.
notifee.registerForegroundService(() => new Promise(() => {}));

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

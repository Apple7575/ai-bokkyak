import { AppRegistry } from "react-native";
import { registerRootComponent } from 'expo';
import notifee, { EventType } from '@notifee/react-native';

import App from './App';
import { setPendingAlarm, getPatientId } from './src/lib/storage';
import { recordIntake } from './src/lib/records';
import { scheduleRepeatFollowup, stopAlarm, scheduleSnooze, rescheduleNext } from './src/lib/notifications';
import { supabase } from './src/lib/supabase';
import { doseSlot } from './src/lib/schedule';
import { resyncAllAlarms } from "./src/lib/alarmSync";

// 네이티브 리시버(BOOT/TIME 변경)가 이 태스크를 호출 → 활성 알람 전체 재예약.
AppRegistry.registerHeadlessTask("AlarmResync", () => async () => { await resyncAllAlarms(); });

notifee.onBackgroundEvent(async ({ type, detail }) => {
  const data = detail.notification?.data as any;
  const scheduleId = data?.scheduleId as string | undefined;
  const hour = Number(data?.hour ?? 0), minute = Number(data?.minute ?? 0);
  // 알람이 전달됐는데 잠금화면에서 아직 응답이 없으면 30초 뒤 반복 알림을 예약(최대 6회, Android 전용).
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
        // 다음 정시 회차 재예약(멱등 — 이미 예약돼 있으면 덮어씀)
        try {
          const { data: s } = await supabase.from("schedules").select("*").eq("id", scheduleId).eq("active", true).maybeSingle();
          if (s) await rescheduleNext(scheduleId, s.hour, s.minute, s.repeat_days ?? [], s.time_of_day);
        } catch {}
      } else if (detail.pressAction?.id === "snooze") {
        // 알림 액션 스누즈 = 앱 안 열고 기본 10분 빠른 스누즈
        await recordIntake({ patientId: pid, scheduleId, scheduledFor: slot, status: "snoozed", method: "버튼" });
        await stopAlarm(scheduleId); // 현재 울림/기존 스누즈 트리거 정리 (반드시 scheduleSnooze 전에)
        await scheduleSnooze(scheduleId, "", { mode: "duration", minutes: 10 }, hour, minute, String(data?.tod ?? "아침"));
        // 다음 정시 회차 재예약(멱등)
        try {
          const { data: s } = await supabase.from("schedules").select("*").eq("id", scheduleId).eq("active", true).maybeSingle();
          if (s) await rescheduleNext(scheduleId, s.hour, s.minute, s.repeat_days ?? [], s.time_of_day);
        } catch {}
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

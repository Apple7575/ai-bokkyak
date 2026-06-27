import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import notifee, { EventType } from "@notifee/react-native";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { RootStackParamList } from "./src/navigation/types";
import { takePendingAlarm, getPatientId } from "./src/lib/storage";
import { recordIntake } from "./src/lib/records";
import { ensureIOSCategory, stopAlarm, scheduleIosBurst, scheduleSnooze } from "./src/lib/notifications";
import { doseSlot } from "./src/lib/schedule";
import { supabase } from "./src/lib/supabase";

export const navRef = createNavigationContainerRef<RootStackParamList>();

function navigateToAlarm(scheduleId: string | undefined, attempt = 0) {
  if (navRef.isReady()) {
    navRef.navigate("Alarm", { scheduleId });
  } else if (attempt < 50) {
    setTimeout(() => navigateToAlarm(scheduleId, attempt + 1), 100);
  }
}

export default function App() {
  useEffect(() => {
    ensureIOSCategory().catch(() => {});
    const consumePending = async () => {
      const sid = await takePendingAlarm();
      if (sid) navigateToAlarm(sid);
    };
    const rearmIosBursts = async () => {
      // iOS: 앱이 활성화될 때 활성 일정의 다음 버스트를 재무장(매일 1회분 미리 깔기)
      if (Platform.OS === "ios") {
        const pid = await getPatientId();
        if (pid) {
          const { data } = await supabase.from("schedules").select("*").eq("patient_id", pid).eq("active", true);
          for (const s of data ?? []) await scheduleIosBurst(s.id, s.time_of_day, s.hour, s.minute, s.repeat_days ?? []);
        }
      }
    };
    notifee.getInitialNotification().then((initial) => {
      const sid = initial?.notification?.data?.scheduleId as string | undefined;
      if (sid) navigateToAlarm(sid);
    });
    consumePending();
    rearmIosBursts().catch(() => {});
    const appSub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        consumePending();
        rearmIosBursts().catch(() => {});
      }
    });
    const unsub = notifee.onForegroundEvent(async ({ type, detail }) => {
      const data = detail.notification?.data as any;
      const sid = data?.scheduleId as string | undefined;
      if (type === EventType.PRESS || type === EventType.DELIVERED) {
        if (sid) navigateToAlarm(sid);
        return;
      }
      if (type === EventType.ACTION_PRESS && sid) {
        const pid = await getPatientId();
        await stopAlarm(sid); // 먼저 현재 울림/기존 트리거 정리(pid 유무 무관). scheduleSnooze보다 반드시 앞.
        if (pid) {
          const hour = Number(data?.hour ?? 0), minute = Number(data?.minute ?? 0);
          const slot = doseSlot(hour, minute, new Date());
          try {
            if (detail.pressAction?.id === "complete") {
              await recordIntake({ patientId: pid, scheduleId: sid, scheduledFor: slot, status: "completed", method: "버튼" });
            } else if (detail.pressAction?.id === "snooze") {
              // 알림 액션 스누즈 = 앱 안 열고 기본 10분 빠른 스누즈(stopAlarm 이후 예약해야 살아남음)
              await recordIntake({ patientId: pid, scheduleId: sid, scheduledFor: slot, status: "snoozed", method: "버튼" });
              await scheduleSnooze(sid, "", { mode: "duration", minutes: 10 }, hour, minute, String(data?.tod ?? "아침"));
            }
          } catch {}
        }
        return;
      }
    });
    return () => { appSub.remove(); unsub(); };
  }, []);

  return (
    <SafeAreaProvider>
      {/* 흰 배경에서 시간·배터리 등 상태바 글씨가 보이도록 어두운 색으로 고정 */}
      <StatusBar style="dark" />
      <NavigationContainer ref={navRef}>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

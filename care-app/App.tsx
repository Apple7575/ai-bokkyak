import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { AppState } from "react-native";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import notifee, { EventType } from "@notifee/react-native";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { RootStackParamList } from "./src/navigation/types";
import { takePendingAlarm, getPatientId } from "./src/lib/storage";
import { recordIntake } from "./src/lib/records";
import { scheduleSnooze, ensureIOSCategory, cancelRepeat } from "./src/lib/notifications";
import { doseSlot } from "./src/lib/schedule";

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
    notifee.getInitialNotification().then((initial) => {
      const sid = initial?.notification?.data?.scheduleId as string | undefined;
      if (sid) navigateToAlarm(sid);
    });
    consumePending();
    const appSub = AppState.addEventListener("change", (s) => {
      if (s === "active") consumePending();
    });
    const unsub = notifee.onForegroundEvent(async ({ type, detail }) => {
      const data = detail.notification?.data as any;
      const sid = data?.scheduleId as string | undefined;
      const nid = detail.notification?.id;
      if (type === EventType.PRESS || type === EventType.DELIVERED) {
        if (sid) navigateToAlarm(sid);
        return;
      }
      if (type === EventType.ACTION_PRESS && sid) {
        const pid = await getPatientId();
        if (pid) {
          const hour = Number(data?.hour ?? 0), minute = Number(data?.minute ?? 0);
          const slot = doseSlot(hour, minute, new Date());
          try {
            if (detail.pressAction?.id === "complete") {
              await recordIntake({ patientId: pid, scheduleId: sid, scheduledFor: slot, status: "completed", method: "버튼" });
            } else if (detail.pressAction?.id === "snooze") {
              await recordIntake({ patientId: pid, scheduleId: sid, scheduledFor: slot, status: "snoozed", method: "버튼" });
              await scheduleSnooze(sid, "", { mode: "duration", minutes: 30 }, hour, minute, String(data?.tod ?? "아침"));
            }
            await cancelRepeat(sid); // 반복 알람 중단
            // 이 일정의 표시 중인 알림 전부 제거(primary가 ongoing이라 반복 알림에서 응답해도 남을 수 있음)
            const displayed = await notifee.getDisplayedNotifications();
            for (const n of displayed) {
              if (n.notification?.data?.scheduleId === sid && n.id) await notifee.cancelDisplayedNotification(n.id);
            }
          } catch {}
        }
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

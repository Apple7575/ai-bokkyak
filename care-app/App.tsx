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
import { ensureIOSCategory, stopAlarm, scheduleIosBurst } from "./src/lib/notifications";
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
          for (const s of data ?? []) await scheduleIosBurst(s.id, s.time_of_day, s.hour, s.minute);
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
        if (pid) {
          const hour = Number(data?.hour ?? 0), minute = Number(data?.minute ?? 0);
          const slot = doseSlot(hour, minute, new Date());
          try {
            if (detail.pressAction?.id === "complete") {
              await recordIntake({ patientId: pid, scheduleId: sid, scheduledFor: slot, status: "completed", method: "버튼" });
            } else if (detail.pressAction?.id === "snooze") {
              // 알람 화면으로 진입해 거기서 잠시 미루기 처리
              navigateToAlarm(sid);
            }
          } catch {}
        }
        await stopAlarm(sid); // pid 유무와 무관하게 서비스/표시 알림 정리
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

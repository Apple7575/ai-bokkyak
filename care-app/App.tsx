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
import { ensureIOSCategory, stopAlarm, scheduleSnooze, rescheduleNext } from "./src/lib/notifications";
import { doseSlot } from "./src/lib/schedule";
import { supabase } from "./src/lib/supabase";
import { resyncAllAlarms } from "./src/lib/alarmSync";

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
    // 콜드스타트(알람 풀스크린/탭으로 앱이 켜진 경우)의 알람 라우팅은 RootNavigator가
    // 초기 화면을 Alarm으로 잡아 처리한다(홈 깜빡임 방지). 여기선 중복 호출하지 않는다.
    consumePending();
    resyncAllAlarms().catch(() => {});
    const appSub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        consumePending();
        resyncAllAlarms().catch(() => {});
      }
    });
    const unsub = notifee.onForegroundEvent(async ({ type, detail }) => {
      const data = detail.notification?.data as any;
      const sid = data?.scheduleId as string | undefined;
      if (type === EventType.DELIVERED) {
        // 포그라운드에서 DELIVERED → 화면 이동 + 다음 회차 체이닝(백그라운드 DELIVERED와 동일)
        if (sid) {
          navigateToAlarm(sid);
          try {
            const { data: s } = await supabase.from("schedules").select("*").eq("id", sid).eq("active", true).maybeSingle();
            if (s) await rescheduleNext(sid, s.hour, s.minute, s.repeat_days ?? [], s.time_of_day);
          } catch {}
        }
        return;
      }
      if (type === EventType.PRESS) {
        if (sid) navigateToAlarm(sid);
        return;
      }
      if (type === EventType.ACTION_PRESS && sid) {
        const pid = await getPatientId();
        if (!pid) { await stopAlarm(sid); return; } // 기록 불가 — 정리만
        const hour = Number(data?.hour ?? 0), minute = Number(data?.minute ?? 0);
        const slot = doseSlot(hour, minute, new Date());
        // 기록을 먼저 — 실패하면 catch로 빠져 stopAlarm 전에 멈추므로 알람이 보존된다(index.ts와 동일 순서).
        try {
          if (detail.pressAction?.id === "complete") {
            await recordIntake({ patientId: pid, scheduleId: sid, scheduledFor: slot, status: "completed", method: "버튼" });
            await stopAlarm(sid);
            // 다음 정시 회차 재예약(멱등 — 이미 예약돼 있으면 덮어씀)
            try {
              const { data: s } = await supabase.from("schedules").select("*").eq("id", sid).eq("active", true).maybeSingle();
              if (s) await rescheduleNext(sid, s.hour, s.minute, s.repeat_days ?? [], s.time_of_day);
            } catch {}
          } else if (detail.pressAction?.id === "snooze") {
            // 알림 액션 스누즈 = 앱 안 열고 기본 10분 빠른 스누즈. stopAlarm(기존 스누즈 취소) 후 예약해야 살아남음.
            await recordIntake({ patientId: pid, scheduleId: sid, scheduledFor: slot, status: "snoozed", method: "버튼" });
            await stopAlarm(sid);
            await scheduleSnooze(sid, "", { mode: "duration", minutes: 10 }, hour, minute, String(data?.tod ?? "아침"));
            // 다음 정시 회차 재예약(멱등)
            try {
              const { data: s } = await supabase.from("schedules").select("*").eq("id", sid).eq("active", true).maybeSingle();
              if (s) await rescheduleNext(sid, s.hour, s.minute, s.repeat_days ?? [], s.time_of_day);
            } catch {}
          } else {
            await stopAlarm(sid);
          }
        } catch {}
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

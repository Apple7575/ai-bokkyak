import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Alert, ScrollView } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell } from "lucide-react-native";
import { BigButton } from "../components/BigButton";
import { supabase, Schedule } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { recordIntake } from "../lib/records";
import { scheduleSnooze, cancelRepeat } from "../lib/notifications";
import { speak, playAlarmAnnouncement, stopSpeaking } from "../lib/tts";
import { doseSlot } from "../lib/schedule";
import { colors, fontSizes, spacing } from "../theme/tokens";
import notifee from "@notifee/react-native";

export function AlarmScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const scheduleId: string | undefined = route.params?.scheduleId;
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const ready = !scheduleId || !!schedule;
  const tod = schedule?.time_of_day || "복약";

  // 화면을 떠나면(응답 후 등) 재생 중인 안내 음성을 멈춘다 — 홈에서 계속 말하지 않게.
  useEffect(() => () => { stopSpeaking(); }, []);

  useEffect(() => {
    if (!scheduleId) return;
    // 표시 중인 알림 중 이 약(scheduleId)에 해당하는 것만 해제 — 동시에 울리는 다른 약
    // 알림은 보존. data.scheduleId로 매칭하므로 id 체계(결정적/레거시 랜덤)와 무관하게 동작.
    // (cancelDisplayedNotification은 표시만 제거, 트리거(다음 예약)는 유지.)
    (async () => {
      try {
        await cancelRepeat(scheduleId); // 알람 화면을 열면 사용자가 인지한 것 — 반복 알림 중단
        const displayed = await notifee.getDisplayedNotifications();
        for (const n of displayed) {
          if (n.notification?.data?.scheduleId === scheduleId && n.id) {
            await notifee.cancelDisplayedNotification(n.id);
          }
        }
      } catch {}
    })();
  }, [scheduleId]);

  useEffect(() => {
    // 네트워크 TTS는 시간이 걸려, 사용자가 응답/이탈한 뒤에 재생이 시작될 수 있다.
    // 취소 플래그로 가드 — 이탈 후 시작된 재생은 즉시 멈춰 홈 화면에서 들리지 않게 한다.
    let cancelled = false;
    (async () => {
      if (!scheduleId) return;
      const { data } = await supabase.from("schedules").select("*").eq("id", scheduleId).single();
      if (cancelled) return;
      setSchedule(data);
      // 알람 화면이 열리면 이름을 부르는 개인화 음성으로 안내(OpenAI TTS). 알림 사운드와 별개로
      // 화면에서도 들리게 — iOS 알림음 포맷 제약과 무관하게 동작.
      if (data) {
        const todStr = data.time_of_day || "아침";
        let name = "";
        try {
          const pid = await getPatientId();
          if (pid) {
            const { data: p } = await supabase.from("patients").select("name").eq("id", pid).single();
            name = p?.name ?? "";
          }
        } catch {}
        if (cancelled) return;
        const prefix = name ? `${name} 님, ` : "";
        // 네트워크 개인화 음성 시도 → 실패(오프라인 등) 시 번들 mp3로 폴백.
        const ok = await speak(`${prefix}${todStr} 약 드실 시간이에요. 약을 드신 후 복용 완료를 눌러주세요.`);
        if (cancelled) { stopSpeaking(); return; } // 이탈 후 시작된 재생 즉시 중단
        if (!ok) {
          await playAlarmAnnouncement(todStr);
          if (cancelled) stopSpeaking();
        }
      }
    })();
    return () => { cancelled = true; stopSpeaking(); };
  }, [scheduleId]);

  async function respond(status: "completed" | "snoozed" | "skipped") {
    const pid = await getPatientId();
    if (!pid || !scheduleId || !schedule) { nav.navigate("Tabs"); return; }
    const slot = doseSlot(schedule.hour, schedule.minute, new Date());
    try {
      await recordIntake({ patientId: pid, scheduleId, scheduledFor: slot, status, method: "버튼" });
      if (status === "snoozed") await scheduleSnooze(scheduleId, schedule.medicine_name, 30, schedule.hour, schedule.minute, schedule.time_of_day);
    } catch {
      Alert.alert("저장에 실패했어요", "인터넷 연결을 확인하고 다시 눌러 주세요.");
      return;
    }
    nav.navigate("Tabs");
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        {/* Bell emphasis */}
        <View style={styles.bellWrap}>
          <View style={styles.bellHalo}>
            <View style={styles.bellCircle}>
              <Bell size={48} color={colors.primaryBlue} strokeWidth={1.8} />
            </View>
          </View>
        </View>

        {/* Title — 약 이름을 크게 보여줘 같은 시간대 여러 약도 구분 */}
        <Text style={styles.title}>
          {schedule ? `${schedule.medicine_name} 드실 시간이에요` : `${tod} 약 복용 시간입니다`}
        </Text>
        <Text style={styles.subtitle}>{`${tod} 약 · 드신 후 복용 완료를 눌러주세요.`}</Text>

        {ready ? (
          <>
            <View style={{ height: spacing.xl }} />
            <BigButton label="복용 완료" onPress={() => respond("completed")} />
            <BigButton label="30분 후 다시 알림" variant="secondary" onPress={() => respond("snoozed")} />
            <BigButton label="건너뛰기" variant="secondary" onPress={() => respond("skipped")} />
          </>
        ) : (
          <Text style={styles.loading}>불러오는 중...</Text>
        )}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.lightBlueBg },
  scroll: { flexGrow: 1, padding: spacing.lg, justifyContent: "center" },
  bellWrap: { alignItems: "center", marginBottom: spacing.md },
  bellHalo: {
    width: 132, height: 132, borderRadius: 66,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(37,99,235,0.12)",
  },
  bellCircle: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.cardBg,
    shadowColor: colors.primaryBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 16, elevation: 4,
  },
  title: {
    fontSize: fontSizes.title, fontWeight: "800", color: colors.primaryNavy,
    textAlign: "center", marginTop: spacing.md,
  },
  subtitle: {
    fontSize: fontSizes.body, color: colors.textSecondary,
    textAlign: "center", marginTop: spacing.sm,
  },
  loading: { textAlign: "center", fontSize: fontSizes.body, color: colors.textSecondary, marginTop: spacing.lg },
});

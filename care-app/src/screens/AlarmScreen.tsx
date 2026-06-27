import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Alert, ScrollView } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell } from "lucide-react-native";
import { BigButton } from "../components/BigButton";
import { supabase, Schedule } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { recordIntake } from "../lib/records";
import { stopAlarm } from "../lib/notifications";
import { startRinging, stopRinging } from "../lib/alarmRinger";
import { doseSlot } from "../lib/schedule";
import { colors, fontSizes, spacing } from "../theme/tokens";

export function AlarmScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const scheduleId: string | undefined = route.params?.scheduleId;
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const ready = !scheduleId || !!schedule;
  const tod = schedule?.time_of_day || "복약";

  // 진입 시: 알림측 정지 → 스케줄 조회 → 인앱 연속 울림(소리 루프+진동) 시작.
  // 취소 플래그로 가드 — 이탈 후 시작된 재생은 즉시 stopRinging.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!scheduleId) return;
      await stopAlarm(scheduleId); // 화면 진입=인지 → 알림측 소리/반복 정지
      const { data } = await supabase.from("schedules").select("*").eq("id", scheduleId).single();
      if (cancelled) return;
      setSchedule(data);
      if (data) {
        const todStr = data.time_of_day || "아침";
        // 인앱 연속 울림(소리 루프+진동). ~2.5분 자동정지.
        await startRinging(todStr, () => {});
        if (cancelled) stopRinging();
      }
    })();
    return () => {
      cancelled = true;
      stopRinging();
    };
  }, [scheduleId]);

  async function respond(status: "completed" | "skipped") {
    await stopRinging();
    const pid = await getPatientId();
    if (!pid || !scheduleId || !schedule) { nav.navigate("Tabs"); return; }
    const slot = doseSlot(schedule.hour, schedule.minute, new Date());
    try {
      await recordIntake({ patientId: pid, scheduleId, scheduledFor: slot, status, method: "버튼" });
      await stopAlarm(scheduleId);
    } catch {
      Alert.alert("저장에 실패했어요", "인터넷 연결을 확인하고 다시 눌러 주세요.");
      return;
    }
    nav.navigate("Tabs");
  }

  function goSnooze() {
    stopRinging();
    nav.navigate("SnoozePicker", { scheduleId });
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
            <BigButton label="지금 약 먹기" onPress={() => respond("completed")} />
            <BigButton label="안 먹고 건너뛰기" variant="secondary" onPress={() => respond("skipped")} />
            <BigButton label="잠시 미루기" variant="secondary" onPress={goSnooze} />
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

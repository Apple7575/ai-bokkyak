import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Alert, ScrollView } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell } from "lucide-react-native";
import { BigButton } from "../components/BigButton";
import { MicButton } from "../components/MicButton";
import { speak } from "../lib/tts";
import { supabase, Schedule } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { recordIntake } from "../lib/records";
import { scheduleSnooze } from "../lib/notifications";
import { doseSlot } from "../lib/schedule";
import { useSpeechToText } from "../hooks/useSpeechToText";
import { classifyIntent } from "../lib/intent";
import { colors, fontSizes, spacing } from "../theme/tokens";
import notifee from "@notifee/react-native";

export function AlarmScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const scheduleId: string | undefined = route.params?.scheduleId;
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const ready = !scheduleId || !!schedule;

  useEffect(() => {
    if (!scheduleId) return;
    // 이 약(scheduleId)의 울리는 알림만 해제 — 동시에 울리는 다른 약 알림은 보존.
    // (트리거(다음 예약)는 cancelDisplayedNotification이 건드리지 않음.)
    const ids = [
      `alarm-${scheduleId}`,
      `alarm-${scheduleId}-snooze`,
      ...Array.from({ length: 7 }, (_, d) => `alarm-${scheduleId}-${d}`),
    ];
    ids.forEach((id) => { notifee.cancelDisplayedNotification(id).catch(() => {}); });
  }, [scheduleId]);

  useEffect(() => {
    (async () => {
      if (!scheduleId) return;
      const { data } = await supabase.from("schedules").select("*").eq("id", scheduleId).single();
      setSchedule(data);
      if (data) await speak(`${data.medicine_name} 드실 시간입니다. 복용하신 뒤 말씀해 주세요.`);
    })();
  }, [scheduleId]);

  async function write(status: "복용완료" | "미복용", method: "음성" | "버튼") {
    const pid = await getPatientId();
    if (!pid || !scheduleId || !schedule) { nav.navigate("Tabs"); return; }
    const slot = doseSlot(schedule.hour, schedule.minute, new Date());
    try {
      await recordIntake({ patientId: pid, scheduleId, scheduledFor: slot, status, method });
    } catch {
      Alert.alert("저장에 실패했어요", "인터넷 연결을 확인하고 다시 눌러 주세요.");
      return;
    }
    await speak(status === "복용완료" ? "복약 완료로 기록했습니다." : "미복용으로 기록했습니다.");
    nav.reset({ index: 1, routes: [{ name: "Tabs" }, { name: "StatusCheck", params: { scheduleId, scheduledFor: slot.toISOString() } }] });
  }
  async function snooze(method: "음성" | "버튼") {
    const pid = await getPatientId();
    if (pid && scheduleId && schedule) {
      const slot = doseSlot(schedule.hour, schedule.minute, new Date());
      try {
        await recordIntake({ patientId: pid, scheduleId, scheduledFor: slot, status: "재알림", method });
        await scheduleSnooze(scheduleId, schedule.medicine_name, 30);
      } catch {
        Alert.alert("다시 알림 설정에 실패했어요", "인터넷 연결을 확인하고 다시 눌러 주세요.");
        return;
      }
    }
    await speak("30분 뒤에 다시 알려드릴게요.");
    nav.navigate("Tabs");
  }

  async function onSpeechFinal(text: string) {
    const intent = classifyIntent(text);
    if (intent === "복용완료") { await write("복용완료", "음성"); return; }
    if (intent === "미복용") { await write("미복용", "음성"); return; }
    if (intent === "재알림") { await snooze("음성"); return; }
    Alert.alert("잘 듣지 못했어요", "버튼으로 선택해 주세요.");
  }

  const speech = useSpeechToText(onSpeechFinal);

  async function onMic() {
    if (speech.listening) { speech.stop(); return; }
    try {
      await speech.start();
    } catch {
      Alert.alert("마이크를 사용할 수 없어요", "마이크 권한을 확인하시거나 버튼으로 선택해 주세요.");
    }
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

        {/* Title */}
        <Text style={styles.title}>
          {schedule ? `${schedule.medicine_name} 드실 시간이에요` : "복약 시간이에요"}
        </Text>
        <Text style={styles.subtitle}>복용하신 뒤 말씀해 주세요.</Text>

        {ready ? (
          <>
            <View style={{ height: spacing.lg }} />
            <MicButton recording={speech.listening} onPress={onMic} />
            {speech.transcript ? <Text style={styles.live}>{speech.transcript}</Text> : null}
            <View style={{ height: spacing.xl }} />
            <BigButton label="복용 완료" onPress={() => write("복용완료", "버튼")} />
            <BigButton label="아직 안 먹었어요" variant="secondary" onPress={() => write("미복용", "버튼")} />
            <BigButton label="30분 뒤 다시 알려주세요" variant="secondary" onPress={() => snooze("버튼")} />
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
  live: { textAlign: "center", fontSize: fontSizes.body, color: colors.textSecondary, marginTop: spacing.md },
});

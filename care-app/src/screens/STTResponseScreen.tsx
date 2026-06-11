import React, { useState } from "react";
import { View, Text, StyleSheet, Alert, ScrollView } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { CheckCircle2, AlertCircle } from "lucide-react-native";
import { BigButton } from "../components/BigButton";
import { MicButton } from "../components/MicButton";
import { ScreenHeader } from "../components/ScreenHeader";
import { startRecording, stopAndTranscribe } from "../lib/stt";
import { classifyIntent } from "../lib/intent";
import { getPatientId } from "../lib/storage";
import { recordIntake } from "../lib/records";
import { supabase } from "../lib/supabase";
import { scheduleSnooze } from "../lib/notifications";
import { colors, fontSizes, spacing, radii } from "../theme/tokens";

export function STTResponseScreen() {
  const nav = useNavigation<any>();
  const scheduleId: string | undefined = useRoute<any>().params?.scheduleId;
  const scheduledFor: string | undefined = useRoute<any>().params?.scheduledFor;
  const [recording, setRecording] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);

  async function commit(status: "복용완료" | "미복용", method: "음성" | "버튼") {
    const pid = await getPatientId();
    if (pid && scheduleId) {
      try {
        await recordIntake({
          patientId: pid, scheduleId,
          scheduledFor: scheduledFor ? new Date(scheduledFor) : new Date(),
          status, method,
        });
      } catch {
        Alert.alert("저장에 실패했어요", "인터넷 연결을 확인하고 다시 눌러 주세요.");
        return;
      }
    }
    nav.reset({ index: 1, routes: [{ name: "Tabs" }, { name: "StatusCheck", params: { scheduleId, scheduledFor } }] });
  }
  async function snooze() {
    const pid = await getPatientId();
    if (pid && scheduleId) {
      try {
        const { data: sch } = await supabase.from("schedules").select("*").eq("id", scheduleId).single();
        await recordIntake({
          patientId: pid, scheduleId,
          scheduledFor: scheduledFor ? new Date(scheduledFor) : new Date(),
          status: "재알림", method: "음성",
        });
        if (sch) await scheduleSnooze(scheduleId, sch.medicine_name, 30);
      } catch {
        Alert.alert("다시 알림 설정에 실패했어요", "인터넷 연결을 확인하고 다시 눌러 주세요.");
        return;
      }
    }
    nav.navigate("Tabs");
  }
  async function onMic() {
    if (!recording) {
      try {
        await startRecording();
        setRecording(true);
      } catch {
        Alert.alert("마이크를 사용할 수 없어요", "마이크 권한을 확인하시거나 버튼으로 선택해 주세요.");
      }
      return;
    }
    setRecording(false);
    try {
      const text = await stopAndTranscribe(); setHeard(text || "(들리지 않음)");
      const intent = classifyIntent(text);
      if (intent === "복용완료") return commit("복용완료", "음성");
      if (intent === "미복용") return commit("미복용", "음성");
      if (intent === "재알림") return snooze();
    } catch { setHeard("(인식 실패)"); }
  }

  const failed = heard === "(인식 실패)" || heard === "(들리지 않음)";
  const hasHeard = heard !== null;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="음성 응답" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Recognition status icon */}
        <View
          style={[
            styles.statusIcon,
            { backgroundColor: failed ? "#FFF0F0" : hasHeard ? "#E6F9F1" : colors.lightBlueBg },
          ]}
        >
          {failed ? (
            <AlertCircle size={64} color={colors.dangerRed} strokeWidth={1.5} />
          ) : (
            <CheckCircle2 size={64} color={hasHeard ? colors.successGreen : colors.secondaryBlue} strokeWidth={1.5} />
          )}
        </View>

        <Text style={styles.title}>
          {failed ? "잘 듣지 못했어요" : "다시 한번 말씀해 주세요"}
        </Text>

        {/* Heard content */}
        {hasHeard ? (
          <View style={styles.heardCard}>
            <Text style={styles.heardLabel}>들은 내용</Text>
            <Text style={styles.heardValue}>{heard}</Text>
          </View>
        ) : null}

        <Text style={styles.subtitle}>복용 여부를 말씀하시거나 버튼으로 선택해 주세요.</Text>

        <View style={{ height: spacing.lg }} />
        <MicButton recording={recording} onPress={onMic} />
        <View style={{ height: spacing.xl }} />

        <Text style={styles.or}>버튼으로 선택하기</Text>
        <BigButton label="복용 완료" onPress={() => commit("복용완료", "버튼")} />
        <BigButton label="아직 안 먹었어요" variant="secondary" onPress={() => commit("미복용", "버튼")} />
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cardBg },
  scroll: { flexGrow: 1, padding: spacing.lg, justifyContent: "center" },
  statusIcon: {
    width: 112, height: 112, borderRadius: 56,
    alignItems: "center", justifyContent: "center", alignSelf: "center",
    marginBottom: spacing.lg,
  },
  title: { fontSize: fontSizes.title, fontWeight: "800", color: colors.text, textAlign: "center", marginBottom: spacing.md },
  heardCard: {
    backgroundColor: colors.lightBlueBg, borderRadius: radii.card,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  heardLabel: { fontSize: fontSizes.body, color: colors.textSecondary, marginBottom: spacing.xs },
  heardValue: { fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: fontSizes.body, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.sm },
  or: { fontSize: fontSizes.body, color: colors.textSecondary, textAlign: "center", marginVertical: spacing.sm },
});

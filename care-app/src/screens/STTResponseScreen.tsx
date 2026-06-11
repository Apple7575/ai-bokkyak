import React, { useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { BigButton } from "../components/BigButton";
import { MicButton } from "../components/MicButton";
import { startRecording, stopAndTranscribe } from "../lib/stt";
import { classifyIntent } from "../lib/intent";
import { getPatientId } from "../lib/storage";
import { recordIntake } from "../lib/records";
import { supabase } from "../lib/supabase";
import { scheduleSnooze } from "../lib/notifications";
import { colors, fontSizes, spacing } from "../theme/tokens";

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
    nav.navigate("StatusCheck", { scheduleId, scheduledFor });
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
    if (!recording) { setRecording(true); await startRecording(); return; }
    setRecording(false);
    try {
      const text = await stopAndTranscribe(); setHeard(text || "(들리지 않음)");
      const intent = classifyIntent(text);
      if (intent === "복용완료") return commit("복용완료", "음성");
      if (intent === "미복용") return commit("미복용", "음성");
      if (intent === "재알림") return snooze();
    } catch { setHeard("(인식 실패)"); }
  }

  return (
    <View style={styles.c}>
      <Text style={styles.title}>다시 한번 말씀해 주세요</Text>
      {heard ? <Text style={styles.heard}>들은 내용: {heard}</Text> : null}
      <MicButton recording={recording} onPress={onMic} />
      <View style={{ height: spacing.lg }} />
      <Text style={styles.or}>버튼으로 선택하기</Text>
      <BigButton label="복용 완료" onPress={() => commit("복용완료", "버튼")} />
      <BigButton label="아직 안 먹었어요" variant="secondary" onPress={() => commit("미복용", "버튼")} />
    </View>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, padding: spacing.lg, justifyContent: "center" },
  title: { fontSize: fontSizes.title, fontWeight: "800", color: colors.text, textAlign: "center", marginBottom: spacing.md },
  heard: { fontSize: fontSizes.body, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.lg },
  or: { fontSize: fontSizes.body, color: colors.textSecondary, textAlign: "center", marginVertical: spacing.sm },
});

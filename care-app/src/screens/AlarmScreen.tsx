import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { BigButton } from "../components/BigButton";
import { MicButton } from "../components/MicButton";
import { speak } from "../lib/tts";
import { supabase, Schedule } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { recordIntake } from "../lib/records";
import { scheduleSnooze } from "../lib/notifications";
import { startRecording, stopAndTranscribe } from "../lib/stt";
import { classifyIntent } from "../lib/intent";
import { colors, fontSizes, spacing } from "../theme/tokens";

export function AlarmScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const scheduleId: string | undefined = route.params?.scheduleId;
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    (async () => {
      if (!scheduleId) return;
      const { data } = await supabase.from("schedules").select("*").eq("id", scheduleId).single();
      setSchedule(data);
      if (data) speak(`${data.medicine_name} 드실 시간입니다. 복용하신 뒤 말씀해 주세요.`);
    })();
  }, [scheduleId]);

  async function write(status: "복용완료" | "미복용", method: "음성" | "버튼") {
    const pid = await getPatientId();
    if (!pid || !scheduleId) { nav.navigate("Tabs"); return; }
    await recordIntake({ patientId: pid, scheduleId, scheduledFor: new Date(), status, method });
    speak(status === "복용완료" ? "복약 완료로 기록했습니다." : "미복용으로 기록했습니다.");
    nav.navigate("StatusCheck", { scheduleId });
  }
  async function snooze(method: "음성" | "버튼") {
    const pid = await getPatientId();
    if (pid && scheduleId && schedule) {
      await recordIntake({ patientId: pid, scheduleId, scheduledFor: new Date(), status: "재알림", method });
      await scheduleSnooze(scheduleId, schedule.medicine_name, 30);
    }
    speak("30분 뒤에 다시 알려드릴게요.");
    nav.navigate("Tabs");
  }

  async function onMic() {
    if (!recording) { setRecording(true); await startRecording(); return; }
    setRecording(false);
    try {
      const text = await stopAndTranscribe();
      const intent = classifyIntent(text);
      if (intent === "복용완료") return write("복용완료", "음성");
      if (intent === "미복용") return write("미복용", "음성");
      if (intent === "재알림") return snooze("음성");
      nav.navigate("STTResponse", { scheduleId });
    } catch {
      Alert.alert("잘 듣지 못했어요", "버튼으로 선택해 주세요.");
    }
  }

  return (
    <View style={styles.c}>
      <Text style={styles.bell}>🔔</Text>
      <Text style={styles.title}>{schedule ? `${schedule.medicine_name} 드실 시간이에요` : "복약 시간이에요"}</Text>
      <MicButton recording={recording} onPress={onMic} />
      <View style={{ height: spacing.lg }} />
      <BigButton label="복용 완료" onPress={() => write("복용완료", "버튼")} />
      <BigButton label="아직 안 먹었어요" variant="secondary" onPress={() => write("미복용", "버튼")} />
      <BigButton label="30분 뒤 다시 알려주세요" variant="secondary" onPress={() => snooze("버튼")} />
    </View>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, padding: spacing.lg, justifyContent: "center", backgroundColor: colors.lightBlueBg },
  bell: { fontSize: 56, textAlign: "center" },
  title: { fontSize: fontSizes.title, fontWeight: "800", color: colors.text,
    textAlign: "center", marginVertical: spacing.lg },
});

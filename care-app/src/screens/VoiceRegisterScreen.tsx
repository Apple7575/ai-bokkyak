import React, { useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { BigButton } from "../components/BigButton";
import { MicButton } from "../components/MicButton";
import { startRecording, stopAndTranscribe } from "../lib/stt";
import { gptParseSchedule } from "../lib/openai";
import { ParsedSchedule } from "../lib/parse";
import { supabase } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { ensurePermission, scheduleReminders } from "../lib/notifications";
import { speak } from "../lib/tts";
import { colors, fontSizes, spacing } from "../theme/tokens";

export function VoiceRegisterScreen() {
  const nav = useNavigation<any>();
  const [recording, setRecording] = useState(false);
  const [parsed, setParsed] = useState<ParsedSchedule | null>(null);
  const [transcript, setTranscript] = useState("");

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
      const text = await stopAndTranscribe(); setTranscript(text);
      const result = await gptParseSchedule(text);
      if (!result.ok) { Alert.alert("다시 말씀해 주세요", "예: 매일 아침 8시에 고혈압약 먹어요"); return; }
      setParsed(result.value);
      speak(`${result.value.hour}시, ${result.value.medicine_name}으로 등록할까요?`);
    } catch { Alert.alert("인식 실패", "다시 시도해 주세요."); }
  }

  async function confirm() {
    if (!parsed) return;
    const pid = await getPatientId(); if (!pid) return;
    const { data, error } = await supabase.from("schedules").insert({
      patient_id: pid, medicine_name: parsed.medicine_name, time_of_day: parsed.time_of_day,
      hour: parsed.hour, minute: parsed.minute, repeat_days: parsed.repeat_days, active: true,
    }).select().single();
    if (error || !data) { Alert.alert("저장 실패", error?.message ?? ""); return; }
    if (await ensurePermission()) await scheduleReminders(data.id, data.medicine_name, parsed.hour, parsed.minute, parsed.repeat_days);
    speak("복약 일정을 등록했습니다.");
    nav.navigate("Tabs");
  }

  return (
    <View style={styles.c}>
      <Text style={styles.title}>음성으로 약 등록</Text>
      <Text style={styles.hint}>예: "매일 아침 8시에 고혈압약 먹어요"</Text>
      <MicButton recording={recording} onPress={onMic} />
      {transcript ? <Text style={styles.heard}>들은 내용: {transcript}</Text> : null}
      {parsed ? (
        <View style={styles.confirm}>
          <Text style={styles.row}>약 이름: {parsed.medicine_name}</Text>
          <Text style={styles.row}>복용 시간: {parsed.hour}시 {parsed.minute}분</Text>
          <Text style={styles.row}>반복: {parsed.repeat_days.length === 0 ? "매일" : parsed.repeat_days.join(",")}</Text>
          <BigButton label="이대로 등록하기" onPress={confirm} />
          <BigButton label="다시 말하기" variant="secondary" onPress={() => { setParsed(null); setTranscript(""); }} />
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, padding: spacing.lg, justifyContent: "center" },
  title: { fontSize: fontSizes.title, fontWeight: "800", color: colors.text, textAlign: "center" },
  hint: { fontSize: fontSizes.body, color: colors.textSecondary, textAlign: "center", marginVertical: spacing.md },
  heard: { fontSize: fontSizes.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.md },
  confirm: { marginTop: spacing.lg, backgroundColor: colors.lightBlueBg, borderRadius: 16, padding: spacing.lg },
  row: { fontSize: fontSizes.emphasis, color: colors.text, marginBottom: spacing.sm },
});

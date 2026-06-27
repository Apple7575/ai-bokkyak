import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Alert, TextInput } from "react-native";
import { spokenTime } from "../lib/spokenTime";
import { useNavigation } from "@react-navigation/native";
import { Pill, Clock, RefreshCw } from "lucide-react-native";
import { BigButton } from "../components/BigButton";
import { ScreenHeader } from "../components/ScreenHeader";
import { MicButton } from "../components/MicButton";
import { useSpeechToText } from "../hooks/useSpeechToText";
import { gptParseSchedule } from "../lib/openai";
import { ParsedSchedule } from "../lib/parse";
import { supabase } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { ensurePermission, scheduleReminders } from "../lib/notifications";
import { ensureStrongAlarmReady } from "../lib/alarmPermissions";
import { speak } from "../lib/tts";
import { colors, fontSizes, spacing, radii } from "../theme/tokens";

export function VoiceRegisterScreen() {
  const nav = useNavigation<any>();
  const [parsed, setParsed] = useState<ParsedSchedule | null>(null);
  const [transcript, setTranscript] = useState("");

  async function onSpeechFinal(text: string) {
    setTranscript(text);
    try {
      const result = await gptParseSchedule(text);
      if (!result.ok) { Alert.alert("다시 말씀해 주세요", "예: 매일 아침 8시에 고혈압약 먹어요"); return; }
      setParsed(result.value);
      await speak(`${spokenTime(result.value.hour, result.value.minute)}, ${result.value.medicine_name}으로 등록할까요?`);
    } catch { Alert.alert("인식 실패", "다시 시도해 주세요."); }
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

  async function confirm() {
    if (!parsed) return;
    if (!parsed.medicine_name.trim()) { Alert.alert("약 이름을 입력해 주세요"); return; }
    const pid = await getPatientId(); if (!pid) return;
    const { data, error } = await supabase.from("schedules").insert({
      patient_id: pid, medicine_name: parsed.medicine_name, time_of_day: parsed.time_of_day,
      hour: parsed.hour, minute: parsed.minute, repeat_days: parsed.repeat_days, active: true,
    }).select().single();
    if (error || !data) { Alert.alert("저장 실패", error?.message ?? ""); return; }
    await ensureStrongAlarmReady();
    // 알림 예약은 베스트에포트 — 실패해도 일정은 이미 저장됐으므로 등록 흐름을 막지 않는다.
    try { if (await ensurePermission()) await scheduleReminders(data.id, data.medicine_name, parsed.hour, parsed.minute, parsed.repeat_days, parsed.time_of_day); } catch {}
    await speak("복약 일정을 등록했습니다.");
    nav.navigate("Tabs");
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="음성으로 약 등록" />
      <ScrollView contentContainerStyle={styles.c}>
        <Text style={styles.guide}>복용하는 약과 시간을 말씀해 주세요</Text>
        <View style={styles.exampleCard}>
          <Text style={styles.exampleText}>예: "매일 아침 8시에 고혈압약 먹어요"</Text>
        </View>

        <View style={styles.micWrap}>
          <MicButton recording={speech.listening} onPress={onMic} />
        </View>

        {speech.transcript || transcript ? (
          <View style={styles.heardCard}>
            <Text style={styles.heardLabel}>인식된 문장</Text>
            <Text style={styles.heardText}>{speech.transcript || transcript}</Text>
          </View>
        ) : null}

        {parsed ? (
          <View style={styles.confirm}>
            <Text style={styles.confirmTitle}>자동 분류 결과</Text>

            {/* 약 이름 — 직접 수정 가능 */}
            <View style={styles.resultRow}>
              <View style={styles.resultIcon}><Pill size={18} color={colors.primaryBlue} /></View>
              <Text style={styles.resultLabel}>약 이름</Text>
              <TextInput
                style={styles.nameInput}
                value={parsed.medicine_name}
                onChangeText={(t) => setParsed({ ...parsed, medicine_name: t })}
                placeholder="약 이름"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.resultRow}>
              <View style={styles.resultIcon}>
                <Clock size={18} color={colors.primaryBlue} />
              </View>
              <Text style={styles.resultLabel}>복용 시간</Text>
              <Text style={styles.resultValue}>{parsed.hour}시 {parsed.minute}분</Text>
            </View>

            <View style={styles.resultRow}>
              <View style={styles.resultIcon}>
                <RefreshCw size={18} color={colors.primaryBlue} />
              </View>
              <Text style={styles.resultLabel}>반복</Text>
              <Text style={styles.resultValue}>{parsed.repeat_days.length === 0 ? "매일" : parsed.repeat_days.join(",")}</Text>
            </View>

            <BigButton label="이대로 등록하기" onPress={confirm} />
            <BigButton label="다시 말하기" variant="secondary" onPress={() => { setParsed(null); setTranscript(""); }} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cardBg },
  c: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: fontSizes.title, fontWeight: "800", color: colors.primaryNavy, textAlign: "center" },
  guide: { fontSize: fontSizes.body, fontWeight: "600", color: colors.text, textAlign: "center", marginTop: spacing.md },
  exampleCard: {
    backgroundColor: colors.lightBlueBg,
    borderRadius: radii.button,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    alignSelf: "center",
  },
  exampleText: { fontSize: fontSizes.body, color: colors.secondaryBlue, textAlign: "center" },
  micWrap: { marginVertical: spacing.xl, alignItems: "center" },
  heardCard: {
    backgroundColor: colors.lightBlueBg,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  heardLabel: { fontSize: fontSizes.body, color: colors.textSecondary, marginBottom: spacing.xs },
  heardText: { fontSize: fontSizes.body, fontWeight: "600", color: colors.text },
  confirm: {
    marginTop: spacing.sm,
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    padding: spacing.lg,
    borderColor: colors.border,
    borderWidth: 1,
  },
  confirmTitle: { fontSize: fontSizes.body, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.lightBlueBg,
    borderRadius: radii.button,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  resultLabel: { fontSize: fontSizes.body, color: colors.textSecondary },
  resultValue: { fontSize: fontSizes.body, fontWeight: "700", color: colors.text, marginLeft: "auto" },
  nameInput: {
    marginLeft: "auto", minWidth: 140, textAlign: "right",
    fontSize: fontSizes.body, fontWeight: "700", color: colors.text,
    borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 4,
  },
});

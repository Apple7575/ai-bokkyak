import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Alert, TextInput } from "react-native";
import { spokenTime } from "../lib/spokenTime";
import { useNavigation } from "@react-navigation/native";
import { Pill, Clock, RefreshCw } from "lucide-react-native";
import { BigButton } from "../components/BigButton";
import { ScreenHeader } from "../components/ScreenHeader";
import { MicButton } from "../components/MicButton";
import { TimeChip } from "../components/TimeChip";
import { WheelPicker } from "../components/WheelPicker";
import { useSpeechToText } from "../hooks/useSpeechToText";
import { gptParseSchedule } from "../lib/openai";
import { ParsedSchedule } from "../lib/parse";
import { supabase } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { ensurePermission, scheduleReminders } from "../lib/notifications";
import { ensureStrongAlarmReady } from "../lib/alarmPermissions";
import { normalizeRepeatDays } from "../lib/schedule";
import { speak } from "../lib/tts";
import { colors, fontSizes, spacing, radii } from "../theme/tokens";

const HOUR_VALUES = Array.from({ length: 24 }, (_, i) => i);
const MINUTE_VALUES = Array.from({ length: 60 }, (_, i) => i);
const DAYS = ["일", "월", "화", "수", "목", "금", "토"]; // index 0=일 … 6=토

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
    const days = normalizeRepeatDays(parsed.repeat_days); // 편집된 요일을 정렬·중복제거(빈배열=매일)
    const { data, error } = await supabase.from("schedules").insert({
      patient_id: pid, medicine_name: parsed.medicine_name.trim(), time_of_day: parsed.time_of_day,
      hour: parsed.hour, minute: parsed.minute, repeat_days: days, active: true,
    }).select().single();
    if (error || !data) { Alert.alert("저장 실패", error?.message ?? ""); return; }
    await ensureStrongAlarmReady();
    // 알림 예약은 베스트에포트(일정은 이미 저장됨). 단, 실패/권한없음은 사용자에게 알려 알람이 안 울리는 걸 모르고 넘어가지 않게 한다.
    try {
      if (await ensurePermission()) {
        await scheduleReminders(data.id, data.medicine_name, parsed.hour, parsed.minute, days, parsed.time_of_day);
      } else {
        Alert.alert("알림 권한 필요", "알림 권한이 꺼져 있어 알람이 울리지 않을 수 있어요. 설정에서 켜주세요. (약은 등록됐어요)");
      }
    } catch {
      Alert.alert("알람 설정 실패", "약은 등록됐지만 알림 예약에 실패했어요. 설정에서 알림 권한을 확인하고 다시 등록해 주세요.");
    }
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

            {/* 복용 시간 — 스크롤로 수정(잘못 인식돼도 고칠 수 있게) */}
            <View style={styles.editHead}>
              <Clock size={18} color={colors.primaryBlue} />
              <Text style={styles.editLabel}>복용 시간</Text>
            </View>
            <View style={styles.wheelRow}>
              <WheelPicker values={HOUR_VALUES} value={parsed.hour} onChange={(h) => setParsed({ ...parsed, hour: h })} suffix="시" />
              <WheelPicker values={MINUTE_VALUES} value={parsed.minute} onChange={(m) => setParsed({ ...parsed, minute: m })} suffix="분" />
            </View>

            {/* 반복 요일 — 수정 가능(없으면 매일) */}
            <View style={styles.editHead}>
              <RefreshCw size={18} color={colors.primaryBlue} />
              <Text style={styles.editLabel}>반복 요일 (없으면 매일)</Text>
            </View>
            <View style={styles.chipRow}>
              <TimeChip label="매일" selected={parsed.repeat_days.length === 0} onPress={() => setParsed({ ...parsed, repeat_days: [] })} />
              {DAYS.map((d, i) => (
                <TimeChip
                  key={d}
                  label={d}
                  selected={parsed.repeat_days.includes(i)}
                  onPress={() =>
                    setParsed({
                      ...parsed,
                      repeat_days: parsed.repeat_days.includes(i)
                        ? parsed.repeat_days.filter((x) => x !== i)
                        : [...parsed.repeat_days, i],
                    })
                  }
                />
              ))}
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
  editHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm },
  editLabel: { fontSize: fontSizes.body, fontWeight: "700", color: colors.text },
  wheelRow: { flexDirection: "row", justifyContent: "center", gap: spacing.lg },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 },
  nameInput: {
    marginLeft: "auto", minWidth: 140, textAlign: "right",
    fontSize: fontSizes.body, fontWeight: "700", color: colors.text,
    borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 4,
  },
});

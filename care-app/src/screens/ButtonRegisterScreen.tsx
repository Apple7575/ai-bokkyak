import React, { useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Pill } from "lucide-react-native";
import { BigButton } from "../components/BigButton";
import { ScreenHeader } from "../components/ScreenHeader";
import { TimeChip } from "../components/TimeChip";
import { supabase } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { ensurePermission, scheduleReminders } from "../lib/notifications";
import { colors, fontSizes, spacing, radii } from "../theme/tokens";

const TODS = ["아침", "점심", "저녁", "취침"];
const HOURS = [7, 8, 9, 12, 13, 18, 19, 20, 21];

export function ButtonRegisterScreen() {
  const nav = useNavigation<any>();
  const [name, setName] = useState("");
  const [tod, setTod] = useState("아침");
  const [hour, setHour] = useState(8);

  async function save() {
    if (!name.trim()) { Alert.alert("약 이름을 입력해 주세요"); return; }
    const pid = await getPatientId(); if (!pid) return;
    const { data, error } = await supabase.from("schedules").insert({
      patient_id: pid, medicine_name: name.trim(), time_of_day: tod,
      hour, minute: 0, repeat_days: [], active: true,
    }).select().single();
    if (error || !data) { Alert.alert("저장 실패", error?.message ?? ""); return; }
    if (await ensurePermission()) await scheduleReminders(data.id, data.medicine_name, hour, 0, data.repeat_days ?? [], data.time_of_day);
    Alert.alert("복약 일정을 등록했습니다.");
    nav.navigate("Tabs");
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="버튼으로 등록" />
      <ScrollView contentContainerStyle={styles.c}>
        {/* 약 이름 */}
        <View style={styles.section}>
          <Text style={styles.label}>약 이름</Text>
          <View style={styles.inputWrap}>
            <View style={styles.inputIcon}>
              <Pill size={20} color={colors.primaryBlue} />
            </View>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="예: 고혈압약"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>

        {/* 언제 드시나요? */}
        <View style={styles.section}>
          <Text style={styles.label}>언제 드시나요?</Text>
          <View style={styles.row}>{TODS.map((t) => (
            <TimeChip key={t} label={t} selected={tod === t} onPress={() => setTod(t)} />
          ))}</View>
        </View>

        {/* 세부 시간 */}
        <View style={styles.section}>
          <Text style={styles.label}>세부 시간</Text>
          <View style={styles.row}>{HOURS.map((h) => (
            <TimeChip key={h} label={`${h}시`} selected={hour === h} onPress={() => setHour(h)} />
          ))}</View>
        </View>
      </ScrollView>

      {/* 하단 저장 버튼 */}
      <View style={styles.footer}>
        <BigButton label="저장하기" onPress={save} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cardBg },
  c: { padding: spacing.lg, paddingBottom: spacing.xl },
  section: { marginBottom: spacing.lg },
  label: { fontSize: fontSizes.body, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.lightBlueBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.button,
    paddingHorizontal: 14,
  },
  inputIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  input: { flex: 1, fontSize: fontSizes.body, color: colors.text, paddingVertical: 16 },
  row: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    backgroundColor: colors.cardBg,
  },
});

import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { KeyRound, CalendarCheck } from "lucide-react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { StatusBadge } from "../components/StatusBadge";
import { supabase, IntakeRecord, Patient, Schedule } from "../lib/supabase";
import { getPatientId, getPatientCode, getRole } from "../lib/storage";
import { todayStatus, weeklyRate } from "../lib/guardianStats";
import { colors, fontSizes, spacing, radii } from "../theme/tokens";

const TIME_LABEL = (h: number, m: number) => {
  const ap = h < 12 ? "오전" : "오후"; const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ap} ${h12}:${String(m).padStart(2, "0")}`;
};

export function GuardianDashboardScreen() {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [recent, setRecent] = useState<IntakeRecord[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  useFocusEffect(useCallback(() => {
    (async () => {
      setRole(await getRole());
      setCode(await getPatientCode());
      const pid = await getPatientId(); if (!pid) return;
      const { data: p } = await supabase.from("patients").select("*").eq("id", pid).single();
      setPatient(p);
      const { data: scheds } = await supabase.from("schedules").select("*")
        .eq("patient_id", pid).eq("active", true);
      setSchedules(scheds ?? []);
      const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
      const { data: recs } = await supabase.from("intake_records").select("*")
        .eq("patient_id", pid).gte("scheduled_for", weekAgo).order("scheduled_for", { ascending: false });
      setRecent(recs ?? []);
    })();
  }, []));

  const now = new Date();
  const today = todayStatus(schedules, recent, now);
  const week = weeklyRate(schedules, recent, now);
  const attention = today.filter((t) => t.status === "missed" || t.status === "skipped");
  return (
    <View style={styles.screen}>
      <ScreenHeader title="복약 현황" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.c}>
        <Text style={styles.h}>{patient ? `${patient.name} 님의 복약 현황` : "복약 현황"}</Text>

        {role === "patient" && code ? (
          <View style={styles.codeBox}>
            <View style={styles.codeLabelRow}>
              <KeyRound size={16} color="#cfe0ff" />
              <Text style={styles.codeLabel}>보호자에게 알려줄 연결 코드</Text>
            </View>
            <Text style={styles.code}>{code}</Text>
          </View>
        ) : null}

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <CalendarCheck size={22} color={colors.primaryBlue} />
          </View>
          <View style={styles.summaryTextWrap}>
            <Text style={styles.summaryTitle}>최근 7일 복약 이행률</Text>
            <Text style={styles.rate}>{week.rate == null ? "기록 없음" : `${week.rate}%`}</Text>
            <Text style={styles.summaryDesc}>복용 완료 {week.completed}회 / 예정 {week.expected}회</Text>
          </View>
        </View>

        {/* 오늘 복약 현황 — 이미 시간이 지난 슬롯만 */}
        <Text style={styles.section}>오늘 복약 현황</Text>
        {today.length === 0 ? (
          <Text style={styles.empty}>아직 복약 시간이 되지 않았어요.</Text>
        ) : today.map((t) => (
          <View key={`${t.schedule.id}-${t.slot.getTime()}`} style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.medName}>{t.schedule.medicine_name}</Text>
              <Text style={styles.time}>{TIME_LABEL(t.schedule.hour, t.schedule.minute)}</Text>
            </View>
            <StatusBadge status={t.status} />
          </View>
        ))}

        {/* 확인이 필요한 항목(미복용/건너뛰기) 강조 */}
        {attention.length > 0 ? (
          <View style={styles.attnCard}>
            <Text style={styles.attnTitle}>확인이 필요해요</Text>
            {attention.map((t) => (
              <Text key={`a-${t.schedule.id}-${t.slot.getTime()}`} style={styles.attnText}>
                • {TIME_LABEL(t.schedule.hour, t.schedule.minute)} {t.schedule.medicine_name} — 복약 누락 또는 미확인
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={styles.section}>복약 기록</Text>
        {recent.map((r) => {
          const d = new Date(r.scheduled_for);
          return (
            <View key={r.id} style={styles.row}>
              <Text style={styles.time}>
                {String(d.getMonth() + 1).padStart(2, "0")}/{String(d.getDate()).padStart(2, "0")} {String(d.getHours()).padStart(2, "0")}:{String(d.getMinutes()).padStart(2, "0")}
              </Text>
              <StatusBadge status={r.status} />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7FAFF" },
  scroll: { flex: 1 },
  c: { padding: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  h: { fontSize: fontSizes.title, fontWeight: "800", color: colors.primaryNavy, marginBottom: spacing.md },
  codeBox: {
    backgroundColor: colors.primaryNavy, borderRadius: radii.card, padding: spacing.lg, marginBottom: spacing.md,
    shadowColor: colors.primaryNavy, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 14, elevation: 4,
  },
  codeLabelRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  codeLabel: { color: "#cfe0ff", fontSize: fontSizes.body },
  code: { color: "#fff", fontSize: 36, fontWeight: "800", letterSpacing: 6, marginTop: spacing.sm },
  summaryCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.lg, marginBottom: spacing.md,
  },
  summaryIcon: { width: 44, height: 44, borderRadius: 999, backgroundColor: colors.lightBlueBg, alignItems: "center", justifyContent: "center" },
  summaryTextWrap: { flexShrink: 1 },
  summaryTitle: { fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.text },
  rate: { fontSize: 32, fontWeight: "800", color: colors.primaryNavy, marginTop: spacing.xs },
  summaryDesc: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: spacing.xs },
  empty: { fontSize: fontSizes.body, color: colors.textSecondary, paddingVertical: spacing.sm },
  rowLeft: { flexShrink: 1 },
  medName: { fontSize: fontSizes.body, fontWeight: "700", color: colors.text },
  attnCard: {
    backgroundColor: "#FFF0F0", borderColor: colors.dangerRed, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md, marginTop: spacing.md,
  },
  attnTitle: { fontSize: fontSizes.body, fontWeight: "800", color: colors.dangerRed, marginBottom: spacing.xs },
  attnText: { fontSize: fontSizes.body, color: colors.text, marginTop: 2 },
  section: {
    fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.text,
    marginTop: spacing.sm, marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.button, padding: spacing.md, marginVertical: 6,
  },
  time: { fontSize: fontSizes.body, color: colors.text },
});

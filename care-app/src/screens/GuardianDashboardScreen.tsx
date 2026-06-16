import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { KeyRound, CalendarCheck } from "lucide-react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { StatusBadge } from "../components/StatusBadge";
import { supabase, IntakeRecord, Patient } from "../lib/supabase";
import { getPatientId, getPatientCode, getRole } from "../lib/storage";
import { colors, fontSizes, spacing, radii } from "../theme/tokens";

export function GuardianDashboardScreen() {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [recent, setRecent] = useState<IntakeRecord[]>([]);

  useFocusEffect(useCallback(() => {
    (async () => {
      setRole(await getRole());
      setCode(await getPatientCode());
      const pid = await getPatientId(); if (!pid) return;
      const { data: p } = await supabase.from("patients").select("*").eq("id", pid).single();
      setPatient(p);
      const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
      const { data: recs } = await supabase.from("intake_records").select("*")
        .eq("patient_id", pid).gte("scheduled_for", weekAgo).order("scheduled_for", { ascending: false });
      setRecent(recs ?? []);
    })();
  }, []));

  const done = recent.filter((r) => r.status === "completed").length;
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
            <Text style={styles.summaryTitle}>최근 7일 복약 요약</Text>
            <Text style={styles.summaryDesc}>복용 완료 {done}회 / 총 {recent.length}회</Text>
          </View>
        </View>

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
  summaryDesc: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: spacing.xs },
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

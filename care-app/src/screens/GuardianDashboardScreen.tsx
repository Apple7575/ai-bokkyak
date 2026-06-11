import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBadge } from "../components/StatusBadge";
import { supabase, IntakeRecord, Patient } from "../lib/supabase";
import { getPatientId, getPatientCode, getRole } from "../lib/storage";
import { colors, fontSizes, spacing } from "../theme/tokens";

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

  const done = recent.filter((r) => r.status === "복용완료").length;
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={styles.h}>{patient ? `${patient.name} 님의 복약 현황` : "복약 현황"}</Text>
      {role === "patient" && code ? (
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>보호자에게 알려줄 연결 코드</Text>
          <Text style={styles.code}>{code}</Text>
        </View>
      ) : null}
      <Text style={styles.summary}>최근 7일 · 복용 완료 {done}회 / 총 {recent.length}회</Text>
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
  );
}
const styles = StyleSheet.create({
  h: { fontSize: fontSizes.title, fontWeight: "800", color: colors.text, marginBottom: spacing.md },
  codeBox: { backgroundColor: colors.primaryNavy, borderRadius: 16, padding: spacing.lg, marginBottom: spacing.md },
  codeLabel: { color: "#cfe0ff", fontSize: fontSizes.body },
  code: { color: "#fff", fontSize: 36, fontWeight: "800", letterSpacing: 6, marginTop: spacing.sm },
  summary: { fontSize: fontSizes.body, color: colors.text, marginBottom: spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#fff", borderColor: colors.border, borderWidth: 1, borderRadius: 14,
    padding: spacing.md, marginVertical: 6 },
  time: { fontSize: fontSizes.body, color: colors.text },
});

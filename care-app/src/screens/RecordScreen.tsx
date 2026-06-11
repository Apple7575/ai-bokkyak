import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { StatusBadge } from "../components/StatusBadge";
import { supabase, IntakeRecord, Schedule } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { colors, fontSizes, spacing } from "../theme/tokens";

type Row = IntakeRecord & { medicine_name: string };

export function RecordScreen() {
  const [rows, setRows] = useState<Row[]>([]);
  useFocusEffect(useCallback(() => {
    (async () => {
      const pid = await getPatientId(); if (!pid) return;
      const { data: recs } = await supabase.from("intake_records").select("*")
        .eq("patient_id", pid).order("scheduled_for", { ascending: false }).limit(50);
      const { data: schs } = await supabase.from("schedules").select("*").eq("patient_id", pid);
      const map = new Map((schs ?? []).map((s: Schedule) => [s.id, s.medicine_name]));
      setRows((recs ?? []).map((r: IntakeRecord) => ({ ...r, medicine_name: map.get(r.schedule_id) ?? "약" })));
    })();
  }, []));
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={styles.h}>복약 기록</Text>
      {rows.length === 0 ? <Text style={styles.empty}>아직 기록이 없어요.</Text> : null}
      {rows.map((r) => {
        const d = new Date(r.scheduled_for);
        const time = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ` +
          `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        return (
          <View key={r.id} style={styles.row}>
            <View>
              <Text style={styles.name}>{r.medicine_name}</Text>
              <Text style={styles.meta}>{time} · {r.response_method ?? "-"}</Text>
            </View>
            <StatusBadge status={r.status} />
          </View>
        );
      })}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  h: { fontSize: fontSizes.title, fontWeight: "800", color: colors.text, marginBottom: spacing.md },
  empty: { fontSize: fontSizes.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#fff", borderColor: colors.border, borderWidth: 1, borderRadius: 14,
    padding: spacing.md, marginVertical: 6 },
  name: { fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.text },
  meta: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: 4 },
});

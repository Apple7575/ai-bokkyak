import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { BigButton } from "../components/BigButton";
import { ScheduleCard } from "../components/ScheduleCard";
import { supabase, Schedule } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { spacing, fontSizes, colors } from "../theme/tokens";

export function MedicineListScreen() {
  const nav = useNavigation<any>();
  const [items, setItems] = useState<Schedule[]>([]);
  useFocusEffect(useCallback(() => {
    (async () => {
      const pid = await getPatientId(); if (!pid) return;
      const { data } = await supabase.from("schedules").select("*").eq("patient_id", pid).order("hour");
      setItems(data ?? []);
    })();
  }, []));
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>복약 관리</Text>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {items.length === 0 ? <Text style={styles.empty}>등록된 약이 없어요.</Text> : null}
        {items.map((s) => (
          <ScheduleCard key={s.id} name={s.medicine_name}
            time={`${s.time_of_day} · ${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`} />
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <BigButton label="+ 약 등록하기" onPress={() => nav.navigate("RegisterMethod")} />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7FAFF" },
  header: {
    backgroundColor: colors.cardBg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.primaryNavy },
  list: { padding: spacing.lg, gap: spacing.xs },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  empty: { fontSize: fontSizes.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});

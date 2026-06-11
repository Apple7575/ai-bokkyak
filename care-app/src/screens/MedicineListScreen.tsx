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
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {items.length === 0 ? <Text style={styles.empty}>등록된 약이 없어요.</Text> : null}
        {items.map((s) => (
          <ScheduleCard key={s.id} name={s.medicine_name}
            time={`${s.time_of_day} · ${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`} />
        ))}
      </ScrollView>
      <View style={{ padding: spacing.lg }}>
        <BigButton label="+ 약 등록하기" onPress={() => nav.navigate("RegisterMethod")} />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  empty: { fontSize: fontSizes.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});

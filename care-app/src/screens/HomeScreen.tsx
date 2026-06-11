import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { BigButton } from "../components/BigButton";
import { ScheduleCard } from "../components/ScheduleCard";
import { supabase, Schedule } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { nextNotificationTime } from "../lib/schedule";
import { colors, fontSizes, spacing } from "../theme/tokens";

function fmt(d: Date): string {
  const h = d.getHours(); const m = d.getMinutes();
  const ap = h < 12 ? "오전" : "오후"; const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ap} ${h12}:${String(m).padStart(2, "0")}`;
}

export function HomeScreen() {
  const nav = useNavigation<any>();
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  useFocusEffect(useCallback(() => {
    (async () => {
      const pid = await getPatientId(); if (!pid) return;
      const { data } = await supabase.from("schedules").select("*")
        .eq("patient_id", pid).eq("active", true).order("hour");
      setSchedules(data ?? []);
    })();
  }, []));

  const now = new Date();
  const next = schedules.length
    ? schedules.map((s) => ({ s, t: nextNotificationTime(s, now) }))
        .sort((a, b) => a.t.getTime() - b.t.getTime())[0]
    : null;

  return (
    <ScrollView contentContainerStyle={styles.c}>
      <Text style={styles.greet}>안녕하세요!</Text>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>다음 복약 시간</Text>
        <Text style={styles.heroTime}>{next ? fmt(next.t) : "등록된 약이 없어요"}</Text>
        {next ? <Text style={styles.heroMed}>{next.s.medicine_name}</Text> : null}
      </View>
      <BigButton label="지금 알림 받기 (데모)" onPress={() => nav.navigate("Alarm", { scheduleId: next?.s.id })} />
      <BigButton label="약 등록 / 복약 관리" variant="secondary" onPress={() => nav.navigate("MedicineList")} />
      <Text style={styles.section}>오늘 복약 일정</Text>
      {schedules.map((s) => (
        <ScheduleCard key={s.id} name={s.medicine_name} time={fmt(nextNotificationTime(s, now))} />
      ))}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  c: { padding: spacing.lg, paddingTop: spacing.xl },
  greet: { fontSize: fontSizes.title, fontWeight: "800", color: colors.text, marginBottom: spacing.md },
  hero: { backgroundColor: colors.primaryNavy, borderRadius: 20, padding: spacing.lg, marginBottom: spacing.md },
  heroLabel: { color: "#cfe0ff", fontSize: fontSizes.body },
  heroTime: { color: "#fff", fontSize: fontSizes.hero, fontWeight: "800", marginVertical: spacing.sm },
  heroMed: { color: "#fff", fontSize: fontSizes.emphasis },
  section: { fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.text,
    marginTop: spacing.lg, marginBottom: spacing.sm },
});

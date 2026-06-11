import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Bell, UserCheck, ChevronRight, Clock } from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";
import { BigButton } from "../components/BigButton";
import { ScheduleCard } from "../components/ScheduleCard";
import { supabase, Schedule } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { nextNotificationTime } from "../lib/schedule";
import { colors, fontSizes, spacing, radii } from "../theme/tokens";

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

  // Visual donut driven only by the schedules already in state (no extra query):
  // shows how full the day's plan is, capped so the ring stays readable.
  const total = schedules.length;
  const ringPct = total === 0 ? 0 : Math.min(100, Math.round((total / 4) * 100));
  const R = 36;
  const C = 2 * Math.PI * R;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.c}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.greet}>안녕하세요!</Text>
          <Text style={styles.greetSub}>오늘도 건강한 하루 보내세요.</Text>
        </View>
        <View style={styles.headerIcons}>
          <View style={[styles.iconBtn, { backgroundColor: colors.lightBlueBg }]}>
            <Bell size={20} color={colors.primaryBlue} />
          </View>
          <View style={[styles.iconBtn, { backgroundColor: "#E6F9F1" }]}>
            <UserCheck size={20} color={colors.successGreen} />
          </View>
        </View>
      </View>

      {/* Next medicine hero card */}
      <View style={styles.hero}>
        <View style={styles.heroLabelRow}>
          <Clock size={16} color="#fff" />
          <Text style={styles.heroLabel}>다음 복약 시간</Text>
        </View>
        <Text style={styles.heroTime}>{next ? fmt(next.t) : "등록된 약이 없어요"}</Text>
        {next ? <Text style={styles.heroMed}>{next.s.medicine_name}</Text> : null}
        <Pressable style={styles.heroBtn} onPress={() => nav.navigate("MedicineList")}>
          <Text style={styles.heroBtnText}>복약 일정 보기</Text>
          <ChevronRight size={16} color="#fff" />
        </Pressable>
      </View>

      <BigButton label="지금 알림 받기 (데모)" onPress={() => nav.navigate("Alarm", { scheduleId: next?.s.id })} />
      <BigButton label="약 등록 / 복약 관리" variant="secondary" onPress={() => nav.navigate("MedicineList")} />

      {/* Today's schedule */}
      <Text style={styles.section}>오늘 복약 일정</Text>
      {schedules.map((s) => (
        <ScheduleCard key={s.id} name={s.medicine_name} time={fmt(nextNotificationTime(s, now))} />
      ))}

      {/* Progress / status card */}
      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>오늘의 복약 현황</Text>
        <View style={styles.statusRow}>
          <Svg width={88} height={88} viewBox="0 0 88 88">
            <Circle cx={44} cy={44} r={R} fill="none" stroke={colors.lightBlueBg} strokeWidth={10} />
            <Circle
              cx={44}
              cy={44}
              r={R}
              fill="none"
              stroke={colors.primaryBlue}
              strokeWidth={10}
              strokeDasharray={C}
              strokeDashoffset={C * (1 - ringPct / 100)}
              strokeLinecap="round"
              transform="rotate(-90 44 44)"
            />
          </Svg>
          <View style={styles.statusTextWrap}>
            <Text style={styles.statusCount}>{total}개</Text>
            <Text style={styles.statusDesc}>오늘 등록된 복약 일정</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7FAFF" },
  c: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.lg,
  },
  headerText: { flexShrink: 1 },
  greet: { fontSize: fontSizes.title, fontWeight: "800", color: colors.primaryNavy },
  greetSub: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: spacing.xs },
  headerIcons: { flexDirection: "row", gap: spacing.sm },
  iconBtn: { width: 44, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  hero: {
    backgroundColor: colors.primaryBlue,
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: colors.primaryBlue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  heroLabelRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  heroLabel: { color: "#cfe0ff", fontSize: fontSizes.body },
  heroTime: { color: "#fff", fontSize: fontSizes.hero, fontWeight: "800", marginVertical: spacing.xs },
  heroMed: { color: "#fff", fontSize: fontSizes.emphasis },
  heroBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: radii.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  heroBtnText: { color: "#fff", fontSize: fontSizes.body, fontWeight: "700" },
  section: {
    fontSize: fontSizes.emphasis,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  statusCard: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  statusTitle: { fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  statusTextWrap: { flexShrink: 1 },
  statusCount: { fontSize: 28, fontWeight: "800", color: colors.primaryNavy },
  statusDesc: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: spacing.xs },
});

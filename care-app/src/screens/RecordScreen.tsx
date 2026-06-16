import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { StatusBadge } from "../components/StatusBadge";
import { supabase, IntakeRecord, Schedule, IntakeStatus } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { colors, fontSizes, radii, spacing } from "../theme/tokens";

type Row = IntakeRecord & { medicine_name: string };

type IconType = React.ComponentType<{ size?: number; color?: string }>;
const STATUS_VISUAL: Record<IntakeStatus, { fg: string; bg: string; Icon: IconType }> = {
  completed: { fg: colors.successGreen, bg: "#E6F9F1", Icon: CheckCircle2 },
  snoozed: { fg: colors.warningOrange, bg: "#FFF8ED", Icon: Clock },
  skipped: { fg: colors.dangerRed, bg: "#FFF0F0", Icon: AlertCircle },
};

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

  // 요약 카드는 이미 받은 rows로만 계산 (새 쿼리 없음)
  const total = rows.length;
  const doneCount = rows.filter((r) => r.status === "completed").length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const r = 28;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - pct / 100);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="복약 기록" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* 요약 카드 */}
        <View style={styles.summaryCard}>
          <Svg width={68} height={68} viewBox="0 0 68 68">
            <Circle cx={34} cy={34} r={r} fill="none" stroke={colors.lightBlueBg} strokeWidth={8} />
            <Circle
              cx={34}
              cy={34}
              r={r}
              fill="none"
              stroke={colors.successGreen}
              strokeWidth={8}
              strokeDasharray={`${circumference}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform="rotate(-90 34 34)"
            />
            <SvgText x={34} y={40} textAnchor="middle" fill={colors.primaryNavy} fontSize={16} fontWeight="700">
              {`${pct}%`}
            </SvgText>
          </Svg>
          <View style={styles.summaryTextWrap}>
            <Text style={styles.summaryTitle}>복약률 {pct}%</Text>
            <Text style={styles.summarySub}>총 {total}회 중 {doneCount}회 복용 완료</Text>
          </View>
          <View style={styles.summaryIconCircle}>
            <CheckCircle2 size={20} color={colors.primaryBlue} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>최근 복약 기록</Text>
        {rows.length === 0 ? <Text style={styles.empty}>아직 기록이 없어요.</Text> : null}
        {rows.map((row) => {
          const d = new Date(row.scheduled_for);
          const time = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ` +
            `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
          const visual = STATUS_VISUAL[row.status];
          const Icon = visual.Icon;
          return (
            <View key={row.id} style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.rowIcon, { backgroundColor: visual.bg }]}>
                  <Icon size={22} color={visual.fg} />
                </View>
                <View>
                  <Text style={styles.name}>{row.medicine_name}</Text>
                  <Text style={styles.meta}>{time} · {row.response_method ?? "-"}</Text>
                </View>
              </View>
              <StatusBadge status={row.status} />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7FAFF" },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  summaryCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md,
  },
  summaryTextWrap: { flexShrink: 1 },
  summaryTitle: { fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.text },
  summarySub: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: 4 },
  summaryIconCircle: {
    marginLeft: "auto", width: 40, height: 40, borderRadius: radii.pill,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.lightBlueBg,
  },
  sectionTitle: { fontSize: fontSizes.body, fontWeight: "700", color: colors.text },
  empty: { fontSize: fontSizes.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 },
  rowIcon: {
    width: 48, height: 48, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  name: { fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.text },
  meta: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: 4 },
});

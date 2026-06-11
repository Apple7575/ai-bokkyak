import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radii } from "../theme/tokens";
import type { IntakeStatus } from "../lib/supabase";

const MAP: Record<IntakeStatus, { bg: string; label: string }> = {
  복용완료: { bg: colors.successGreen, label: "복용 완료" },
  복용예정: { bg: colors.secondaryBlue, label: "복용 예정" },
  미복용: { bg: colors.dangerRed, label: "미복용" },
  재알림: { bg: colors.warningOrange, label: "재알림" },
};
export function StatusBadge({ status }: { status: IntakeStatus }) {
  const s = MAP[status];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={styles.text}>{s.label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, alignSelf: "flex-start" },
  text: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { CheckCircle2, Clock, AlertCircle, RotateCcw } from "lucide-react-native";
import { colors, radii, spacing, fontSizes } from "../theme/tokens";
import type { IntakeStatus } from "../lib/supabase";

type IconType = React.ComponentType<{ size?: number; color?: string }>;

const MAP: Record<IntakeStatus, { fg: string; bg: string; label: string; Icon: IconType }> = {
  복용완료: { fg: colors.successGreen, bg: "#E6F9F1", label: "복용 완료", Icon: CheckCircle2 },
  복용예정: { fg: colors.secondaryBlue, bg: colors.lightBlueBg, label: "복용 예정", Icon: Clock },
  미복용: { fg: colors.dangerRed, bg: "#FFF0F0", label: "미복용", Icon: AlertCircle },
  재알림: { fg: colors.warningOrange, bg: "#FFF8ED", label: "재알림", Icon: RotateCcw },
};

export function StatusBadge({ status }: { status: IntakeStatus }) {
  const { fg, bg, label, Icon } = MAP[status];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Icon size={15} color={fg} />
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    alignSelf: "flex-start",
  },
  text: { fontSize: fontSizes.body, fontWeight: "700" },
});

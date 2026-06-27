import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { CheckCircle2, Clock, AlertCircle, MinusCircle } from "lucide-react-native";
import { colors, radii, spacing, fontSizes } from "../theme/tokens";
import type { DisplayStatus } from "../lib/intakeStatus";
import { statusLabel } from "../lib/intakeStatus";

type IconType = React.ComponentType<{ size?: number; color?: string }>;

const MAP: Record<DisplayStatus, { fg: string; bg: string; Icon: IconType }> = {
  completed: { fg: colors.successGreen, bg: "#E6F9F1", Icon: CheckCircle2 },
  snoozed: { fg: colors.warningOrange, bg: "#FFF8ED", Icon: Clock },
  skipped: { fg: colors.dangerRed, bg: "#FFF0F0", Icon: AlertCircle },
  missed: { fg: colors.dangerRed, bg: "#FFF0F0", Icon: AlertCircle },
  no_schedule: { fg: colors.textSecondary, bg: colors.lightBlueBg, Icon: MinusCircle },
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const { fg, bg, Icon } = MAP[status];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Icon size={15} color={fg} />
      <Text style={[styles.text, { color: fg }]}>{statusLabel(status)}</Text>
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

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fontSizes, radii, spacing, shadows } from "../theme/tokens";
import { StatusBadge } from "./StatusBadge";
import { MedicineMark } from "./MedicineMark";
import type { IntakeStatus } from "../lib/supabase";

type Props = { name: string; time: string; status?: IntakeStatus };
export function ScheduleCard({ name, time, status }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <MedicineMark name={name} size={52} />
        <View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.time}>{time}</Text>
        </View>
      </View>
      {status ? <StatusBadge status={status} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderWidth: 1.5,
    borderRadius: radii.card,
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 6,
    ...shadows.card,
  },
  left: { flexDirection: "row", alignItems: "center", gap: spacing.md, flexShrink: 1 },
  name: { fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.text },
  time: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: 4 },
});

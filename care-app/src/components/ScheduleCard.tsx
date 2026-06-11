import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fontSizes, radii } from "../theme/tokens";
import { StatusBadge } from "./StatusBadge";
import type { IntakeStatus } from "../lib/supabase";

type Props = { name: string; time: string; status?: IntakeStatus };
export function ScheduleCard({ name, time, status }: Props) {
  return (
    <View style={styles.card}>
      <View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.time}>{time}</Text>
      </View>
      {status ? <StatusBadge status={status} /> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: 16, flexDirection: "row",
    justifyContent: "space-between", alignItems: "center", marginVertical: 6 },
  name: { fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.text },
  time: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: 4 },
});

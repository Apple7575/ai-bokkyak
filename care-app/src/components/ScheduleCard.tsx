import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Sun, Cloud, Sunset, Moon, Pill } from "lucide-react-native";
import { colors, fontSizes, radii, spacing } from "../theme/tokens";
import { StatusBadge } from "./StatusBadge";
import type { IntakeStatus } from "../lib/supabase";

type IconType = React.ComponentType<{ size?: number; color?: string }>;

function pickIcon(name: string): IconType {
  if (name.includes("아침")) return Sun;
  if (name.includes("점심")) return Cloud;
  if (name.includes("저녁")) return Sunset;
  if (name.includes("취침") || name.includes("자기") || name.includes("밤")) return Moon;
  return Pill;
}

type Props = { name: string; time: string; status?: IntakeStatus };
export function ScheduleCard({ name, time, status }: Props) {
  const Icon = pickIcon(name);
  const done = status === "completed";
  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <View style={[styles.iconBox, { backgroundColor: done ? "#E6F9F1" : colors.lightBlueBg }]}>
          <Icon size={22} color={done ? colors.successGreen : colors.primaryBlue} />
        </View>
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
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 6,
    shadowColor: colors.primaryNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  left: { flexDirection: "row", alignItems: "center", gap: spacing.md, flexShrink: 1 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radii.button,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.text },
  time: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: 4 },
});

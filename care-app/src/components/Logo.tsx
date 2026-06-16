import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pill } from "lucide-react-native";
import { colors, fontSizes } from "../theme/tokens";

export function Logo({ size = 64, showWordmark = true }: { size?: number; showWordmark?: boolean }) {
  return (
    <View style={styles.row}>
      <View style={[styles.badge, { width: size, height: size, borderRadius: size / 4 }]}>
        <Pill size={size * 0.5} color="#fff" />
      </View>
      {showWordmark ? <Text style={styles.wordmark}>모두의 복약</Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  badge: { backgroundColor: colors.primaryBlue, alignItems: "center", justifyContent: "center" },
  wordmark: { fontSize: fontSizes.title, fontWeight: "800", color: colors.primaryNavy },
});

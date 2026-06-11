import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { colors, radii } from "../theme/tokens";

type Props = { label: string; selected: boolean; onPress: () => void };
export function TimeChip({ label, selected, onPress }: Props) {
  return (
    <Pressable onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? colors.primaryBlue : colors.cardBg,
        borderColor: selected ? colors.primaryBlue : colors.border }]}>
      <Text style={[styles.text, { color: selected ? "#fff" : colors.text }]}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  chip: { minHeight: 52, minWidth: 72, borderRadius: radii.button, borderWidth: 1,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 16, margin: 6 },
  text: { fontSize: 18, fontWeight: "700" },
});

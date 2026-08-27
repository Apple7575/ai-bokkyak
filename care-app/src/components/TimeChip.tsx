import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { colors, radii, minTouch, shadows } from "../theme/tokens";

type Props = { label: string; selected: boolean; onPress: () => void };
export function TimeChip({ label, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primaryBlue : colors.surfaceRaised,
          borderColor: selected ? colors.primaryBlue : colors.border,
        },
        pressed && { opacity: 0.9 },
      ]}
    >
      <Text style={[styles.text, { color: selected ? colors.white : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: minTouch,
    minWidth: 72,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    margin: 6,
    ...shadows.card,
  },
  text: { fontSize: 19, fontWeight: "800" },
});

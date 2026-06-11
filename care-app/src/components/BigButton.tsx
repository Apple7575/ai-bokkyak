import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { colors, fontSizes, radii, minTouch } from "../theme/tokens";

type Props = { label: string; onPress: () => void; variant?: "primary" | "secondary" };
export function BigButton({ label, onPress, variant = "primary" }: Props) {
  const primary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      style={[styles.base, { backgroundColor: primary ? colors.primaryBlue : colors.cardBg,
        borderColor: colors.border, borderWidth: primary ? 0 : 1 }]}
    >
      <Text style={[styles.label, { color: primary ? "#fff" : colors.primaryBlue }]}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  base: { minHeight: minTouch, borderRadius: radii.button, alignItems: "center",
    justifyContent: "center", paddingHorizontal: 16, marginVertical: 6 },
  label: { fontSize: fontSizes.emphasis, fontWeight: "700" },
});

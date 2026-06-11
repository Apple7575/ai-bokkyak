import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { colors, fontSizes, radii, minTouch } from "../theme/tokens";

type Props = { label: string; onPress: () => void; variant?: "primary" | "secondary" };
export function BigButton({ label, onPress, variant = "primary" }: Props) {
  const primary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        pressed && { opacity: 0.9 },
      ]}
    >
      <Text style={[styles.label, { color: primary ? "#fff" : colors.primaryBlue }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouch,
    borderRadius: radii.button,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginVertical: 6,
  },
  primary: {
    backgroundColor: colors.primaryBlue,
    shadowColor: colors.primaryBlue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 4,
  },
  secondary: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderWidth: 1,
    shadowColor: colors.primaryNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  label: { fontSize: fontSizes.emphasis, fontWeight: "700" },
});

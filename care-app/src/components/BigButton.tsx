import React from "react";
import { Pressable, Text, StyleSheet, View } from "react-native";
import { ArrowRight } from "lucide-react-native";
import { colors, fontSizes, radii, minTouch, shadows } from "../theme/tokens";

type Props = { label: string; onPress: () => void; variant?: "primary" | "secondary"; disabled?: boolean; showArrow?: boolean };
export function BigButton({ label, onPress, variant = "primary", disabled = false, showArrow = false }: Props) {
  const primary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.content}>
        <Text style={[styles.label, { color: primary ? colors.white : colors.primaryNavy }]}>{label}</Text>
        {showArrow ? <ArrowRight size={23} strokeWidth={2.5} color={primary ? colors.white : colors.primaryNavy} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouch,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginVertical: 6,
  },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  primary: {
    backgroundColor: colors.primaryBlue,
    ...shadows.floating,
  },
  secondary: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderWidth: 1.5,
    ...shadows.card,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.45 },
  label: { fontSize: fontSizes.emphasis, fontWeight: "800", letterSpacing: -0.4 },
});

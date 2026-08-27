import React from "react";
import { StyleSheet, View } from "react-native";
import { CareMedicineGlyph } from "./CareIcons";
import { medicineIdentity } from "../lib/medicineIdentity";
import { colors, radii } from "../theme/tokens";

const PALETTES = [
  { color: colors.primaryBlue, bg: colors.primarySoft },
  { color: colors.coral, bg: colors.coralSoft },
  { color: colors.successGreen, bg: colors.successSoft },
  { color: colors.warningOrange, bg: colors.warningSoft },
  { color: colors.conditionPurple, bg: colors.lightBlueBg },
  { color: colors.secondaryBlue, bg: colors.sageSoft },
] as const;

export function MedicineMark({ name, size = 52 }: { name: string; size?: number }) {
  const identity = medicineIdentity(name);
  const palette = PALETTES[identity.paletteIndex];
  return (
    <View
      // 장식용 표식 — 옆에 약 이름이 이미 있어 스크린리더가 두 번 읽지 않게 숨긴다
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.box, { width: size, height: size, borderRadius: Math.min(radii.button, size * 0.34), backgroundColor: palette.bg }]}
    >
      <CareMedicineGlyph shape={identity.shape} size={size * 0.68} color={palette.color} accent={palette.bg} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center", flexShrink: 0 },
});

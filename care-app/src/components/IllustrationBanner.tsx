import React from "react";
import { Image, ImageSourcePropType, StyleSheet, View } from "react-native";
import { colors, radii, shadows, spacing } from "../theme/tokens";

type Props = {
  source: ImageSourcePropType;
  height?: number;
  tone?: "coral" | "sage" | "cream";
  imageScale?: number;
};

export function IllustrationBanner({ source, height = 112, tone = "cream", imageScale = 1 }: Props) {
  const backgroundColor = tone === "coral"
    ? colors.coralSoft
    : tone === "sage"
      ? colors.sageSoft
      : colors.cardBg;

  return (
    <View style={[styles.card, { height: Math.min(height, 124), backgroundColor }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.glow} />
      <Image
        source={source}
        resizeMode="contain"
        style={[styles.image, { transform: [{ scale: imageScale }] }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: radii.card,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  glow: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    right: -55,
    top: -80,
    backgroundColor: colors.primarySoft,
  },
  image: { width: "82%", height: "108%" },
});

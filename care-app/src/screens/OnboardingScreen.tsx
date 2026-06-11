import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, fontSizes } from "../theme/tokens";
const CARDS = [
  "약 먹을 시간이 되면 음성으로 알려드려요",
  "\"먹었어요\"라고 말하면 자동으로 기록돼요",
  "보호자도 복약 여부를 함께 확인할 수 있어요",
];
export function OnboardingScreen() {
  return (
    <View style={{ flex: 1, padding: spacing.lg, justifyContent: "center" }}>
      {CARDS.map((c, i) => (
        <View key={i} style={{ backgroundColor: colors.lightBlueBg, borderRadius: 16, padding: spacing.lg, marginVertical: 8 }}>
          <Text style={{ fontSize: fontSizes.emphasis, color: colors.text }}>{c}</Text>
        </View>
      ))}
    </View>
  );
}

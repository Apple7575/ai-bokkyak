import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Mic, CheckCircle, Users } from "lucide-react-native";
import { colors, spacing, fontSizes, radii } from "../theme/tokens";

type IconType = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const CARDS: { text: string; Icon: IconType; color: string; bg: string }[] = [
  { text: "약 먹을 시간이 되면 음성으로 알려드려요", Icon: Mic, color: colors.primaryBlue, bg: colors.lightBlueBg },
  { text: "\"먹었어요\"라고 말하면 자동으로 기록돼요", Icon: CheckCircle, color: colors.successGreen, bg: "#E6F9F1" },
  { text: "보호자도 복약 여부를 함께 확인할 수 있어요", Icon: Users, color: colors.conditionPurple, bg: "#F3EEFF" },
];

export function OnboardingScreen() {
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      {CARDS.map(({ text, Icon, color, bg }, i) => (
        <View key={i} style={s.card}>
          <View style={[s.iconCircle, { backgroundColor: bg }]}>
            <Icon size={36} color={color} strokeWidth={1.6} />
          </View>
          <Text style={s.cardText}>{text}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  content: { padding: spacing.lg, justifyContent: "center", flexGrow: 1, gap: spacing.md },
  card: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.md,
    shadowColor: colors.primaryNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.text, textAlign: "center", lineHeight: 32 },
});

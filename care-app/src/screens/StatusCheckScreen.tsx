import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Smile, Meh, Frown } from "lucide-react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { colors, fontSizes, spacing, radii, minTouch } from "../theme/tokens";

export function StatusCheckScreen() {
  const nav = useNavigation<any>();
  const options = [
    { label: "좋음", Icon: Smile, color: colors.successGreen },
    { label: "보통", Icon: Meh, color: colors.warningOrange },
    { label: "나쁨", Icon: Frown, color: colors.dangerRed },
  ] as const;
  return (
    <View style={styles.screen}>
      <ScreenHeader title="상태 확인" showBack={false} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.q}>오늘 컨디션은 어떤가요?</Text>
        <View style={styles.options}>
          {options.map(({ label, Icon, color }) => (
            <Pressable
              key={label}
              onPress={() => nav.navigate("Tabs")}
              style={({ pressed }) => [styles.card, { borderColor: color }, pressed && { opacity: 0.9 }]}
            >
              <View style={[styles.iconWrap, { backgroundColor: color + "1A" }]}>
                <Icon size={36} color={color} strokeWidth={1.8} />
              </View>
              <Text style={[styles.label, { color }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cardBg },
  scroll: { flexGrow: 1, padding: spacing.lg, justifyContent: "center" },
  q: { fontSize: fontSizes.title, fontWeight: "800", color: colors.text, textAlign: "center", marginBottom: spacing.xl },
  options: { flexDirection: "row", gap: spacing.md },
  card: {
    flex: 1,
    minHeight: minTouch + 56,
    borderRadius: radii.card,
    borderWidth: 2,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: "center", justifyContent: "center",
  },
  label: { fontSize: fontSizes.emphasis, fontWeight: "700" },
});

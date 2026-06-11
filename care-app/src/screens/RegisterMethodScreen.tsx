import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Mic, ListChecks, Camera, ChevronRight } from "lucide-react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { colors, fontSizes, spacing, radii } from "../theme/tokens";

export function RegisterMethodScreen() {
  const nav = useNavigation<any>();
  return (
    <View style={styles.screen}>
      <ScreenHeader title="약 등록" />
      <View style={styles.header}>
        <Text style={styles.title}>어떻게 약을 등록할까요?</Text>
        <Text style={styles.subtitle}>원하는 방법을 선택해 주세요.</Text>
      </View>

      <View style={styles.body}>
        {/* 음성 - primary */}
        <Pressable
          onPress={() => nav.navigate("VoiceRegister")}
          style={({ pressed }) => [styles.card, styles.cardPrimary, pressed && { opacity: 0.92 }]}
        >
          <View style={[styles.iconBox, styles.iconBoxPrimary]}>
            <Mic size={28} color="#fff" />
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, { color: "#fff" }]}>음성으로 간편 등록</Text>
            <Text style={[styles.cardDesc, { color: "rgba(255,255,255,0.85)" }]}>말씀해 주시면 자동으로 입력해 드려요</Text>
          </View>
          <ChevronRight size={20} color="#fff" />
        </Pressable>

        {/* 버튼 - secondary */}
        <Pressable
          onPress={() => nav.navigate("ButtonRegister")}
          style={({ pressed }) => [styles.card, styles.cardSecondary, pressed && { opacity: 0.92 }]}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.lightBlueBg }]}>
            <ListChecks size={28} color={colors.primaryBlue} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>버튼으로 직접 등록</Text>
            <Text style={styles.cardDesc}>항목을 하나씩 눌러 등록할 수 있어요</Text>
          </View>
          <ChevronRight size={20} color={colors.textSecondary} />
        </Pressable>

        {/* 사진 - 준비 중 (비활성) */}
        <View style={[styles.card, styles.cardSecondary, styles.cardDisabled]}>
          <View style={[styles.iconBox, { backgroundColor: "#F7FAFF" }]}>
            <Camera size={28} color={colors.textSecondary} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>사진으로 등록</Text>
            <Text style={styles.cardDesc}>약 봉투나 약 포장을 촬영해 주세요</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>준비 중</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cardBg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { fontSize: fontSizes.title, fontWeight: "700", color: colors.text, lineHeight: 32 },
  subtitle: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: spacing.xs },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
  card: {
    width: "100%",
    borderRadius: radii.card,
    padding: spacing.lg - spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  cardPrimary: {
    backgroundColor: colors.primaryBlue,
    shadowColor: colors.primaryBlue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 4,
  },
  cardSecondary: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardDisabled: { opacity: 0.7 },
  iconBox: { width: 56, height: 56, borderRadius: radii.card, alignItems: "center", justifyContent: "center" },
  iconBoxPrimary: { backgroundColor: "rgba(255,255,255,0.2)" },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  cardDesc: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: 3 },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: "#F3EEFF",
  },
  badgeText: { fontSize: 14, fontWeight: "600", color: colors.conditionPurple },
});

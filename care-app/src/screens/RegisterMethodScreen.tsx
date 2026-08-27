import React from "react";
import { Image, View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ListChecks, Camera, Search, ChevronRight } from "lucide-react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { colors, fontSizes, spacing, radii, shadows } from "../theme/tokens";

const REGISTER_ART = require("../../assets/illustrations/medicine-search.png");

export function RegisterMethodScreen() {
  const nav = useNavigation<any>();
  return (
    <View style={styles.screen}>
      <ScreenHeader title="약 등록" />
      {/* 작은 폰·큰 글씨에서도 세 번째 선택지까지 닿도록 스크롤 가능하게 */}
      <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <View style={styles.introCard}>
          <View style={styles.introCopy}>
            <Text style={styles.title}>어떻게 약을{`\n`}등록할까요?</Text>
            <Text style={styles.subtitle}>원하는 방법을 선택해 주세요.</Text>
          </View>
          <Image source={REGISTER_ART} style={styles.art} resizeMode="contain" />
        </View>
      </View>

      <View style={styles.body}>
        {/* 이름으로 찾기 (C-07) — 공공데이터에서 정확한 제품을 고른다.
            정확한 제품명이 남아야 성분 기반 병용금기 검사가 실제로 걸린다.
            음성 등록을 걷어내면서(회의 결정 2026-08-20) 이게 첫 번째 방법이 됐다. */}
        <Pressable
          onPress={() => nav.navigate("MedicineSearch")}
          style={({ pressed }) => [styles.card, styles.cardPrimary, pressed && { opacity: 0.92 }]}
        >
          <View style={[styles.iconBox, styles.iconBoxPrimary]}>
            <Search size={28} color="#fff" />
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, { color: "#fff" }]}>약 이름으로 찾기</Text>
            <Text style={[styles.cardDesc, { color: "rgba(255,255,255,0.85)" }]}>이름을 입력하면 목록에서 골라요</Text>
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

        {/* 사진(OCR) — 알파 테스트 범위에 포함 (C-05 확정) */}
        <Pressable
          onPress={() => nav.navigate("OcrRegister")}
          style={({ pressed }) => [styles.card, styles.cardSecondary, pressed && { opacity: 0.92 }]}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.canvas }]}>
            <Camera size={28} color={colors.primaryBlue} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>사진으로 등록</Text>
            <Text style={styles.cardDesc}>약 봉투나 약 포장을 촬영해 주세요</Text>
          </View>
          <ChevronRight size={20} color={colors.textSecondary} />
        </Pressable>
      </View>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  scroll: { paddingBottom: spacing.xl },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  introCard: { minHeight: 142, padding: spacing.md, borderRadius: radii.card, backgroundColor: colors.coralSoft, overflow: "hidden", justifyContent: "center", ...shadows.card },
  introCopy: { width: "62%", zIndex: 1 },
  title: { fontSize: 28, fontWeight: "800", color: colors.primaryNavy, lineHeight: 36, letterSpacing: -0.7 },
  subtitle: { fontSize: fontSizes.body, lineHeight: 26, color: colors.textSecondary, marginTop: spacing.xs },
  art: { position: "absolute", width: 180, height: 132, right: -22, bottom: -3 },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  card: {
    width: "100%",
    minHeight: 112,
    borderRadius: radii.card,
    padding: spacing.lg - spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  cardPrimary: {
    backgroundColor: colors.primaryBlue,
    ...shadows.floating,
  },
  cardSecondary: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardDisabled: { opacity: 0.7 },
  iconBox: { width: 60, height: 60, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  iconBoxPrimary: { backgroundColor: "rgba(255,255,255,0.2)" },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  cardDesc: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: 3 },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.sageSoft,
  },
  badgeText: { fontSize: 14, fontWeight: "600", color: colors.conditionPurple },
});

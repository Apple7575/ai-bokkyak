import React, { useEffect, useRef } from "react";
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight, HeartPulse } from "lucide-react-native";
import { cardSizes } from "../lib/splashLayout";
import { colors, fontSizes, radii, shadows, spacing } from "../theme/tokens";

const SENIORS_ART = require("../../assets/illustrations/onboarding-seniors.png");

export function SplashScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { card } = cardSizes(width);
  const intro = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.spring(intro, { toValue: 1, friction: 8, tension: 45, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [intro]);

  // 시작하기 → 기능 소개(Onboarding). 온보딩 완료 표시는 Onboarding 화면이 한다.
  function start() {
    nav.reset({ index: 0, routes: [{ name: "Onboarding" }] });
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />

      {/* 짧은 폰(iPhone SE)·큰 글씨에서 본문이 시작 버튼과 겹치지 않게 본문만 스크롤 */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Animated.View style={[styles.content, { opacity: intro, transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>
        <View style={styles.eyebrow}>
          <HeartPulse size={18} color={colors.primaryBlue} />
          <Text style={styles.eyebrowText}>매일 곁에 있는 복약 도우미</Text>
        </View>

        <Text style={styles.title}>약 먹는 시간,{"\n"}<Text style={styles.titleAccent}>이제 걱정하지 마세요</Text></Text>
        <Text style={styles.subtitle}>큰 글씨와 친절한 음성으로 복약 시간을 놓치지 않도록 도와드려요.</Text>

        <View style={[styles.logoStage, { width: card, height: card }]}>
          <View style={styles.ringOuter} />
          <Image source={SENIORS_ART} style={styles.heroArt} resizeMode="contain" />
        </View>
      </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable accessibilityRole="button" accessibilityLabel="시작하기" onPress={() => void start()} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
          <Text style={styles.ctaText}>시작하기</Text>
          <View style={styles.arrow}><ArrowRight size={23} strokeWidth={2.7} color={colors.primaryNavy} /></View>
        </Pressable>
        <Text style={styles.note}>설정은 언제든 다시 바꿀 수 있어요</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: spacing.lg, overflow: "hidden" },
  blobTop: { position: "absolute", width: 280, height: 280, borderRadius: 140, backgroundColor: colors.primarySoft, top: -130, right: -100 },
  blobBottom: { position: "absolute", width: 230, height: 230, borderRadius: 115, backgroundColor: colors.coralSoft, bottom: -120, left: -90 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingBottom: spacing.md },
  content: { alignItems: "center", justifyContent: "center" },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceRaised, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: 10, borderWidth: 1, borderColor: colors.border },
  eyebrowText: { fontSize: 16, fontWeight: "800", color: colors.primaryBlue },
  title: { marginTop: spacing.lg, fontSize: 34, lineHeight: 45, fontWeight: "800", color: colors.primaryNavy, textAlign: "center", letterSpacing: -1.1 },
  titleAccent: { color: colors.coral },
  subtitle: { marginTop: spacing.md, maxWidth: 340, fontSize: fontSizes.body, lineHeight: 29, color: colors.textSecondary, textAlign: "center" },
  logoStage: { maxWidth: 270, maxHeight: 270, marginTop: spacing.md, alignItems: "center", justifyContent: "center" },
  ringOuter: { position: "absolute", width: "94%", height: "82%", bottom: 0, borderRadius: radii.hero, backgroundColor: colors.primarySoft, transform: [{ rotate: "-3deg" }], ...shadows.card },
  heroArt: { width: "116%", height: "116%", marginTop: -10 },
  footer: { width: "100%" },
  cta: { minHeight: 68, borderRadius: radii.pill, paddingLeft: spacing.lg, paddingRight: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.primaryBlue, ...shadows.floating },
  ctaText: { color: colors.white, fontSize: fontSizes.emphasis, fontWeight: "800" },
  arrow: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.sunshineSoft, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  note: { marginTop: 12, color: colors.textSecondary, fontSize: 15, textAlign: "center" },
});

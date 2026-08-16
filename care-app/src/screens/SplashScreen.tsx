import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Pressable, Image, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { setOnboarded } from "../lib/storage";
import { cardSizes } from "../lib/splashLayout";
import { colors, spacing, radii, minTouch } from "../theme/tokens";

// 앱 첫 화면 (A-01). 디자인 시안 "0 스플래시"를 따른다.
//
// 네이티브 스플래시(app.json의 splash)와 별개다. 네이티브는 JS가 뜨기 전까지
// OS가 그리는 정지 화면이고, 이 화면은 그 뒤에 나타나 [시작하기]를 받는 진짜 화면이다.
// 둘 다 같은 로고를 쓰므로 로고 → 로고 → 문구 순으로 자연스럽게 이어진다.
//
// 문구·순서·타이밍은 시안 그대로:
//   태그라인(0.15s) → 로고 카드(0.95s, 팝) → 시작하기 버튼(1.75s)

const LOGO = require("../../assets/logo.png");

export function SplashScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { card, cardPad, logoSize } = cardSizes(screenWidth);

  // 시안의 omIn / omPop 애니메이션. 순차 등장이라 어르신이 눈으로 따라가기 쉽다.
  const tagline = useRef(new Animated.Value(0)).current;
  const logo = useRef(new Animated.Value(0)).current;
  const cta = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const seq = Animated.stagger(0, [
      Animated.timing(tagline, { toValue: 1, duration: 700, delay: 150, useNativeDriver: true }),
      Animated.spring(logo, { toValue: 1, delay: 100, friction: 6, tension: 60, useNativeDriver: true }),
      Animated.timing(cta, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }),
    ]);
    seq.start();
    return () => seq.stop();
  }, [tagline, logo, cta]);

  async function start(): Promise<void> {
    await setOnboarded(); // 다시 보지 않게 표시
    nav.reset({ index: 0, routes: [{ name: "RoleSelect" }] });
  }

  const rise = (v: Animated.Value) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  });

  return (
    <View style={[s.screen, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={s.spacer} />

      <Animated.Text style={[s.tagline, rise(tagline)]}>
        건강한 복용을 위한 복용 관리 플랫폼
      </Animated.Text>

      <Animated.View
        style={[
          s.logoCard,
          { width: card, height: card, padding: cardPad },
          {
            opacity: logo,
            transform: [{
              scale: logo.interpolate({
                inputRange: [0, 1], outputRange: [0.4, 1],
                // 스프링이 1을 넘겨도 카드가 커지지 않게 막는다.
                extrapolateRight: "clamp",
              }),
            }],
          },
        ]}
      >
        <Image source={LOGO} style={{ width: logoSize, height: logoSize }} resizeMode="contain" />
      </Animated.View>

      <View style={[s.spacer, { flex: 1.3 }]} />

      <Animated.View style={[{ width: "100%" }, rise(cta)]}>
        <Pressable
          onPress={() => { void start(); }}
          style={({ pressed }) => [s.cta, pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] }]}
        >
          <Text style={s.ctaText}>시작하기</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1, backgroundColor: "#F4F7FB",
    alignItems: "center", paddingHorizontal: 26,
  },
  spacer: { flex: 1, minHeight: 16 },
  tagline: {
    fontSize: 17, fontWeight: "600", letterSpacing: 0.4,
    color: "#5B6B82", textAlign: "center",
  },
  // 크기(width/height/padding)는 화면 폭에 맞춰 계산해 인라인으로 준다.
  logoCard: {
    backgroundColor: colors.cardBg, borderRadius: 40, marginTop: 28,
    shadowColor: "#172B4D", shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.14, shadowRadius: 54, elevation: 8,
  },
  cta: {
    width: "100%", minHeight: 60, borderRadius: 30,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.primaryBlue,
    shadowColor: colors.primaryBlue, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 24, elevation: 6,
  },
  ctaText: { fontSize: 21, fontWeight: "800", color: "#fff", letterSpacing: -0.3 },
  _touch: { minHeight: minTouch, borderRadius: radii.button },
});

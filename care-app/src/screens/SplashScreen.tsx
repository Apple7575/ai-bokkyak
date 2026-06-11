import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Pill } from "lucide-react-native";
import { colors, fontSizes, spacing } from "../theme/tokens";

export function SplashScreen() {
  const dots = [useRef(new Animated.Value(0.4)).current, useRef(new Animated.Value(0.4)).current, useRef(new Animated.Value(0.4)).current];
  useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(v, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.4, duration: 500, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  return (
    <View style={s.c}>
      <View style={s.center}>
        <View style={s.logo}>
          <Pill size={48} color={colors.primaryBlue} strokeWidth={1.8} />
        </View>
        <View style={s.textWrap}>
          <Text style={s.title}>케어</Text>
          <Text style={s.sub}>말로 쉽게 기록하는 복약 관리</Text>
        </View>
      </View>
      <View style={s.dots}>
        {dots.map((v, i) => (
          <Animated.View
            key={i}
            style={[
              s.dot,
              { opacity: v, backgroundColor: i === 1 ? colors.primaryBlue : colors.border },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  center: { alignItems: "center", gap: spacing.lg, marginBottom: 64 },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: colors.lightBlueBg,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: { alignItems: "center", gap: spacing.sm },
  title: { fontSize: 32, fontWeight: "800", color: colors.primaryNavy },
  sub: { fontSize: fontSizes.body, color: colors.textSecondary, textAlign: "center" },
  dots: { flexDirection: "row", gap: spacing.sm },
  dot: { width: 9, height: 9, borderRadius: 999 },
});

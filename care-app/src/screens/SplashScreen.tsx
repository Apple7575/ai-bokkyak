import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { colors, fontSizes, spacing } from "../theme/tokens";
import { Logo } from "../components/Logo";

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
        <Logo size={88} />
        <View style={s.textWrap}>
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
  textWrap: { alignItems: "center", gap: spacing.sm },
  sub: { fontSize: fontSizes.body, color: colors.textSecondary, textAlign: "center" },
  dots: { flexDirection: "row", gap: spacing.sm },
  dot: { width: 9, height: 9, borderRadius: 999 },
});

import React, { useEffect, useRef } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, Vibration, View } from "react-native";
import { CareCheckIcon } from "./CareIcons";
import { colors, fontSizes, minTouch, radii, shadows, spacing } from "../theme/tokens";

const DISPLAY_MS = 5000;

export function CompletionFeedback({
  visible,
  medicineName,
  onUndo,
  onDone,
}: {
  visible: boolean;
  medicineName: string;
  onUndo: () => void;
  onDone: () => void;
}) {
  const scale = useRef(new Animated.Value(0.65)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(1)).current;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!visible) {
      // 되돌리기로 일찍 닫힌 경우 5초짜리 JS 애니메이션이 남지 않게 정리
      progress.stopAnimation();
      return;
    }
    scale.setValue(0.65);
    opacity.setValue(0);
    progress.setValue(1);
    Vibration.vibrate(70);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(progress, { toValue: 0, duration: DISPLAY_MS, useNativeDriver: false }),
    ]).start();
    const timer = setTimeout(() => onDoneRef.current(), DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [visible, opacity, progress, scale]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onDone}>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <View style={styles.sparkOne} />
          <View style={styles.sparkTwo} />
          <View style={styles.iconWrap}>
            <CareCheckIcon size={82} color={colors.successGreen} accent={colors.white} />
          </View>
          <Text style={styles.eyebrow}>오늘의 복약 완료</Text>
          <Text style={styles.title}>잘하셨어요!</Text>
          <Text style={styles.description}>{medicineName}{`\n`}복용 기록을 남겼어요.</Text>

          <View style={styles.progressTrack}>
            <Animated.View
              style={[styles.progressFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]}
            />
          </View>

          <Pressable onPress={onDone} style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}>
            <Text style={styles.doneButtonText}>확인</Text>
          </Pressable>
          <Pressable onPress={onUndo} style={({ pressed }) => [styles.undoButton, pressed && styles.pressed]}>
            <Text style={styles.undoText}>잘못 눌렀어요 · 되돌리기</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: colors.overlayStrong, padding: spacing.lg,
    alignItems: "center", justifyContent: "center",
  },
  card: {
    width: "100%", maxWidth: 390, alignItems: "center", overflow: "hidden",
    backgroundColor: colors.surfaceRaised, borderRadius: radii.hero, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border, ...shadows.floating,
  },
  sparkOne: { position: "absolute", width: 18, height: 18, borderRadius: 9, backgroundColor: colors.coral, top: 30, left: 42 },
  sparkTwo: { position: "absolute", width: 12, height: 12, borderRadius: 6, backgroundColor: colors.sunshine, top: 65, right: 48 },
  iconWrap: { width: 112, height: 112, borderRadius: 56, backgroundColor: colors.successSoft, alignItems: "center", justifyContent: "center" },
  eyebrow: { marginTop: spacing.md, fontSize: 17, fontWeight: "800", color: colors.successGreen },
  title: { marginTop: spacing.xs, fontSize: 34, fontWeight: "800", color: colors.primaryNavy },
  description: { marginTop: spacing.sm, fontSize: fontSizes.body, lineHeight: 28, textAlign: "center", color: colors.textSecondary },
  progressTrack: { width: "100%", height: 6, borderRadius: radii.pill, backgroundColor: colors.primarySoft, overflow: "hidden", marginTop: spacing.lg },
  progressFill: { height: "100%", backgroundColor: colors.successGreen, borderRadius: radii.pill },
  doneButton: { width: "100%", minHeight: minTouch, marginTop: spacing.md, borderRadius: radii.button, backgroundColor: colors.primaryBlue, alignItems: "center", justifyContent: "center" },
  doneButtonText: { fontSize: 21, fontWeight: "800", color: colors.white },
  undoButton: { minHeight: minTouch, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center" },
  undoText: { fontSize: 18, fontWeight: "700", color: colors.textSecondary, textDecorationLine: "underline" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});

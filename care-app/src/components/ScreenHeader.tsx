import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { colors, fontSizes, spacing } from "../theme/tokens";

export function ScreenHeader({ title, showBack = true }: { title: string; showBack?: boolean }) {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  // Hide back even when the stack could go back (e.g. post-recording screens that
  // must not let the user return to an already-handled alarm).
  const canGoBack = showBack && nav.canGoBack();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      {canGoBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="뒤로 가기" onPress={() => nav.goBack()} hitSlop={10} style={styles.back}>
          <ChevronLeft size={30} strokeWidth={2.5} color={colors.primaryNavy} />
        </Pressable>
      ) : (
        <View style={styles.side} />
      )}
      {/* 긴 제목(예: 「내 복용분석 결과 보기」)이 좁은 휴대폰에서 「…」로 잘리지 않게 글자를 조금 줄여 맞춘다 */}
      <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{title}</Text>
      <View style={styles.side} />
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.canvas, paddingHorizontal: spacing.md, paddingBottom: spacing.md,
  },
  back: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  side: { width: 48 },
  title: { flex: 1, textAlign: "center", fontSize: fontSizes.title, fontWeight: "800", color: colors.primaryNavy, letterSpacing: -0.5 },
});

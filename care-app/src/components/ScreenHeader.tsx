import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { colors, fontSizes } from "../theme/tokens";

export function ScreenHeader({ title, showBack = true }: { title: string; showBack?: boolean }) {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  // Hide back even when the stack could go back (e.g. post-recording screens that
  // must not let the user return to an already-handled alarm).
  const canGoBack = showBack && nav.canGoBack();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      {canGoBack ? (
        <Pressable onPress={() => nav.goBack()} hitSlop={10} style={styles.back}>
          <ChevronLeft size={28} color={colors.primaryNavy} />
        </Pressable>
      ) : (
        <View style={styles.side} />
      )}
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={styles.side} />
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.cardBg, paddingHorizontal: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  side: { width: 40 },
  title: { flex: 1, textAlign: "center", fontSize: fontSizes.title, fontWeight: "700", color: colors.primaryNavy },
});

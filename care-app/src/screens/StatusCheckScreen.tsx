import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { BigButton } from "../components/BigButton";
import { colors, fontSizes, spacing } from "../theme/tokens";

export function StatusCheckScreen() {
  const nav = useNavigation<any>();
  return (
    <View style={styles.c}>
      <Text style={styles.q}>오늘 컨디션은 어떤가요?</Text>
      <BigButton label="좋음" onPress={() => nav.navigate("Tabs")} />
      <BigButton label="보통" variant="secondary" onPress={() => nav.navigate("Tabs")} />
      <BigButton label="나쁨" variant="secondary" onPress={() => nav.navigate("Tabs")} />
    </View>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, padding: spacing.lg, justifyContent: "center" },
  q: { fontSize: fontSizes.title, fontWeight: "800", color: colors.text, textAlign: "center", marginBottom: spacing.lg },
});

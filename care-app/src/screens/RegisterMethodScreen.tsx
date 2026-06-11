import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { BigButton } from "../components/BigButton";
import { colors, fontSizes, spacing } from "../theme/tokens";

export function RegisterMethodScreen() {
  const nav = useNavigation<any>();
  return (
    <View style={styles.c}>
      <Text style={styles.title}>어떻게 약을 등록할까요?</Text>
      <BigButton label="🎙 음성으로 간편 등록" onPress={() => nav.navigate("VoiceRegister")} />
      <BigButton label="✏️ 버튼으로 직접 등록" variant="secondary" onPress={() => nav.navigate("ButtonRegister")} />
      <View style={styles.disabled}><Text style={styles.disabledText}>📷 사진으로 등록  ·  준비 중</Text></View>
    </View>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, padding: spacing.lg, justifyContent: "center" },
  title: { fontSize: fontSizes.title, fontWeight: "800", color: colors.text, marginBottom: spacing.lg, textAlign: "center" },
  disabled: { minHeight: 56, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", marginVertical: 6 },
  disabledText: { fontSize: fontSizes.body, color: colors.textSecondary, fontWeight: "700" },
});

import React from "react";
import { View, Text } from "react-native";
import { BigButton } from "../components/BigButton";
import { clearAll } from "../lib/storage";
import { useNavigation } from "@react-navigation/native";
import { colors, fontSizes, spacing } from "../theme/tokens";
export function SettingsScreen() {
  const nav = useNavigation<any>();
  return (
    <View style={{ flex: 1, padding: spacing.lg, justifyContent: "center" }}>
      <Text style={{ fontSize: fontSizes.title, fontWeight: "800", color: colors.text, marginBottom: spacing.lg }}>더보기</Text>
      <BigButton label="로그아웃 / 역할 다시 선택" variant="secondary"
        onPress={async () => { await clearAll(); nav.reset({ index: 0, routes: [{ name: "RoleSelect" }] }); }} />
    </View>
  );
}

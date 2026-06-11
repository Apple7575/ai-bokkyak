import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Users, Volume2, Mic2, Type, Shield, LogOut, ChevronRight } from "lucide-react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { clearAll } from "../lib/storage";
import { colors, fontSizes, radii, spacing } from "../theme/tokens";

type IconType = React.ComponentType<{ size?: number; color?: string }>;
type MenuItem = { Icon: IconType; label: string; color: string; sub?: string };

const menuItems: MenuItem[] = [
  { Icon: Users, label: "보호자 연결 관리", color: colors.conditionPurple },
  { Icon: Volume2, label: "알림 소리 설정", color: colors.primaryBlue },
  { Icon: Mic2, label: "음성 안내 속도", color: colors.primaryBlue, sub: "기본값: 느리게" },
  { Icon: Type, label: "큰 글씨 모드", color: colors.primaryBlue },
  { Icon: Shield, label: "개인정보 설정", color: colors.textSecondary },
];

export function SettingsScreen() {
  const nav = useNavigation<any>();
  const onLogout = async () => {
    await clearAll();
    nav.reset({ index: 0, routes: [{ name: "RoleSelect" }] });
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="더보기" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* 시각용 메뉴 그룹 (무동작) */}
        <View style={styles.group}>
          {menuItems.map(({ Icon, label, color, sub }, i) => (
            <View key={label} style={[styles.rowItem, i < menuItems.length - 1 && styles.rowDivider]}>
              <View style={[styles.iconBox, { backgroundColor: color + "1A" }]}>
                <Icon size={20} color={color} />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowLabel}>{label}</Text>
                {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
              </View>
              <ChevronRight size={18} color={colors.textSecondary} />
            </View>
          ))}
        </View>

        {/* 로그아웃 / 역할 다시 선택 (실제 동작) */}
        <View style={styles.group}>
          <Pressable onPress={onLogout} style={({ pressed }) => [styles.rowItem, pressed && { opacity: 0.9 }]}>
            <View style={[styles.iconBox, { backgroundColor: colors.dangerRed + "1A" }]}>
              <LogOut size={20} color={colors.dangerRed} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.dangerRed, flex: 1 }]}>로그아웃 / 역할 다시 선택</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7FAFF" },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  group: {
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, overflow: "hidden",
  },
  rowItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 16 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowTextWrap: { flex: 1 },
  rowLabel: { fontSize: fontSizes.body, fontWeight: "600", color: colors.text },
  rowSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
});

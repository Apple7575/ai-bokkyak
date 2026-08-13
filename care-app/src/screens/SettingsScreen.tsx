import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Volume2, Mic2, Type, Shield, LogOut, ChevronRight } from "lucide-react-native";
import notifee from "@notifee/react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { clearAll } from "../lib/storage";
import { signOutKakao } from "../lib/kakaoAuth";
import { colors, fontSizes, radii, spacing } from "../theme/tokens";

type IconType = React.ComponentType<{ size?: number; color?: string }>;
// route가 있는 항목만 실제 화면으로 이동한다. 나머지는 아직 시각용 자리표시자.
type MenuItem = { Icon: IconType; label: string; color: string; sub?: string; route?: string };

const menuItems: MenuItem[] = [
  { Icon: Volume2, label: "알림 소리 설정", color: colors.primaryBlue, route: "AlarmSound" },
  { Icon: Mic2, label: "음성 안내 속도", color: colors.primaryBlue, route: "VoiceSpeed" },
  // 아직 만들지 않은 기능은 눌러도 아무 일이 없는 대신 "준비 중"이라고 밝힌다
  // (QA에서 "버튼이 안 눌림"으로 보고됨).
  { Icon: Type, label: "큰 글씨 모드", color: colors.textSecondary, sub: "준비 중이에요" },
  { Icon: Shield, label: "개인정보 설정", color: colors.textSecondary, route: "Privacy" },
];

export function SettingsScreen() {
  const nav = useNavigation<any>();
  const onLogout = async () => {
    await notifee.cancelAllNotifications().catch(() => {});
    // 카카오로 로그인한 경우 세션도 함께 끊는다. 안 그러면 로그아웃 후에도
    // 같은 계정으로 자동 복귀해 "처음으로"가 되지 않는다.
    await signOutKakao();
    await clearAll();
    nav.reset({ index: 0, routes: [{ name: "RoleSelect" }] });
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="더보기" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.group}>
          {menuItems.map(({ Icon, label, color, sub, route }, i) => {
            const rowStyle = [styles.rowItem, i < menuItems.length - 1 && styles.rowDivider];
            const inner = (
              <>
                <View style={[styles.iconBox, { backgroundColor: color + "1A" }]}>
                  <Icon size={20} color={color} />
                </View>
                <View style={styles.rowTextWrap}>
                  <Text style={styles.rowLabel}>{label}</Text>
                  {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
                </View>
                {route ? <ChevronRight size={18} color={colors.textSecondary} /> : null}
              </>
            );
            // route가 없으면 준비 중인 항목 — 화살표를 빼서 누를 수 없음을 드러낸다.
            return route ? (
              <Pressable
                key={label}
                onPress={() => nav.navigate(route)}
                style={({ pressed }) => [...rowStyle, pressed && { opacity: 0.9 }]}
              >
                {inner}
              </Pressable>
            ) : (
              <View key={label} style={rowStyle}>{inner}</View>
            );
          })}
        </View>

        {/* 로그아웃 / 역할 다시 선택 (실제 동작) */}
        <View style={styles.group}>
          <Pressable onPress={onLogout} style={({ pressed }) => [styles.rowItem, pressed && { opacity: 0.9 }]}>
            <View style={[styles.iconBox, { backgroundColor: colors.dangerRed + "1A" }]}>
              <LogOut size={20} color={colors.dangerRed} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.dangerRed, flex: 1 }]}>로그아웃 / 처음으로</Text>
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
  rowSub: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: 2 },
});

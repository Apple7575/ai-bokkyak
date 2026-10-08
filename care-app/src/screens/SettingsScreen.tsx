import React, { useCallback, useState } from "react";
import { Image, View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Volume2, Shield, ChevronRight, ClipboardList, User } from "lucide-react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { getPatientName } from "../lib/storage";
import { currentUser, loginProviderLabel } from "../lib/auth";
import { colors, fontSizes, radii, spacing, shadows, tabBarClearance } from "../theme/tokens";

const SETTINGS_ART = require("../../assets/illustrations/settings-dial-accent.png");

type IconType = React.ComponentType<{ size?: number; color?: string }>;
// 모든 항목이 실제 화면으로 이동한다. 만들지 않은 기능은 여기에 두지 않는다
// (스토어 심사 2026-10-04: "준비 중" 자리표시자 메뉴는 미완성 기능으로 반려 사유가 된다).
type MenuItem = { Icon: IconType; label: string; color: string; route: string };

const menuItems: MenuItem[] = [
  // 저장해 둔 1분 점검 결과를 다시 연다(회의 2026-10-08).
  { Icon: ClipboardList, label: "지난 복용 점검", color: colors.successGreen, route: "QuickCheckHistory" },
  { Icon: Volume2, label: "알람 소리 설정", color: colors.primaryBlue, route: "AlarmSound" },
  // "음성 안내 속도"는 2026-10-03에 뺐다 — 앱이 읽어 주는 곳이 없어져 설정할 대상이 없다.
  // "큰 글씨 모드(준비 중)"는 2026-10-04에 뺐다 — 구현 전까지는 보여 주지 않는다.
  { Icon: Shield, label: "개인정보 설정", color: colors.textSecondary, route: "Privacy" },
];

export function SettingsScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();

  // 계정 줄 — 이름과 로그인 수단. 로그아웃·계정 삭제는 계정 관리 화면에 있다(회의 2026-10-08).
  // 옛 「카카오 연결하기」와 「처음 화면으로 돌아가기」는 로그인으로 대체돼 없앴다.
  const [name, setName] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    let alive = true;
    void getPatientName().then((n) => { if (alive) setName(n); });
    void currentUser().then((u) => { if (alive) setProvider(loginProviderLabel(u)); });
    return () => { alive = false; };
  }, []));

  return (
    <View style={styles.screen}>
      <ScreenHeader title="더보기" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance + insets.bottom }]}>
        {/* 계정 — 이름 · 로그인 수단 → 계정 관리 */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`계정 관리. ${name ?? "이름 없음"}`}
          onPress={() => nav.navigate("Account")}
          style={({ pressed }) => [styles.accountCard, pressed && { opacity: 0.9 }]}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.primarySoft }]}>
            <User size={22} color={colors.primaryBlue} />
          </View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.accountName}>{name ? name : "이름 없음"}</Text>
            <Text style={styles.accountStatus}>{provider ? `${provider}로 로그인 · 계정 관리` : "계정 관리"}</Text>
          </View>
          <ChevronRight size={18} color={colors.textSecondary} />
        </Pressable>

        <View style={styles.introCard}>
          <View style={styles.introCopy}>
            <Text style={styles.introTitle}>나에게 편하게 맞춰요</Text>
            <Text style={styles.introBody}>알람 소리와 개인정보를 여기서 설정할 수 있어요.</Text>
          </View>
          <Image source={SETTINGS_ART} style={styles.introArt} resizeMode="contain" />
        </View>
        <View style={styles.group}>
          {menuItems.map(({ Icon, label, color, route }, i) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => nav.navigate(route)}
              style={({ pressed }) => [styles.rowItem, i < menuItems.length - 1 && styles.rowDivider, pressed && { opacity: 0.9 }]}
            >
              <View style={[styles.iconBox, { backgroundColor: color + "1A" }]}>
                <Icon size={20} color={color} />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowLabel}>{label}</Text>
              </View>
              <ChevronRight size={18} color={colors.textSecondary} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.md, gap: spacing.md },
  accountCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 88,
    backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md, ...shadows.card,
  },
  accountName: { fontSize: fontSizes.title, fontWeight: "800", color: colors.primaryNavy },
  accountStatus: { marginTop: 2, fontSize: fontSizes.body, lineHeight: 26, color: colors.textSecondary },
  introCard: {
    minHeight: 126, padding: spacing.md, justifyContent: "center", overflow: "hidden",
    backgroundColor: colors.sageSoft, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card,
  },
  introCopy: { width: "62%", zIndex: 1 },
  introTitle: { fontSize: 22, lineHeight: 29, fontWeight: "800", color: colors.primaryNavy },
  introBody: { marginTop: 5, fontSize: fontSizes.body, lineHeight: 26, color: colors.textSecondary },
  introArt: { position: "absolute", right: -23, bottom: -9, width: 162, height: 118 },
  group: {
    backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, overflow: "hidden", ...shadows.card,
  },
  rowItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 72, paddingHorizontal: spacing.md, paddingVertical: 14 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBox: { width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  rowTextWrap: { flex: 1 },
  rowLabel: { fontSize: 19, fontWeight: "700", color: colors.text },
});

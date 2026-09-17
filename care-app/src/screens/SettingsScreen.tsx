import React, { useCallback, useState } from "react";
import { Image, View, Text, Pressable, ScrollView, StyleSheet, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Volume2, Gauge, Type, Shield, LogOut, ChevronRight } from "lucide-react-native";
import notifee from "@notifee/react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { BigButton } from "../components/BigButton";
import { clearAll, getPatientId, getPatientName } from "../lib/storage";
import { clearDraft } from "../lib/quickCheckDraft";
import { isKakaoLinked, linkKakao } from "../lib/kakaoAccount";
import { colors, fontSizes, radii, spacing, shadows, tabBarClearance } from "../theme/tokens";

const SETTINGS_ART = require("../../assets/illustrations/settings-dial-accent.png");

type IconType = React.ComponentType<{ size?: number; color?: string }>;
// route가 있는 항목만 실제 화면으로 이동한다. 나머지는 아직 시각용 자리표시자.
type MenuItem = { Icon: IconType; label: string; color: string; sub?: string; route?: string };

const menuItems: MenuItem[] = [
  { Icon: Volume2, label: "알림 소리 설정", color: colors.primaryBlue, route: "AlarmSound" },
  { Icon: Gauge, label: "음성 안내 속도", color: colors.primaryBlue, route: "VoiceSpeed" },
  // 아직 만들지 않은 기능은 눌러도 아무 일이 없는 대신 "준비 중"이라고 밝힌다
  // (QA에서 "버튼이 안 눌림"으로 보고됨).
  { Icon: Type, label: "큰 글씨 모드", color: colors.textSecondary, sub: "준비 중이에요" },
  { Icon: Shield, label: "개인정보 설정", color: colors.textSecondary, route: "Privacy" },
];

export function SettingsScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();

  // 계정 영역 — 회의 2026-09-10: 카카오는 가입이 아니라 "기기 이전용 연결". 여기서 연결 상태를 보여 주고
  // 미연결이면 연결 버튼을 둔다. linked: null = 조회 실패(버튼은 남기고 문구만 바꾼다).
  const [name, setName] = useState<string | null>(null);
  const [linked, setLinked] = useState<boolean | null>(null);
  const [linking, setLinking] = useState(false);
  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      const [n, pid] = await Promise.all([getPatientName(), getPatientId()]);
      if (!alive) return;
      setName(n);
      const v = pid ? await isKakaoLinked(pid) : null;
      if (alive) setLinked(v);
    })();
    return () => { alive = false; };
  }, []));

  const onLink = async () => {
    if (linking) return;
    const pid = await getPatientId();
    if (!pid) { Alert.alert("연결하지 못했어요", "내 정보를 찾지 못했어요. 앱을 다시 시작해 주세요."); return; }
    setLinking(true);
    try {
      const r = await linkKakao(pid);
      if (r.ok) {
        setLinked(true);
        Alert.alert("연결됐어요", "휴대폰을 바꿔도 이 정보를 그대로 쓸 수 있어요.");
      } else if (!r.canceled) {
        Alert.alert("카카오 연결하기", r.message);
      }
    } finally {
      setLinking(false);
    }
  };

  const onLogout = async () => {
    await notifee.cancelAllNotifications().catch(() => {});
    // 카카오 로그인은 Supabase Auth 세션을 만들지 않으므로 끊을 세션이 없다.
    // 기기에 남는 건 patientId뿐이고 clearAll()이 지운다. 같은 카카오 계정으로
    // 다시 로그인하면 kakao_id로 약장을 되찾는다.
    await clearAll();
    // 1분 점검 초안도 지운다 — 남겨 두면 다음 사람의 환자로 저장(commit)될 수 있다.
    await clearDraft();
    nav.reset({ index: 0, routes: [{ name: "Intro" }] });
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="더보기" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance + insets.bottom }]}>
        {/* 계정 — 이름과 카카오 연결 상태 */}
        <View style={styles.accountCard}>
          <Text style={styles.accountName}>{name ? name : "이름 없음"}</Text>
          <Text style={styles.accountStatus}>
            {linked === true
              ? "카카오와 연결돼 있어요 · 휴대폰을 바꿔도 그대로"
              : linked === false
                ? "이 휴대폰에만 저장돼 있어요"
                : "연결 상태를 확인하지 못했어요"}
          </Text>
          {linked !== true ? (
            <BigButton variant="secondary" label={linking ? "연결 중…" : "카카오 연결하기"} onPress={() => { void onLink(); }} disabled={linking} />
          ) : null}
        </View>

        <View style={styles.introCard}>
          <View style={styles.introCopy}>
            <Text style={styles.introTitle}>나에게 편하게 맞춰요</Text>
            <Text style={styles.introBody}>소리와 글씨를 보기 편하게 설정할 수 있어요.</Text>
          </View>
          <Image source={SETTINGS_ART} style={styles.introArt} resizeMode="contain" />
        </View>
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
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.md, gap: spacing.md },
  accountCard: {
    backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md, gap: spacing.xs, ...shadows.card,
  },
  accountName: { fontSize: fontSizes.title, fontWeight: "800", color: colors.primaryNavy },
  accountStatus: { fontSize: fontSizes.body, lineHeight: 26, color: colors.textSecondary, marginBottom: spacing.xs },
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
  rowSub: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: 2 },
});

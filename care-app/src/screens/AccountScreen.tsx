import React, { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LogOut } from "lucide-react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { getPatientName } from "../lib/storage";
import { currentUser, loginProviderLabel } from "../lib/auth";
import { clearLocalSession, deleteMyAccount, findMyPatient } from "../lib/account";
import { koreanDate } from "../lib/quickCheckHistory";
import { colors, fontSizes, radii, spacing, shadows, minTouch } from "../theme/tokens";

// 계정 관리 — 이름·로그인 수단·동의한 날, 로그아웃, 계정 삭제(App Store 5.1.1(v): 앱 안에서 삭제할 수 있어야 한다).
// 둘 다 끝나면 처음 화면(시작 장)으로 돌아간다.

export function AccountScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  // 동의한 날 — 서버에서 읽는다. undefined=불러오는 중, null=확인하지 못함.
  const [agreedAt, setAgreedAt] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState<null | "logout" | "delete">(null);

  useFocusEffect(useCallback(() => {
    let alive = true;
    void getPatientName().then((n) => { if (alive) setName(n); });
    void currentUser().then((u) => { if (alive) setProvider(loginProviderLabel(u)); });
    findMyPatient()
      .then((p) => { if (alive) setAgreedAt(p?.consent?.agreedAt ? koreanDate(p.consent.agreedAt) || null : null); })
      .catch(() => { if (alive) setAgreedAt(null); });
    return () => { alive = false; };
  }, []));

  const toIntro = () => nav.reset({ index: 0, routes: [{ name: "Intro", params: { slide: "cta" } }] });

  async function doLogout() {
    if (busy) return;
    setBusy("logout");
    // 기기 정리는 실패해도 계속 간다(clearLocalSession이 단계마다 삼킨다) — 로그아웃은 막히면 안 된다.
    await clearLocalSession();
    toIntro();
  }

  async function doDelete() {
    if (busy) return;
    setBusy("delete");
    try {
      await deleteMyAccount();
      toIntro();
    } catch (e) {
      console.warn("Account: 계정 삭제 실패", (e as Error)?.message ?? e);
      setBusy(null);
      Alert.alert("삭제하지 못했어요", "인터넷 연결을 확인하고 다시 시도해 주세요.");
    }
  }

  const onLogout = () => {
    Alert.alert(
      "로그아웃할까요?",
      "이 휴대폰에서 약 알람이 울리지 않게 돼요. 같은 계정으로 다시 로그인하면 약과 기록을 그대로 불러와요.",
      [
        { text: "취소", style: "cancel" },
        { text: "로그아웃", onPress: () => { void doLogout(); } },
      ],
    );
  };

  const onDelete = () => {
    Alert.alert(
      "계정을 삭제할까요?",
      "등록한 약, 알람, 복약 기록, 점검 결과가 모두 지워져요. 삭제하면 되돌릴 수 없어요.",
      [
        { text: "취소", style: "cancel" },
        { text: "삭제", style: "destructive", onPress: () => { void doDelete(); } },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="계정 관리" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}>
        <View style={styles.card}>
          <Text style={styles.name}>{name ? name : "이름 없음"}</Text>
          <InfoRow label="로그인 수단" value={provider ?? "확인하지 못했어요"} />
          <InfoRow label="동의한 날" value={agreedAt === undefined ? "불러오는 중…" : agreedAt ?? "확인하지 못했어요"} last />
        </View>

        <View style={styles.group}>
          <Pressable accessibilityRole="button" onPress={onLogout} disabled={busy !== null}
            style={({ pressed }) => [styles.rowItem, pressed && { opacity: 0.9 }]}>
            <View style={[styles.iconBox, { backgroundColor: colors.dangerSoft }]}>
              <LogOut size={22} color={colors.dangerRed} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.dangerRed }]}>{busy === "logout" ? "로그아웃하는 중…" : "로그아웃"}</Text>
          </Pressable>
        </View>

        {/* 계정 삭제 — 눈에 덜 띄는 회색 글자 링크로(회의 2026-10-09). 실수로 누르지 않게 하되 찾을 수는 있어야 한다
            (App Store 5.1.1(v)). 무엇이 지워지는지는 확인창이 알린다. 글자는 작아도 누르는 자리는 손가락 크기로. */}
        <Pressable accessibilityRole="button" accessibilityLabel="계정 삭제" onPress={onDelete} disabled={busy !== null}
          hitSlop={8} style={({ pressed }) => [styles.deleteLink, pressed && { opacity: 0.6 }]}>
          <Text style={styles.deleteText}>{busy === "delete" ? "삭제하는 중…" : "계정 삭제"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoDivider]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.md, gap: spacing.md },
  card: {
    backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs, ...shadows.card,
  },
  name: { fontSize: fontSizes.title, fontWeight: "800", color: colors.primaryNavy, marginBottom: spacing.sm },
  infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: minTouch, gap: spacing.sm },
  infoDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { fontSize: fontSizes.body, color: colors.textSecondary },
  infoValue: { flexShrink: 1, fontSize: fontSizes.body, fontWeight: "700", color: colors.text, textAlign: "right" },
  group: {
    backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, overflow: "hidden", ...shadows.card,
  },
  rowItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 72, paddingHorizontal: spacing.md, paddingVertical: 14 },
  iconBox: { width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 19, fontWeight: "700", color: colors.text },
  deleteLink: { alignSelf: "center", minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.md, marginTop: spacing.sm },
  deleteText: { fontSize: 16, color: colors.textSecondary, textDecorationLine: "underline" },
});

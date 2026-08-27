import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Modal, ActivityIndicator } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, Lock, ShieldCheck, Stethoscope, MessageCircle, User, X } from "lucide-react-native";
import { BigButton } from "../components/BigButton";
import { getPatientId } from "../lib/storage";
import { Finding } from "../lib/interactions";
import { splitResult } from "../lib/quickCheck";
import { loadDraft } from "../lib/quickCheckDraft";
import { DISCLAIMER } from "../lib/voiceScript";
import { colors, fontSizes, spacing, radii, minTouch, shadows } from "../theme/tokens";

// 점검 결과.
//  · 가입 전: 첫 건만 보여 주고 나머지는 잠근다. 버튼을 누르면 가입 시트가 뜬다.
//  · 가입 후(RoleSelect가 unlocked:true 로 보냄): 전부 보여 주고 알람 설정으로 보낸다.
// 결과 데이터는 기기 초안에서 읽는다. 가입 직후에는 commit이 초안을 지우므로
// RoleSelect가 넘겨준 findings 파라미터를 우선 쓴다.

type State = { phase: "loading" } | { phase: "empty" } | { phase: "ok"; findings: Finding[]; unlocked: boolean };

export function QuickCheckResultScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State>({ phase: "loading" });
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const paramFindings = route.params?.findings as Finding[] | undefined;
      const pid = await getPatientId();
      const unlocked = Boolean(route.params?.unlocked) || pid !== null;
      let findings = paramFindings ?? null;
      if (!findings) {
        const d = await loadDraft();
        findings = d?.findings ?? null;
      }
      if (!alive) return;
      if (!findings) { setState({ phase: "empty" }); return; }
      setState({ phase: "ok", findings, unlocked });
    })();
    return () => { alive = false; };
  }, [route.params]);

  function toSignup(kakao: boolean) {
    setSheet(false);
    nav.navigate("RoleSelect", { from: "quickCheck", kakao });
  }
  function toAlarm() {
    nav.reset({ index: 0, routes: [{ name: "Tabs" }, { name: "VoiceGuide" }] });
  }

  const findings = state.phase === "ok" ? state.findings : [];
  const unlocked = state.phase === "ok" && state.unlocked;
  const { shown, lockedCount } = splitResult(findings);
  const visible = unlocked ? findings : shown ? [shown] : [];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.c}>
        <Text style={styles.title}>복용 조합 점검이 끝났어요</Text>

        {state.phase === "loading" ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.primaryBlue} /></View>
        ) : null}

        {state.phase === "empty" ? (
          <View style={styles.safe}>
            <Text style={styles.safeDesc}>점검 결과가 없어요. 처음부터 다시 점검해 주세요.</Text>
            <BigButton label="다시 점검하기" variant="secondary" onPress={() => nav.reset({ index: 0, routes: [{ name: "QuickCheckInput" }] })} />
          </View>
        ) : null}

        {state.phase === "ok" && findings.length === 0 ? (
          <View style={styles.safe}>
            <ShieldCheck size={44} color={colors.successGreen} />
            <Text style={styles.safeTitle}>확인된 주의 조합이 없어요</Text>
            <Text style={styles.safeDesc}>
              고르신 약과 영양제 사이에 함께 쓰지 말라고 고시된 조합은 찾지 못했어요.
              다만 모든 경우를 다 담고 있지는 않으니, 새 약을 드시게 되면 약사에게 확인해 주세요.
            </Text>
          </View>
        ) : null}

        {state.phase === "ok" && findings.length > 0 ? (
          <>
            <View style={styles.lead}>
              <AlertTriangle size={26} color={colors.dangerRed} />
              <Text style={styles.leadText}>확인이 필요한 항목 {findings.length}건</Text>
            </View>

            {visible.map((f, i) => (
              <View key={`${f.medA}|${f.medB}|${f.ingredientA}|${f.ingredientB}|${i}`} style={styles.card}>
                <View style={styles.badge}>
                  <Stethoscope size={16} color={colors.coral} />
                  <Text style={styles.badgeText}>약사 확인 권장</Text>
                </View>
                <View style={styles.pairRow}>
                  <Text style={styles.pairName}>{f.medA}</Text>
                  <Text style={styles.pairPlus}>+</Text>
                  <Text style={styles.pairName}>{f.medB}</Text>
                </View>
                <Text style={styles.ingredients}>{`성분: ${f.ingredientA} · ${f.ingredientB}`}</Text>
                {f.reason ? <Text style={styles.reason}>{f.reason}</Text> : null}
                {f.notice_no ? <Text style={styles.source}>{`근거: 식약처 DUR 고시 ${f.notice_no}`}</Text> : null}
              </View>
            ))}

            {!unlocked && lockedCount > 0 ? (
              <View style={styles.locked}>
                <View style={styles.lockIcon}><Lock size={26} color={colors.primaryNavy} /></View>
                <View style={styles.lockCopy}>
                  <Text style={styles.lockTitle}>추가로 확인할 내용 {lockedCount}건</Text>
                  <Text style={styles.lockDesc}>가입하면 결과가 저장되고 전부 볼 수 있어요.</Text>
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        <View style={styles.notice}>
          <Stethoscope size={22} color={colors.primaryNavy} />
          <Text style={styles.noticeText}>
            스스로 약을 끊거나 바꾸지 마시고,{" "}
            <Text style={styles.noticeStrong}>약사나 의사에게 꼭 확인하세요.</Text>
          </Text>
        </View>
      </ScrollView>

      {state.phase === "ok" ? (
        <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
          {unlocked ? (
            <BigButton label="복용 알람 설정하기" onPress={toAlarm} showArrow />
          ) : lockedCount === 0 ? (
            <BigButton label="결과 저장하고 시작하기" onPress={() => setSheet(true)} showArrow />
          ) : (
            <BigButton label={`결과 저장하고 상세 ${lockedCount}건 보기`} onPress={() => setSheet(true)} showArrow />
          )}
          <Text style={styles.disclaimer}>{DISCLAIMER}</Text>
        </View>
      ) : null}

      {/* 가입 시트 */}
      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(false)} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>분석 결과를 저장하고 상세 내용을 확인해보세요.</Text>
            <Pressable onPress={() => setSheet(false)} hitSlop={10} style={styles.sheetClose} accessibilityRole="button" accessibilityLabel="닫기">
              <X size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.sheetSub}>무료 회원가입 · 결과 자동 저장</Text>
          <Pressable onPress={() => toSignup(true)} style={({ pressed }) => [styles.kakaoBtn, pressed && { opacity: 0.85 }]}>
            <MessageCircle size={22} color={colors.kakaoInk} fill={colors.kakaoInk} />
            <Text style={styles.kakaoText}>카카오로 계속하기</Text>
          </Pressable>
          <Pressable onPress={() => toSignup(false)} style={({ pressed }) => [styles.otherBtn, pressed && { opacity: 0.85 }]}>
            <User size={22} color={colors.primaryNavy} />
            <Text style={styles.otherText}>다른 방법으로 가입하기</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  c: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },
  title: { fontSize: 28, lineHeight: 38, fontWeight: "800", color: colors.primaryNavy, letterSpacing: -0.6 },
  center: { alignItems: "center", marginTop: spacing.xl },
  safe: {
    alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.lg,
  },
  safeTitle: { fontSize: 24, fontWeight: "800", color: colors.primaryNavy, textAlign: "center" },
  safeDesc: { fontSize: 19, color: colors.textSecondary, textAlign: "center", lineHeight: 28 },
  lead: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.dangerSoft, borderColor: colors.dangerRed, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md,
  },
  leadText: { flex: 1, fontSize: 20, fontWeight: "700", color: colors.dangerRed, lineHeight: 28 },
  card: {
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md, ...shadows.card,
  },
  badge: {
    alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.coralSoft, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 6, marginBottom: spacing.sm,
  },
  badgeText: { fontSize: 15, fontWeight: "800", color: colors.coral },
  pairRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
  pairName: { fontSize: 22, fontWeight: "800", color: colors.primaryNavy },
  pairPlus: { fontSize: 22, fontWeight: "800", color: colors.dangerRed },
  ingredients: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: spacing.xs },
  reason: { fontSize: 19, color: colors.text, lineHeight: 29, marginTop: spacing.sm },
  source: { fontSize: 16, color: colors.textSecondary, marginTop: spacing.sm },
  locked: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.canvasMuted, borderRadius: radii.card, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, borderStyle: "dashed",
  },
  lockIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center" },
  lockCopy: { flex: 1 },
  lockTitle: { fontSize: 20, fontWeight: "800", color: colors.primaryNavy },
  lockDesc: { fontSize: fontSizes.body, color: colors.textSecondary, lineHeight: 26, marginTop: 2 },
  notice: {
    flexDirection: "row", gap: spacing.sm, alignItems: "flex-start",
    backgroundColor: colors.lightBlueBg, borderRadius: radii.card, padding: spacing.md,
  },
  noticeText: { flex: 1, fontSize: 19, color: colors.primaryNavy, lineHeight: 28 },
  noticeStrong: { fontWeight: "800" },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, backgroundColor: colors.canvas, borderTopWidth: 1, borderTopColor: colors.border },
  disclaimer: { fontSize: 15, lineHeight: 22, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs },
  backdrop: { flex: 1, backgroundColor: colors.overlayStrong },
  sheet: {
    backgroundColor: colors.surfaceRaised, borderTopLeftRadius: radii.hero, borderTopRightRadius: radii.hero,
    padding: spacing.lg, gap: spacing.md, ...shadows.floating,
  },
  sheetHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  sheetTitle: { flex: 1, fontSize: 22, lineHeight: 32, fontWeight: "800", color: colors.primaryNavy, letterSpacing: -0.4 },
  sheetClose: { width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" },
  sheetSub: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: -spacing.sm },
  kakaoBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    minHeight: minTouch, borderRadius: radii.pill, backgroundColor: colors.kakao,
  },
  kakaoText: { fontSize: fontSizes.emphasis, fontWeight: "800", color: colors.kakaoInk },
  otherBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    minHeight: minTouch, borderRadius: radii.pill, backgroundColor: colors.surfaceRaised, borderWidth: 1.5, borderColor: colors.border,
  },
  otherText: { fontSize: fontSizes.emphasis, fontWeight: "800", color: colors.primaryNavy },
});

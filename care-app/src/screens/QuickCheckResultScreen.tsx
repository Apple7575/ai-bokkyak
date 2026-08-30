import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Modal, ActivityIndicator, Share, Alert, Platform } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Lock, ShieldCheck, Stethoscope, MessageCircle, User, X, SearchX, ChevronRight } from "lucide-react-native";
import { BigButton } from "../components/BigButton";
import { getPatientId } from "../lib/storage";
import {
  checkedCount as countChecked, summarize, topFinding, lockedGroups, groupByKind, QuickFinding, RuleKind,
} from "../lib/quickCheck";
import { KIND_LABEL } from "../lib/quickCheckRules";
import { buildQuickCheckShareMessage } from "../lib/quickCheckShare";
import { loadDraft } from "../lib/quickCheckDraft";
import { DISCLAIMER } from "../lib/voiceScript";
import { colors, fontSizes, spacing, radii, minTouch, shadows } from "../theme/tokens";

// 점검 결과 (시안 V8 화면 12).
//  · 가입 전: 요약 카드 + 첫 건만 보여 주고 나머지는 종류별 개수로 잠근다. 버튼을 누르면 가입 시트.
//  · 가입 후(RoleSelect가 unlocked:true 로 보냄): 종류별로 전부 보여 주고 알람 설정으로 보낸다.
// 결과 데이터는 기기 초안에서 읽는다. 가입 직후에는 commit이 초안을 지우므로
// RoleSelect가 넘겨준 findings 파라미터를 우선 쓴다.

type State =
  | { phase: "loading" }
  | { phase: "empty" }
  // unmatched: 자료에서 못 찾아 대조에서 빠진 제품명. checkedCount: 실제로 대조한 이름 수.
  | { phase: "ok"; findings: QuickFinding[]; unlocked: boolean; unmatched: string[]; checkedCount: number; durUnavailable: boolean };

// kind별 태그 색 — 요약 카드 점(우선=빨강, 시간=파랑, 중복=주황)과 같은 계열.
const KIND_COLOR: Record<RuleKind, { fg: string; bg: string }> = {
  priority: { fg: colors.dangerRed, bg: colors.dangerSoft },
  timing: { fg: colors.primaryBlue, bg: colors.primarySoft },
  overlap: { fg: colors.warningOrange, bg: colors.warningSoft },
  caution: { fg: colors.textSecondary, bg: colors.canvasMuted },
};

const SUMMARY_ROWS: { kind: RuleKind; label: string }[] = [
  { kind: "priority", label: KIND_LABEL.priority },
  { kind: "timing", label: KIND_LABEL.timing },
  { kind: "overlap", label: KIND_LABEL.overlap },
];

function FindingCard({ f, highlighted }: { f: QuickFinding; highlighted?: boolean }) {
  const c = KIND_COLOR[f.kind];
  return (
    <View style={[styles.card, highlighted && styles.cardTop]}>
      <View style={styles.tagRow}>
        <View style={[styles.tag, { backgroundColor: c.bg }]}>
          <Text style={[styles.tagText, { color: c.fg }]}>{f.tag}</Text>
        </View>
        {highlighted ? <ChevronRight size={22} color={colors.border} /> : null}
      </View>
      <Text style={styles.cardTitle}>{f.title}</Text>
      <Text style={styles.cardMsg}>{f.message}</Text>
      {f.source === "dur" && f.notice_no ? <Text style={styles.source}>{`근거: 식약처 DUR 고시 ${f.notice_no}`}</Text> : null}
      <View style={styles.divider} />
      <View style={styles.pharmRow}>
        <View style={styles.pharmPill}><Text style={styles.pharmPillText}>약사 확인 권장</Text></View>
        <Text style={styles.pharmNote}>복용 방법은 약사 또는 의료진과 확인해주세요.</Text>
      </View>
    </View>
  );
}

export function QuickCheckResultScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State>({ phase: "loading" });
  const [sheet, setSheet] = useState<null | "signup" | "share">(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const paramFindings = route.params?.findings as QuickFinding[] | undefined;
      const paramUnmatched = (route.params?.unmatched as string[] | undefined) ?? [];
      const pid = await getPatientId();
      const unlocked = Boolean(route.params?.unlocked) || pid !== null;
      const d = await loadDraft();
      const findings = paramFindings ?? d?.findings ?? null;
      const unmatched = paramFindings ? paramUnmatched : (d?.unmatched ?? []);
      // 가입 후에는 commit이 초안을 지우므로 대조한 이름 수도 params로 받는다.
      const checked = paramFindings
        ? (typeof route.params?.checked === "number" ? route.params.checked : 0)
        : d ? countChecked(d) : 0;
      if (!alive) return;
      if (!findings) { setState({ phase: "empty" }); return; }
      setState({ phase: "ok", findings, unlocked, unmatched, checkedCount: checked, durUnavailable: paramFindings ? Boolean(route.params?.durUnavailable) : Boolean(d?.durUnavailable) });
    })();
    return () => { alive = false; };
  }, [route.params]);

  function toSignup(kakao: boolean) {
    setSheet(null);
    // kakaoAt: RoleSelect는 이미 스택 아래에 있어 params만 갱신된다 — 요청마다 다른 값으로 구분.
    nav.navigate("RoleSelect", { from: "quickCheck", kakao, kakaoAt: kakao ? Date.now() : undefined });
  }
  function toAlarm() {
    nav.reset({ index: 1, routes: [{ name: "Tabs" }, { name: "VoiceGuide" }] });
  }
  // 시스템 공유 시트 — 카카오톡은 여기서 고른다(카카오 SDK 없음). 취소는 조용히, 실패만 알린다.
  async function share() {
    setSheet(null);
    try {
      await Share.share({ message: buildQuickCheckShareMessage(Platform.OS) });
    } catch (e) {
      Alert.alert("보내지 못했어요", e instanceof Error && e.message ? e.message : "잠시 후 다시 시도해 주세요.");
    }
  }

  const findings = state.phase === "ok" ? state.findings : [];
  const unlocked = state.phase === "ok" && state.unlocked;
  const unmatched = state.phase === "ok" ? state.unmatched : [];
  // 대조한 이름이 2개 미만이면 조합 점검 자체가 성립하지 않는다 — "이상 없음"이라 하면 안 된다.
  const nothingChecked = state.phase === "ok" && state.checkedCount < 2;
  const summary = summarize(findings);
  const top = topFinding(findings);
  const locked = lockedGroups(findings);
  const lockedCount = Math.max(0, summary.total - 1);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.c, { paddingBottom: spacing.xl + insets.bottom }]}>
        <Text style={styles.title}>복용 조합 점검이 끝났어요.</Text>
        {state.phase === "ok" && summary.total > 0 ? (
          <Text style={styles.subtitle}>먼저 확인하면 좋은 내용을 간단하게 정리했어요.</Text>
        ) : null}

        {state.phase === "loading" ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.primaryBlue} /></View>
        ) : null}

        {state.phase === "empty" ? (
          <View style={styles.safe}>
            <Text style={styles.safeDesc}>점검 결과가 없어요. 처음부터 다시 점검해 주세요.</Text>
            <BigButton label="다시 점검하기" variant="secondary" onPress={() => nav.reset({ index: 0, routes: [{ name: "QuickCheckInput" }] })} />
          </View>
        ) : null}

        {/* 요약 카드 */}
        {state.phase === "ok" && summary.total > 0 ? (
          <View style={styles.summary}>
            <View style={styles.summaryHead}>
              <Text style={styles.summaryLabel}>확인이 필요한 항목</Text>
              <Text style={styles.summaryTotal}>{`${summary.total}건`}</Text>
            </View>
            <View style={styles.divider} />
            {SUMMARY_ROWS.map((r) => {
              const n = summary.byKind[r.kind];
              const c = KIND_COLOR[r.kind];
              return (
                <View key={r.kind} style={styles.summaryRow}>
                  <View style={[styles.dot, { backgroundColor: n > 0 ? c.fg : colors.border }]} />
                  <Text style={[styles.summaryRowLabel, n === 0 && styles.muted]}>{r.label}</Text>
                  <Text style={[styles.summaryRowNum, { color: n > 0 ? c.fg : colors.textSecondary }]}>{`${n}건`}</Text>
                </View>
              );
            })}
            {summary.byKind.caution > 0 ? (
              <Text style={styles.summaryFoot}>{`주의사항 ${summary.byKind.caution}건 포함`}</Text>
            ) : null}
          </View>
        ) : null}

        {/* 제품명 대조를 못 한 경우 — 규칙 결과만으로 넘어왔다 */}
        {state.phase === "ok" && state.durUnavailable ? (
          <View style={styles.durNote}>
            <Text style={styles.note}>
              {unlocked
                ? "인터넷 연결 문제로 제품명 자료 대조는 하지 못했어요. 약장에 등록하면 '함께 드실 때 주의'에서 다시 확인할 수 있어요."
                : "인터넷 연결 문제로 제품명 자료 대조는 하지 못했어요. 연결을 확인하고 다시 대조해 보세요."}
            </Text>
            {!unlocked ? (
              <BigButton label="제품명 다시 대조하기" variant="secondary" onPress={() => nav.replace("QuickCheckAnalyzing")} />
            ) : null}
          </View>
        ) : null}

        {/* 자료에서 못 찾은 제품명 — 성분을 알 수 없어 점검에서 빠진다 */}
        {state.phase === "ok" && unmatched.length > 0 ? (
          <View style={styles.unmatched}>
            <View style={styles.unmatchedHead}>
              <SearchX size={24} color={colors.warningOrange} />
              <Text style={styles.unmatchedTitle}>점검하지 못한 항목 {unmatched.length}개</Text>
            </View>
            <Text style={styles.unmatchedNames}>{unmatched.join(" · ")}</Text>
            <Text style={styles.unmatchedDesc}>
              식약처 자료에서 제품을 찾지 못해 성분을 알 수 없었어요. 약 봉투나 통에 적힌 제품 이름으로 검색하면 확인할 수 있어요.
            </Text>
          </View>
        ) : null}

        {state.phase === "ok" && summary.total === 0 && !nothingChecked ? (
          <View style={styles.safe}>
            <ShieldCheck size={44} color={colors.successGreen} />
            <Text style={styles.safeTitle}>확인된 주의 조합이 없어요</Text>
            <Text style={styles.safeDesc}>
              고르신 약과 영양제 사이에 알려진 주의 조합은 없었어요.
              다만 모든 경우를 다 담고 있지는 않으니, 새 약을 드시게 되면 약사에게 확인해 주세요.
            </Text>
          </View>
        ) : null}

        {state.phase === "ok" && summary.total === 0 && nothingChecked ? (
          <View style={styles.safe}>
            <Text style={styles.safeTitle}>점검할 조합이 부족해요</Text>
            <Text style={styles.safeDesc}>약과 영양제를 두 가지 이상 고르면 함께 먹어도 되는지 확인할 수 있어요.</Text>
            <BigButton label="다시 고르기" variant="secondary" onPress={() => nav.reset({ index: 0, routes: [{ name: "QuickCheckInput" }] })} />
          </View>
        ) : null}

        {/* 가입 전: 첫 건 + 잠금 목록 */}
        {state.phase === "ok" && top && !unlocked ? (
          <>
            <Text style={styles.section}>가장 먼저 확인해보세요.</Text>
            <FindingCard f={top} highlighted />
            {locked.length > 0 ? (
              <>
                <Text style={styles.section}>추가로 확인할 내용이 있어요.</Text>
                <View style={styles.lockedBox}>
                  {locked.map((g, i) => (
                    <View key={g.kind} style={[styles.lockedRow, i === locked.length - 1 && styles.lockedRowLast]}>
                      <Text style={styles.lockedTitle}>{g.title}</Text>
                      <Text style={styles.lockedCount}>{`${g.count}건`}</Text>
                      <Lock size={18} color={colors.textSecondary} />
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : null}

        {/* 가입 후: 종류별 전체 */}
        {state.phase === "ok" && unlocked && summary.total > 0 ? (
          groupByKind(findings).map((g) => (
            <View key={g.kind} style={styles.group}>
              <Text style={styles.section}>{`${KIND_LABEL[g.kind]} ${g.items.length}건`}</Text>
              {g.items.map((f, i) => <FindingCard key={`${f.kind}|${f.a}|${f.b}|${i}`} f={f} />)}
            </View>
          ))
        ) : null}

        {/* 주 버튼 */}
        {state.phase === "ok" ? (
          <View style={styles.actions}>
            {unlocked ? (
              <BigButton label="복용 알람 설정하기" onPress={toAlarm} showArrow />
            ) : nothingChecked && summary.total === 0 ? (
              <BigButton label="점검 없이 가입하기" variant="secondary" onPress={() => setSheet("signup")} />
            ) : lockedCount === 0 ? (
              <BigButton label="결과 저장하고 시작하기" onPress={() => setSheet("signup")} showArrow />
            ) : (
              <BigButton label={`결과 저장하고 상세 ${lockedCount}건 보기`} onPress={() => setSheet("signup")} showArrow />
            )}
            {!unlocked ? <Text style={styles.actionsNote}>무료 회원가입 · 결과 자동 저장</Text> : null}
          </View>
        ) : null}

        {/* 공유 */}
        {state.phase === "ok" ? (
          <View style={styles.shareBox}>
            <Text style={styles.shareTitle}>가족과 지인도 함께 건강해지기</Text>
            <Text style={styles.shareDesc}>약과 영양제를 함께 먹는 조합도 간단하게 확인해보세요.</Text>
            <Pressable onPress={() => setSheet("share")} style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85 }]} accessibilityRole="button">
              <View style={styles.kakaoDot}><MessageCircle size={16} color={colors.kakaoInk} fill={colors.kakaoInk} /></View>
              <Text style={styles.shareBtnText}>가족·지인에게 1분 점검 보내기</Text>
            </Pressable>
          </View>
        ) : null}

        {state.phase === "ok" ? (
          <>
            <View style={styles.notice}>
              <Stethoscope size={22} color={colors.primaryNavy} />
              <Text style={styles.noticeText}>
                스스로 약을 끊거나 바꾸지 마시고,{" "}
                <Text style={styles.noticeStrong}>약사나 의사에게 꼭 확인하세요.</Text>
              </Text>
            </View>
            <Text style={styles.disclaimer}>{DISCLAIMER}</Text>
          </>
        ) : null}
      </ScrollView>

      {/* 가입 시트 / 공유 시트 */}
      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(null)} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>
              {sheet === "share" ? "가족과 지인도 함께 건강해지기" : "분석 결과를 저장하고 상세 내용을 확인해보세요."}
            </Text>
            <Pressable onPress={() => setSheet(null)} hitSlop={10} style={styles.sheetClose} accessibilityRole="button" accessibilityLabel="닫기">
              <X size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
          {sheet === "share" ? (
            <>
              <Text style={styles.sheetSub}>약과 영양제를 함께 먹는 조합도 간단하게 확인해보세요.</Text>
              <Pressable onPress={() => { void share(); }} style={({ pressed }) => [styles.kakaoBtn, pressed && { opacity: 0.85 }]} accessibilityRole="button">
                <MessageCircle size={22} color={colors.kakaoInk} fill={colors.kakaoInk} />
                <Text style={styles.kakaoText}>카카오톡으로 1분 점검 보내기</Text>
              </Pressable>
              <Text style={styles.sheetCaption}>내 분석 결과는 공유되지 않아요.</Text>
            </>
          ) : (
            <>
              <Text style={styles.sheetSub}>무료 회원가입 · 결과 자동 저장</Text>
              <Pressable onPress={() => toSignup(true)} style={({ pressed }) => [styles.kakaoBtn, pressed && { opacity: 0.85 }]} accessibilityRole="button">
                <MessageCircle size={22} color={colors.kakaoInk} fill={colors.kakaoInk} />
                <Text style={styles.kakaoText}>카카오로 계속하기</Text>
              </Pressable>
              <Pressable onPress={() => toSignup(false)} style={({ pressed }) => [styles.otherBtn, pressed && { opacity: 0.85 }]} accessibilityRole="button">
                <User size={22} color={colors.primaryNavy} />
                <Text style={styles.otherText}>다른 방법으로 가입하기</Text>
              </Pressable>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  c: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
  title: { fontSize: 28, lineHeight: 38, fontWeight: "800", color: colors.primaryNavy, letterSpacing: -0.6 },
  subtitle: { fontSize: fontSizes.body, lineHeight: 26, fontWeight: "600", color: colors.textSecondary, marginTop: -spacing.sm },
  center: { alignItems: "center", marginTop: spacing.xl },
  section: { fontSize: 21, fontWeight: "800", color: colors.primaryNavy, letterSpacing: -0.4, marginTop: spacing.sm },
  divider: { height: 1, backgroundColor: colors.canvasMuted, marginVertical: spacing.sm },
  muted: { color: colors.textSecondary },
  durNote: { gap: 4 },
  note: { fontSize: fontSizes.body, lineHeight: 26, color: colors.textSecondary },

  summary: { backgroundColor: colors.cardBg, borderRadius: radii.card, padding: spacing.md, ...shadows.card },
  summaryHead: { flexDirection: "row", alignItems: "center" },
  summaryLabel: { flex: 1, fontSize: 20, fontWeight: "700", color: colors.primaryNavy },
  summaryTotal: { fontSize: 30, fontWeight: "800", color: colors.dangerRed, letterSpacing: -0.5 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 46 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  summaryRowLabel: { flex: 1, fontSize: fontSizes.body, fontWeight: "700", color: colors.text },
  summaryRowNum: { fontSize: 19, fontWeight: "800" },
  summaryFoot: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: spacing.xs },

  card: { backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1, borderRadius: radii.card, padding: spacing.md, ...shadows.card },
  cardTop: { borderColor: colors.secondaryBlue, borderWidth: 1.5 },
  tagRow: { flexDirection: "row", alignItems: "center" },
  tag: { alignSelf: "flex-start", borderRadius: radii.pill, paddingHorizontal: 12, minHeight: 32, justifyContent: "center", marginRight: "auto" },
  tagText: { fontSize: 18, fontWeight: "700" },
  cardTitle: { fontSize: 23, fontWeight: "800", color: colors.primaryNavy, letterSpacing: -0.4, marginTop: spacing.sm + 4 },
  cardMsg: { fontSize: 19, lineHeight: 29, fontWeight: "600", color: colors.text, marginTop: spacing.sm },
  source: { fontSize: 18, color: colors.textSecondary, marginTop: spacing.sm },
  pharmRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  pharmPill: { backgroundColor: colors.successSoft, borderRadius: radii.pill, paddingHorizontal: 12, minHeight: 32, justifyContent: "center" },
  pharmPillText: { fontSize: 18, fontWeight: "700", color: colors.successGreen },
  pharmNote: { flex: 1, fontSize: 18, lineHeight: 24, fontWeight: "600", color: colors.textSecondary, minWidth: 160 },

  lockedBox: { backgroundColor: colors.cardBg, borderRadius: radii.card, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, ...shadows.card },
  lockedRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, borderBottomWidth: 1, borderBottomColor: colors.canvasMuted },
  lockedRowLast: { borderBottomWidth: 0 },
  lockedTitle: { flex: 1, fontSize: fontSizes.body, fontWeight: "700", color: colors.text },
  lockedCount: { fontSize: fontSizes.body, fontWeight: "800", color: colors.textSecondary },

  group: { gap: spacing.md },
  actions: { marginTop: spacing.sm, gap: spacing.sm },
  actionsNote: { textAlign: "center", fontSize: 18, fontWeight: "600", color: colors.textSecondary },

  shareBox: { backgroundColor: colors.successSoft, borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.card, padding: spacing.md, gap: spacing.sm, marginTop: spacing.sm },
  shareTitle: { fontSize: 21, fontWeight: "800", color: colors.primaryNavy, letterSpacing: -0.4 },
  shareDesc: { fontSize: fontSizes.body, lineHeight: 26, fontWeight: "600", color: colors.text },
  shareBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, minHeight: minTouch,
    borderRadius: radii.pill, backgroundColor: colors.surfaceRaised, borderWidth: 1.5, borderColor: colors.border, marginTop: spacing.xs,
  },
  kakaoDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.kakao, alignItems: "center", justifyContent: "center" },
  shareBtnText: { fontSize: fontSizes.body, fontWeight: "800", color: colors.primaryNavy },

  unmatched: { backgroundColor: colors.warningSoft, borderRadius: radii.card, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.warningOrange },
  unmatchedHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  unmatchedTitle: { fontSize: 20, fontWeight: "800", color: colors.primaryNavy },
  unmatchedNames: { fontSize: fontSizes.body, fontWeight: "700", color: colors.text, lineHeight: 26 },
  unmatchedDesc: { fontSize: fontSizes.body, color: colors.textSecondary, lineHeight: 27 },
  safe: { alignItems: "center", gap: spacing.sm, backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1, borderRadius: radii.card, padding: spacing.lg },
  safeTitle: { fontSize: 24, fontWeight: "800", color: colors.primaryNavy, textAlign: "center" },
  safeDesc: { fontSize: 19, color: colors.textSecondary, textAlign: "center", lineHeight: 28 },
  notice: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", backgroundColor: colors.lightBlueBg, borderRadius: radii.card, padding: spacing.md },
  noticeText: { flex: 1, fontSize: 19, color: colors.primaryNavy, lineHeight: 28 },
  noticeStrong: { fontWeight: "800" },
  disclaimer: { fontSize: 18, lineHeight: 22, color: colors.textSecondary, textAlign: "center" },

  backdrop: { flex: 1, backgroundColor: colors.overlayStrong },
  sheet: { backgroundColor: colors.surfaceRaised, borderTopLeftRadius: radii.hero, borderTopRightRadius: radii.hero, padding: spacing.lg, gap: spacing.md, ...shadows.floating },
  sheetHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  sheetTitle: { flex: 1, fontSize: 22, lineHeight: 32, fontWeight: "800", color: colors.primaryNavy, letterSpacing: -0.4 },
  sheetClose: { width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" },
  sheetSub: { fontSize: fontSizes.body, lineHeight: 26, color: colors.textSecondary, marginTop: -spacing.sm },
  sheetCaption: { fontSize: 18, fontWeight: "600", color: colors.textSecondary, textAlign: "center" },
  kakaoBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, minHeight: minTouch, borderRadius: radii.pill, backgroundColor: colors.kakao },
  kakaoText: { fontSize: fontSizes.emphasis, fontWeight: "800", color: colors.kakaoInk },
  otherBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, minHeight: minTouch, borderRadius: radii.pill, backgroundColor: colors.surfaceRaised, borderWidth: 1.5, borderColor: colors.border },
  otherText: { fontSize: fontSizes.emphasis, fontWeight: "800", color: colors.primaryNavy },
});

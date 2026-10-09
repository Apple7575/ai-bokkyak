import React, { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight, ClipboardCheck } from "lucide-react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { BigButton } from "../components/BigButton";
import { supabase } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { HistoryEntry, historyEntry, historyNamesLine, koreanDateTime } from "../lib/quickCheckHistory";
import { colors, fontSizes, radii, spacing, shadows, minTouch } from "../theme/tokens";

// 내 복용분석 결과 보기(더보기) — 저장해 둔 1분 복용분석 결과를 최근 것부터 보여 주고, 누르면 그 결과를 다시 연다.
// 결과 화면은 점검 직후와 같은 화면을 쓰되 from: "history"로 열어 「복용분석 다시하기」·「닫기」만 둔다.
// 아래에는 늘 「복용분석 다시하기」를 둔다(목록이 비었을 때도) — 쌓아서 열어 1/3에서 뒤로 가면 여기로 돌아온다.
// 다시 한 분석은 끝나자마자 저장되고(로그인 상태, QuickCheckAnalyzing), 이 화면에 돌아오면 다시 읽어 목록에 보인다.

const LIMIT = 100;

type State = { phase: "loading" } | { phase: "error" } | { phase: "ok"; entries: HistoryEntry[] };

export function QuickCheckHistoryScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State>({ phase: "loading" });

  const load = useCallback(async (alive: () => boolean) => {
    setState({ phase: "loading" });
    try {
      const pid = await getPatientId();
      if (!pid) { if (alive()) setState({ phase: "ok", entries: [] }); return; }
      const { data, error } = await supabase.from("quick_check_results")
        .select("id,created_at,items,findings").eq("patient_id", pid)
        .order("created_at", { ascending: false }).limit(LIMIT);
      if (error) throw error;
      if (alive()) setState({ phase: "ok", entries: (data ?? []).map(historyEntry) });
    } catch (e) {
      // 삼키지 않는다 — 빈 목록("점검한 적이 없어요")으로 보이면 안 된다.
      console.warn("QuickCheckHistory: 조회 실패", (e as Error)?.message ?? e);
      if (alive()) setState({ phase: "error" });
    }
  }, []);

  useFocusEffect(useCallback(() => {
    let alive = true;
    void load(() => alive);
    return () => { alive = false; };
  }, [load]));

  const recheck = () => nav.navigate("QuickCheckInput");

  function open(e: HistoryEntry) {
    if (!e.params) {
      Alert.alert("열 수 없는 결과예요", "예전 버전에서 저장한 결과라 지금 화면으로 보여 드릴 수 없어요. 다시 점검해 주세요.");
      return;
    }
    nav.navigate("QuickCheckResult", e.params);
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="내 복용분석 결과 보기" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.lg }]}>
        {state.phase === "loading" ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.primaryBlue} /></View>
        ) : null}

        {state.phase === "error" ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>결과를 불러오지 못했어요</Text>
            <Text style={styles.emptyDesc}>인터넷 연결을 확인하고 다시 시도해 주세요.</Text>
            <BigButton label="다시 시도하기" variant="secondary" onPress={() => { void load(() => true); }} />
          </View>
        ) : null}

        {state.phase === "ok" && state.entries.length === 0 ? (
          <View style={styles.empty}>
            <ClipboardCheck size={40} color={colors.primaryBlue} />
            <Text style={styles.emptyTitle}>아직 저장된 결과가 없어요</Text>
            <Text style={styles.emptyDesc}>아래 「복용분석 다시하기」로 분석하면 결과가 여기에 쌓여요.</Text>
          </View>
        ) : null}

        {state.phase === "ok" ? state.entries.map((e) => (
          <Pressable key={e.id} onPress={() => open(e)} accessibilityRole="button"
            accessibilityLabel={`${koreanDateTime(e.createdAt)} 점검 결과 보기`}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
            <View style={styles.cardBody}>
              <Text style={styles.date}>{koreanDateTime(e.createdAt) || "날짜 없음"}</Text>
              {e.names.length > 0 ? <Text style={styles.names}>{historyNamesLine(e.names)}</Text> : null}
              <View style={[styles.badge, BADGE[badgeKind(e)].box]}>
                <Text style={[styles.badgeText, BADGE[badgeKind(e)].text]}>
                  {e.findingsCount === null ? "예전 결과" : e.findingsCount > 0 ? `확인 필요 ${e.findingsCount}건` : "주의 조합 없음"}
                </Text>
              </View>
            </View>
            <ChevronRight size={22} color={colors.textSecondary} />
          </Pressable>
        )) : null}
      </ScrollView>

      {/* 목록이 길어도 늘 보이게 화면 아래에 붙인다 */}
      <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
        <BigButton label="복용분석 다시하기" onPress={recheck} showArrow />
      </View>
    </View>
  );
}

// 목록 배지 — 확인 필요(빨강) · 없음(초록) · 열 수 없는 예전 결과(회색)
const badgeKind = (e: HistoryEntry): "warn" | "ok" | "old" =>
  e.findingsCount === null ? "old" : e.findingsCount > 0 ? "warn" : "ok";

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.md, gap: spacing.md },
  center: { alignItems: "center", marginTop: spacing.xl },
  empty: {
    alignItems: "center", gap: spacing.sm, padding: spacing.lg,
    backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: 1, borderRadius: radii.card,
  },
  emptyTitle: { fontSize: 22, fontWeight: "800", color: colors.primaryNavy, textAlign: "center" },
  emptyDesc: { fontSize: fontSizes.body, lineHeight: 27, color: colors.textSecondary, textAlign: "center" },
  card: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: minTouch,
    backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md, ...shadows.card,
  },
  cardBody: { flex: 1, gap: 6 },
  date: { fontSize: 19, fontWeight: "800", color: colors.primaryNavy },
  names: { fontSize: fontSizes.body, lineHeight: 26, color: colors.text },
  badge: { alignSelf: "flex-start", borderRadius: radii.pill, paddingHorizontal: 12, minHeight: 32, justifyContent: "center" },
  badgeText: { fontSize: fontSizes.body, fontWeight: "700" },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, backgroundColor: colors.canvas },
});

const BADGE = {
  warn: StyleSheet.create({ box: { backgroundColor: colors.dangerSoft }, text: { color: colors.dangerRed } }),
  ok: StyleSheet.create({ box: { backgroundColor: colors.successSoft }, text: { color: colors.successGreen } }),
  old: StyleSheet.create({ box: { backgroundColor: colors.canvasMuted }, text: { color: colors.textSecondary } }),
};

import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, Stethoscope, ShieldCheck } from "lucide-react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { IllustrationBanner } from "../components/IllustrationBanner";
import { supabase, Schedule } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { lookupIngredients, fetchContraindications } from "../lib/drugData";
import { allIngredients, matchFindings, Finding, MedIngredients } from "../lib/interactions";
import { colors, fontSizes, spacing, radii } from "../theme/tokens";

const SAFETY_ART = require("../../assets/illustrations/interaction-safety.png");

// D-03 주의 상세 (병용금기).
//
// 우리는 판단하지 않는다. 식약처 DUR 고시에 "함께 쓰지 말라"고 되어 있는 조합을
// 근거(고시번호)와 함께 그대로 전달하고, 확인은 약사·의사에게 맡긴다.
// 회의 결정대로 "약사에게 물어보기" 버튼은 두지 않고 문구로 갈음한다.

type State =
  | { phase: "loading" }
  | { phase: "unavailable" }              // 참조 데이터 미적재/네트워크 실패
  | { phase: "ok"; findings: Finding[] };

export function InteractionScreen() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    let alive = true;
    (async () => {
      const pid = await getPatientId();
      if (!pid) { if (alive) setState({ phase: "ok", findings: [] }); return; }
      const { data, error } = await supabase.from("schedules").select("*")
        .eq("patient_id", pid).eq("active", true);
      if (!alive) return;
      if (error) { setState({ phase: "unavailable" }); return; }

      // 같은 약이 여러 시간대로 등록돼 있어도 조합은 한 번만 본다.
      const names = [...new Set(((data ?? []) as Schedule[]).map((s) => s.medicine_name))];
      if (names.length < 2) { setState({ phase: "ok", findings: [] }); return; }

      const ing = await lookupIngredients(names);
      if (!alive) return;
      if (!ing.ready) { setState({ phase: "unavailable" }); return; }

      const meds: MedIngredients[] = names.map((n) => ({
        scheduleId: n, name: n, ingredients: ing.data[n] ?? [],
      }));
      const rules = await fetchContraindications(allIngredients(meds));
      if (!alive) return;
      if (!rules.ready) { setState({ phase: "unavailable" }); return; }

      setState({ phase: "ok", findings: matchFindings(meds, rules.data) });
    })();
    return () => { alive = false; };
  }, []);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="함께 드실 때 주의" />
      <ScrollView contentContainerStyle={[styles.c, { paddingBottom: spacing.xl + insets.bottom }]}>
        <IllustrationBanner source={SAFETY_ART} tone="coral" height={168} />
        {state.phase === "loading" ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primaryBlue} />
            <Text style={styles.centerText}>약 조합을 확인하고 있어요…</Text>
          </View>
        ) : null}

        {state.phase === "unavailable" ? (
          <View style={styles.center}>
            <Text style={styles.centerText}>
              주의 정보를 아직 확인할 수 없어요.{"\n"}인터넷 연결을 확인해 주세요.
            </Text>
          </View>
        ) : null}

        {state.phase === "ok" && state.findings.length === 0 ? (
          <View style={styles.safe}>
            <ShieldCheck size={44} color={colors.successGreen} />
            <Text style={styles.safeTitle}>확인된 주의 조합이 없어요</Text>
            <Text style={styles.safeDesc}>
              등록하신 약들 사이에 함께 쓰지 말라고 고시된 조합은 찾지 못했어요.
              다만 모든 경우를 다 담고 있지는 않으니, 새 약을 드시게 되면 약사에게 확인해 주세요.
            </Text>
          </View>
        ) : null}

        {state.phase === "ok" && state.findings.length > 0 ? (
          <>
            <View style={styles.lead}>
              <AlertTriangle size={26} color={colors.dangerRed} />
              <Text style={styles.leadText}>
                아래 {state.findings.length}건은 함께 드실 때 확인이 필요해요.
              </Text>
            </View>

            {state.findings.map((f, i) => (
              <View key={`${f.medA}|${f.medB}|${f.ingredientA}|${f.ingredientB}|${i}`} style={styles.card}>
                <View style={styles.pairRow}>
                  <Text style={styles.pairName}>{f.medA}</Text>
                  <Text style={styles.pairPlus}>+</Text>
                  <Text style={styles.pairName}>{f.medB}</Text>
                </View>
                <Text style={styles.ingredients}>{`성분: ${f.ingredientA} · ${f.ingredientB}`}</Text>
                {f.reason ? <Text style={styles.reason}>{f.reason}</Text> : null}
                {f.notice_no ? (
                  <Text style={styles.source}>{`근거: 식약처 DUR 고시 ${f.notice_no}`}</Text>
                ) : null}
              </View>
            ))}
          </>
        ) : null}

        {/* 약사 확인 안내 — 버튼 대신 문구 (회의 결정) */}
        <View style={styles.notice}>
          <Stethoscope size={22} color={colors.primaryNavy} />
          <Text style={styles.noticeText}>
            이 내용은 공개된 고시 자료를 그대로 알려드리는 것이에요. 스스로 약을 끊거나
            바꾸지 마시고,{" "}
            <Text style={styles.noticeStrong}>약사나 의사에게 꼭 확인하세요.</Text>
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  c: { padding: spacing.md, gap: spacing.md },
  center: { alignItems: "center", gap: spacing.md, marginTop: spacing.xl },
  centerText: { fontSize: 20, color: colors.textSecondary, textAlign: "center", lineHeight: 30 },
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
    borderRadius: radii.card, padding: spacing.md,
  },
  pairRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm },
  pairName: { fontSize: 22, fontWeight: "800", color: colors.primaryNavy },
  pairPlus: { fontSize: 22, fontWeight: "800", color: colors.dangerRed },
  ingredients: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: spacing.xs },
  reason: { fontSize: 19, color: colors.text, lineHeight: 29, marginTop: spacing.sm },
  source: { fontSize: 16, color: colors.textSecondary, marginTop: spacing.sm },
  notice: {
    flexDirection: "row", gap: spacing.sm, alignItems: "flex-start",
    backgroundColor: colors.lightBlueBg, borderRadius: radii.card, padding: spacing.md,
  },
  noticeText: { flex: 1, fontSize: 19, color: colors.primaryNavy, lineHeight: 28 },
  noticeStrong: { fontWeight: "800" },
});

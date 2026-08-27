import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ShieldCheck } from "lucide-react-native";
import { BigButton } from "../components/BigButton";
import { lookupIngredients, fetchContraindications } from "../lib/drugData";
import { allIngredients, matchFindings, Finding, MedIngredients } from "../lib/interactions";
import { checkItems, unmatchedNames } from "../lib/quickCheck";
import { loadDraft, saveDraft } from "../lib/quickCheckDraft";
import { colors, fontSizes, spacing, radii, shadows } from "../theme/tokens";

// 점검 중 화면 — 실제 DUR 병용금기 조회(InteractionScreen과 같은 경로)를 돌리면서
// 4단계 체크리스트를 순서대로 켠다. 조회가 순식간에 끝나도 최소 시간은 보여 준다 —
// 바로 넘어가면 "정말 봤나?" 싶어진다.

const STEPS = ["약과 영양제 조합 확인", "성분 확인", "주의 조합 대조", "결과 정리"] as const;
const MIN_MS = 2400;
const STEP_MS = MIN_MS / STEPS.length;

type Analysis = { ok: true; findings: Finding[]; unmatched: string[] } | { ok: false };

// 자료에서 제품을 못 찾은 이름(unmatched)은 대조에서 빠진다. 빈 성분으로 대조하면
// "이상 없음"이 나와 버리므로 결과 화면이 이 목록을 반드시 보여 준다.
async function analyze(names: string[]): Promise<Analysis> {
  const ing = await lookupIngredients(names);
  if (!ing.ready) return { ok: false };
  const unmatched = unmatchedNames(names, ing.data);
  const matched = names.filter((n) => !unmatched.includes(n));
  if (matched.length < 2) return { ok: true, findings: [], unmatched };
  const meds: MedIngredients[] = matched.map((n) => ({ scheduleId: n, name: n, ingredients: ing.data[n] }));
  const rules = await fetchContraindications(allIngredients(meds));
  if (!rules.ready) return { ok: false };
  return { ok: true, findings: matchFindings(meds, rules.data), unmatched };
}

export function QuickCheckAnalyzingScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [done, setDone] = useState(0);          // 켜진 체크 개수
  const [failed, setFailed] = useState<null | "network" | "storage">(null);
  const [attempt, setAttempt] = useState(0);

  const run = useCallback(async (alive: () => boolean) => {
    setFailed(null);
    setDone(0);
    // 체크리스트는 시간에 맞춰 켠다(조회 진행과 무관 — 조회는 보통 더 빨리 끝난다).
    const timers = STEPS.map((_, i) => setTimeout(() => { if (alive()) setDone(i + 1); }, STEP_MS * (i + 1)));
    const started = Date.now();
    try {
      const draft = await loadDraft();
      if (!draft) throw new Error("no draft");
      const r = await analyze(checkItems(draft));
      if (!alive()) return;
      // 실패는 바로 알린다 — 최소 표시 시간은 성공했을 때만 채운다.
      if (!r.ok) { timers.forEach(clearTimeout); setFailed("network"); return; }
      try {
        await saveDraft({ ...draft, findings: r.findings, unmatched: r.unmatched, analyzedAt: new Date().toISOString() });
      } catch {
        timers.forEach(clearTimeout);
        if (alive()) setFailed("storage");
        return;
      }
      const wait = Math.max(0, MIN_MS - (Date.now() - started));
      await new Promise((res) => setTimeout(res, wait));
      if (!alive()) return;
      nav.replace("QuickCheckResult");
    } catch {
      timers.forEach(clearTimeout);
      if (alive()) setFailed("network");
    }
    return () => timers.forEach(clearTimeout);
  }, [nav]);

  useEffect(() => {
    let alive = true;
    const cleanup = run(() => alive);
    return () => { alive = false; void cleanup.then((c) => c && c()); };
  }, [run, attempt]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.c, { paddingBottom: spacing.xl + insets.bottom }]}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            {failed ? <ShieldCheck size={44} color={colors.textSecondary} /> : <ActivityIndicator size="large" color={colors.primaryBlue} />}
          </View>
          <Text style={styles.title}>{failed ? "점검을 마치지 못했어요" : "복용 조합을 점검하고 있어요"}</Text>
          <Text style={styles.sub}>
            {failed === "storage"
              ? "결과를 기기에 저장하지 못했어요. 저장 공간을 확인하고 다시 시도해 주세요."
              : failed === "network"
                ? "인터넷 연결을 확인하고 다시 시도해 주세요. 지금 건너뛰어도 가입 후 다시 점검할 수 있어요."
                : "식약처 병용금기 자료와 대조합니다. 잠시만 기다려 주세요."}
          </Text>
        </View>

        <View style={styles.list}>
          {STEPS.map((label, i) => {
            const on = i < done && !failed;
            const active = i === done && !failed;
            return (
              <View key={label} style={[styles.row, on && styles.rowOn]}>
                <View style={[styles.mark, on && styles.markOn]}>
                  {on ? <Check size={20} strokeWidth={3} color={colors.white} /> : active ? <ActivityIndicator size="small" color={colors.primaryBlue} /> : null}
                </View>
                <Text style={[styles.rowText, on && styles.rowTextOn]}>{label}</Text>
              </View>
            );
          })}
        </View>

        {failed ? (
          <View style={styles.actions}>
            <BigButton label="다시 시도" onPress={() => setAttempt((a) => a + 1)} />
            <BigButton label="건너뛰고 가입하기" variant="secondary" onPress={() => nav.reset({ index: 0, routes: [{ name: "RoleSelect" }] })} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  c: { paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, gap: spacing.lg },
  hero: { alignItems: "center", gap: spacing.md },
  heroIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "800", color: colors.primaryNavy, textAlign: "center", letterSpacing: -0.5 },
  sub: { fontSize: fontSizes.body, lineHeight: 27, color: colors.textSecondary, textAlign: "center" },
  list: { gap: spacing.sm },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 64,
    paddingHorizontal: spacing.md, borderRadius: radii.card,
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, ...shadows.card,
  },
  rowOn: { borderColor: colors.primaryBlue },
  mark: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.canvasMuted, alignItems: "center", justifyContent: "center" },
  markOn: { backgroundColor: colors.successGreen },
  rowText: { fontSize: 20, fontWeight: "700", color: colors.textSecondary },
  rowTextOn: { color: colors.text },
  actions: { gap: spacing.xs },
});

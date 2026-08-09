import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, ActivityIndicator } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pill, Trash2, Stethoscope, AlertTriangle, ChevronRight } from "lucide-react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { supabase, Schedule } from "../lib/supabase";
import { cancelSchedule } from "../lib/notifications";
import { MED_KINDS, MedKind } from "../lib/medKind";
import { getKindMap, resolveKind, setKind } from "../lib/medStore";
import { fetchDrugInfo, lookupIngredients, fetchContraindications } from "../lib/drugData";
import { allIngredients, matchFindings, MedIngredients } from "../lib/interactions";
import { getPatientId } from "../lib/storage";
import { colors, fontSizes, spacing, radii, minTouch } from "../theme/tokens";

// D-02 약 상세.
// 회의 결정:
//   · 수정 버튼은 삭제 — 시간 변경은 '내 약장'에서 왼쪽으로 밀어서 한다. 여기는 "이 약이 뭔지" 보는 화면.
//   · "약사에게 물어보기" 버튼 제거 — 약사 시스템은 추후. 지금은 확인을 권하는 문구로 갈음.
//   · 상세 내용은 우리 데이터에 없으면 AI가 채운다.

export function MedicineDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const scheduleId: string | undefined = route.params?.scheduleId;

  const [sched, setSched] = useState<Schedule | null>(null);
  const [kind, setKindState] = useState<MedKind | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [warnCount, setWarnCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!scheduleId) return;
      const { data } = await supabase.from("schedules").select("*").eq("id", scheduleId).single();
      if (!alive || !data) return;
      const s = data as Schedule;
      setSched(s);
      setKindState(resolveKind(s.medicine_name, await getKindMap()));

      // AI 설명 — 엣지 함수에 ?op=druginfo 가 배포돼 있어야 온다. 없으면 조용히 비운다.
      setInfoLoading(true);
      const text = await fetchDrugInfo(s.medicine_name);
      if (alive) { setInfo(text); setInfoLoading(false); }
    })();
    return () => { alive = false; };
  }, [scheduleId]);

  // 이 약이 다른 약과 부딪치는지 — 약장 배너와 같은 판정을 이 약 기준으로만 센다.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!sched) return;
      const pid = await getPatientId();
      if (!pid) return;
      const { data } = await supabase.from("schedules").select("*")
        .eq("patient_id", pid).eq("active", true);
      const names = [...new Set(((data ?? []) as Schedule[]).map((s) => s.medicine_name))];
      if (names.length < 2) { if (alive) setWarnCount(0); return; }
      const ing = await lookupIngredients(names);
      if (!ing.ready) { if (alive) setWarnCount(null); return; }
      const meds: MedIngredients[] = names.map((n) => ({ scheduleId: n, name: n, ingredients: ing.data[n] ?? [] }));
      const rules = await fetchContraindications(allIngredients(meds));
      if (!rules.ready) { if (alive) setWarnCount(null); return; }
      const mine = matchFindings(meds, rules.data)
        .filter((f) => f.medA === sched.medicine_name || f.medB === sched.medicine_name);
      if (alive) setWarnCount(mine.length);
    })();
    return () => { alive = false; };
  }, [sched]);

  const chooseKind = useCallback(async (k: MedKind) => {
    if (!sched) return;
    setKindState(k);
    await setKind(sched.medicine_name, k);
  }, [sched]);

  function confirmDelete() {
    if (!sched) return;
    Alert.alert(`'${sched.medicine_name}' 삭제`, "이 복약 일정과 알림을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제", style: "destructive",
        onPress: async () => {
          try {
            // 하드 삭제하면 복약 기록이 cascade로 사라진다 — 비활성화로 목록에서만 뺀다.
            const { error } = await supabase.from("schedules").update({ active: false }).eq("id", sched.id);
            if (error) throw error;
            await cancelSchedule(sched.id);
            nav.goBack();
          } catch {
            Alert.alert("삭제에 실패했어요", "인터넷 연결을 확인하고 다시 시도해 주세요.");
          }
        },
      },
    ]);
  }

  if (!sched) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="약 상세" />
        <Text style={styles.loading}>불러오는 중...</Text>
      </View>
    );
  }

  const timeText = `${sched.time_of_day} · ${String(sched.hour).padStart(2, "0")}:${String(sched.minute).padStart(2, "0")}`;
  const repeatText = (sched.repeat_days?.length ?? 0) > 0 ? "요일 반복" : "매일";

  return (
    <View style={styles.screen}>
      <ScreenHeader title="약 상세" />
      <ScrollView contentContainerStyle={[styles.c, { paddingBottom: spacing.xl + insets.bottom }]}>
        {/* 이름 · 복용 시각 */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}><Pill size={30} color={colors.primaryBlue} /></View>
          <Text style={styles.name}>{sched.medicine_name}</Text>
          <Text style={styles.time}>{`${timeText}  (${repeatText})`}</Text>
        </View>

        {/* 주의 — 있을 때만 */}
        {warnCount !== null && warnCount > 0 ? (
          <Pressable
            onPress={() => nav.navigate("Interaction")}
            style={({ pressed }) => [styles.warn, pressed && { opacity: 0.92 }]}
          >
            <AlertTriangle size={24} color={colors.dangerRed} />
            <Text style={styles.warnText}>이 약과 함께 드실 때 확인이 필요한 조합 {warnCount}건</Text>
            <ChevronRight size={22} color={colors.dangerRed} />
          </Pressable>
        ) : null}

        {/* 구분 — 자동 분류가 안 되는 약은 사용자가 직접 고른다 (회의 결정) */}
        <Text style={styles.section}>약 구분</Text>
        <View style={styles.kindRow}>
          {MED_KINDS.map((k) => (
            <Pressable
              key={k}
              onPress={() => { void chooseKind(k); }}
              style={[styles.kindChip, kind === k && styles.kindChipOn]}
            >
              <Text style={[styles.kindText, kind === k && styles.kindTextOn]}>{k}</Text>
            </Pressable>
          ))}
        </View>
        {kind === null ? <Text style={styles.hint}>아직 정해지지 않았어요. 눌러서 골라 주세요.</Text> : null}

        {/* 약 설명 */}
        <Text style={styles.section}>이 약은 어떤 약인가요</Text>
        <View style={styles.card}>
          {infoLoading ? (
            <View style={styles.infoLoading}>
              <ActivityIndicator color={colors.primaryBlue} />
              <Text style={styles.infoLoadingText}>약 정보를 찾고 있어요…</Text>
            </View>
          ) : info ? (
            <Text style={styles.infoText}>{info}</Text>
          ) : (
            <Text style={styles.infoEmpty}>
              이 약의 설명은 아직 준비 중이에요.{"\n"}약사나 의사에게 확인해 주세요.
            </Text>
          )}
        </View>

        {/* 약사 확인 안내 — "약사에게 물어보기" 버튼 대신 문구로 (회의 결정) */}
        <View style={styles.notice}>
          <Stethoscope size={22} color={colors.primaryNavy} />
          <Text style={styles.noticeText}>
            이 앱의 설명은 참고용이에요. 약을 바꾸거나 끊기 전에는{" "}
            <Text style={styles.noticeStrong}>약사나 의사에게 꼭 확인하세요.</Text>
          </Text>
        </View>

        <Pressable
          onPress={confirmDelete}
          style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.85 }]}
        >
          <Trash2 size={20} color={colors.dangerRed} />
          <Text style={styles.deleteText}>이 약 삭제</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7FAFF" },
  c: { padding: spacing.md },
  loading: { textAlign: "center", fontSize: fontSizes.body, color: colors.textSecondary, marginTop: spacing.lg },
  hero: {
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.lg, alignItems: "center",
  },
  heroIcon: {
    width: 64, height: 64, borderRadius: 999, backgroundColor: colors.lightBlueBg,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
  },
  name: { fontSize: 28, fontWeight: "800", color: colors.primaryNavy, textAlign: "center" },
  time: { fontSize: 20, color: colors.textSecondary, marginTop: spacing.xs },
  warn: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: "#FFF0F0", borderColor: colors.dangerRed, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md, marginTop: spacing.md,
  },
  warnText: { flex: 1, fontSize: 19, fontWeight: "700", color: colors.dangerRed, lineHeight: 26 },
  section: { fontSize: 24, fontWeight: "800", color: colors.primaryNavy, marginTop: spacing.lg, marginBottom: spacing.sm },
  kindRow: { flexDirection: "row", gap: spacing.sm },
  kindChip: {
    flex: 1, minHeight: minTouch, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.button,
  },
  kindChipOn: { backgroundColor: colors.primaryBlue, borderColor: colors.primaryBlue },
  kindText: { fontSize: 20, fontWeight: "700", color: colors.text },
  kindTextOn: { color: "#fff" },
  hint: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: spacing.sm },
  card: {
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md,
  },
  infoText: { fontSize: 19, color: colors.text, lineHeight: 30 },
  infoEmpty: { fontSize: 19, color: colors.textSecondary, lineHeight: 30 },
  infoLoading: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  infoLoadingText: { fontSize: fontSizes.body, color: colors.textSecondary },
  notice: {
    flexDirection: "row", gap: spacing.sm, alignItems: "flex-start",
    backgroundColor: colors.lightBlueBg, borderRadius: radii.card,
    padding: spacing.md, marginTop: spacing.md,
  },
  noticeText: { flex: 1, fontSize: 19, color: colors.primaryNavy, lineHeight: 28 },
  noticeStrong: { fontWeight: "800" },
  deleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    minHeight: minTouch, borderRadius: radii.button, marginTop: spacing.lg,
    backgroundColor: colors.cardBg, borderColor: colors.dangerRed, borderWidth: 1,
  },
  deleteText: { fontSize: 20, fontWeight: "700", color: colors.dangerRed },
});

import React, { useCallback, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, AlertTriangle, ChevronRight, Pencil, Trash2, Pill } from "lucide-react-native";
import { supabase, Schedule } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { cancelSchedule } from "../lib/notifications";
import { MedKind } from "../lib/medKind";
import { getKindMap, resolveKind } from "../lib/medStore";
import { lookupIngredients, fetchContraindications } from "../lib/drugData";
import { allIngredients, matchFindings, MedIngredients, Finding } from "../lib/interactions";
import { groupByMedicine, describeDoses, describeRepeat, MedGroup } from "../lib/medSummary";
import { colors, fontSizes, spacing, radii, minTouch } from "../theme/tokens";

// D-01 내 약장 — 확정 시안 기준.
// 상단 요약(전체/처방약/일반약/건기식) → 주의 배너 → 필터 탭 → 약 카드 목록.
// 유효기간(「46일 남았어요」)은 넣지 않는다 — 실제 처방 데이터가 있어야 의미가 있어
// 회의에서 보류로 정리됐다.

type Filter = "전체" | MedKind;
const FILTERS: readonly Filter[] = ["전체", "처방약", "일반약", "건기식"] as const;

const KIND_LABEL: Record<MedKind | "미분류", string> = {
  처방약: "처방약", 일반약: "일반약", 건기식: "건기식", 미분류: "미분류",
};
const KIND_COLOR: Record<MedKind | "미분류", string> = {
  처방약: colors.primaryBlue,
  일반약: colors.secondaryBlue,
  건기식: colors.successGreen,
  미분류: colors.textSecondary,
};

export function CabinetScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Schedule[]>([]);
  const [kinds, setKinds] = useState<Record<string, MedKind>>({});
  const [findings, setFindings] = useState<Finding[] | null>(null); // null = 확인 못 함
  const [filter, setFilter] = useState<Filter>("전체");

  const load = useCallback(async () => {
    const pid = await getPatientId();
    if (!pid) return;
    const { data } = await supabase.from("schedules").select("*")
      .eq("patient_id", pid).eq("active", true).order("hour");
    const list = (data ?? []) as Schedule[];
    setItems(list);
    setKinds(await getKindMap());

    // 병용금기 — 실패하면 배너를 숨기고 약장은 그대로 보여준다.
    const names = [...new Set(list.map((s) => s.medicine_name))];
    if (names.length < 2) { setFindings([]); return; }
    const ing = await lookupIngredients(names);
    if (!ing.ready) { setFindings(null); return; }
    const meds: MedIngredients[] = names.map((n) => ({ scheduleId: n, name: n, ingredients: ing.data[n] ?? [] }));
    const rules = await fetchContraindications(allIngredients(meds));
    if (!rules.ready) { setFindings(null); return; }
    setFindings(matchFindings(meds, rules.data));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // 열려 있는 스와이프는 하나만 — 다음 행을 열면 이전 행이 닫힌다.
  const rowRefs = useRef<Record<string, Swipeable>>({});
  const openRef = useRef<Swipeable | null>(null);
  function closeOpen(except?: Swipeable | null) {
    if (openRef.current && openRef.current !== except) openRef.current.close();
  }

  // 약 하나를 지우면 그 약의 모든 시간대 일정이 함께 사라져야 한다
  // (아침·저녁 두 행 중 하나만 남으면 사용자에겐 "안 지워진" 것으로 보인다).
  function confirmDelete(g: MedGroup<Schedule>) {
    const many = g.doses.length > 1 ? `\n(${g.doses.length}개 시간대 모두)` : "";
    Alert.alert(`'${g.name}' 삭제`, `이 약의 복약 일정과 알림을 삭제할까요?${many}`, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제", style: "destructive",
        onPress: async () => {
          try {
            for (const d of g.doses) {
              // 하드 삭제하면 복약 기록이 cascade로 사라진다 — 비활성화로 목록에서만 뺀다.
              const { error } = await supabase.from("schedules").update({ active: false }).eq("id", d.id);
              if (error) throw error;
              await cancelSchedule(d.id);
            }
            await load();
          } catch {
            Alert.alert("삭제에 실패했어요", "인터넷 연결을 확인하고 다시 시도해 주세요.");
          }
        },
      },
    ]);
  }

  function renderActions(g: MedGroup<Schedule>) {
    return (
      <View style={styles.actions}>
        <Pressable
          onPress={() => { closeOpen(); nav.navigate("ButtonRegister", { editId: g.doses[0].id }); }}
          style={[styles.actionBtn, { backgroundColor: colors.primaryBlue }]}
        >
          <Pencil size={22} color="#fff" />
          <Text style={styles.actionText}>수정</Text>
        </Pressable>
        <Pressable
          onPress={() => { closeOpen(); confirmDelete(g); }}
          style={[styles.actionBtn, { backgroundColor: colors.dangerRed }]}
        >
          <Trash2 size={22} color="#fff" />
          <Text style={styles.actionText}>삭제</Text>
        </Pressable>
      </View>
    );
  }

  // 같은 약을 한 장의 카드로 묶는다(아침·저녁 = 1개 약, 1일 2회).
  const groups = groupByMedicine(items);
  const kindOf = (name: string): MedKind | "미분류" => resolveKind(name, kinds) ?? "미분류";
  const counts = { 전체: groups.length, 처방약: 0, 일반약: 0, 건기식: 0 } as Record<Filter, number>;
  for (const g of groups) {
    const k = kindOf(g.name);
    if (k !== "미분류") counts[k]++;
  }
  // 미분류 약은 어느 구분 탭에도 안 잡히므로 '전체'에서만 보인다.
  const shown = filter === "전체" ? groups : groups.filter((g) => kindOf(g.name) === filter);

  return (
    <View style={styles.screen}>
      {/* 헤더 — 시안대로 우상단에 + 버튼 */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerSide} />
        <Text style={styles.headerTitle}>내 약장</Text>
        <Pressable
          onPress={() => nav.navigate("RegisterMethod")}
          style={({ pressed }) => [styles.headerSide, pressed && { opacity: 0.7 }]}
          hitSlop={10}
        >
          <Plus size={30} color={colors.primaryBlue} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: spacing.xl + insets.bottom }]}>
        {/* 요약 4칸 */}
        <View style={styles.summary}>
          {FILTERS.map((f) => (
            <View key={f} style={styles.summaryCell}>
              <Text style={[styles.summaryNum, f !== "전체" && { color: KIND_COLOR[f] }]}>{counts[f]}</Text>
              <Text style={styles.summaryLabel}>{f}</Text>
            </View>
          ))}
        </View>

        {/* 주의 배너 — 걸리는 조합의 실제 약 이름을 보여준다 */}
        {findings && findings.length > 0 ? (
          <Pressable
            onPress={() => nav.navigate("Interaction")}
            style={({ pressed }) => [styles.warn, pressed && { opacity: 0.92 }]}
          >
            <View style={styles.warnHead}>
              <AlertTriangle size={22} color={colors.warningOrange} />
              <Text style={styles.warnTitle}>함께 드실 때 주의 {findings.length}건</Text>
              <ChevronRight size={22} color={colors.warningOrange} />
            </View>
            <Text style={styles.warnPair} numberOfLines={2}>
              {`${findings[0].medA} + ${findings[0].medB}`}
              {findings.length > 1 ? ` 외 ${findings.length - 1}건` : ""}
            </Text>
          </Pressable>
        ) : null}

        {/* 필터 탭 */}
        <View style={styles.tabs}>
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              onPress={() => { closeOpen(); setFilter(f); }}
              style={[styles.tab, filter === f && styles.tabOn]}
            >
              <Text style={[styles.tabText, filter === f && styles.tabTextOn]}>{f}</Text>
            </Pressable>
          ))}
        </View>

        {groups.length === 0 ? (
          <Text style={styles.empty}>약장이 비어 있어요.{"\n"}오른쪽 위 + 를 눌러 약을 등록해 주세요.</Text>
        ) : shown.length === 0 ? (
          <Text style={styles.empty}>{`${filter}으로 등록된 약이 없어요.`}</Text>
        ) : (
          <Text style={styles.swipeHint}>약을 왼쪽으로 밀면 수정·삭제할 수 있어요.</Text>
        )}

        {shown.map((g) => {
          const k = kindOf(g.name);
          const color = KIND_COLOR[k];
          return (
            <Swipeable
              key={g.name}
              ref={(r) => { if (r) rowRefs.current[g.name] = r; }}
              renderRightActions={() => renderActions(g)}
              onSwipeableWillOpen={() => {
                closeOpen(rowRefs.current[g.name]);
                openRef.current = rowRefs.current[g.name] ?? null;
              }}
              overshootRight={false}
            >
              <Pressable
                onPress={() => nav.navigate("MedicineDetail", { scheduleId: g.doses[0].id })}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
              >
                <View style={[styles.iconBox, { backgroundColor: color + "1A" }]}>
                  <Pill size={22} color={color} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={2}>{g.name}</Text>
                  <View style={styles.metaRow}>
                    <View style={[styles.kindBadge, { backgroundColor: color + "1A" }]}>
                      <Text style={[styles.kindText, { color }]}>{KIND_LABEL[k]}</Text>
                    </View>
                    <Text style={styles.meta} numberOfLines={1}>{describeDoses(g)}</Text>
                  </View>
                  <Text style={styles.sub}>
                    {describeRepeat(g)}
                    {g.doseAmount ? ` · 1회 ${g.doseAmount}` : ""}
                  </Text>
                </View>
                <ChevronRight size={22} color={colors.textSecondary} />
              </Pressable>
            </Swipeable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7FAFF" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.cardBg, paddingHorizontal: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerSide: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 26, fontWeight: "800", color: colors.primaryNavy },
  list: { padding: spacing.md, gap: spacing.md },
  summary: {
    flexDirection: "row", backgroundColor: colors.cardBg,
    borderColor: colors.border, borderWidth: 1, borderRadius: radii.card,
    paddingVertical: spacing.md,
  },
  summaryCell: { flex: 1, alignItems: "center" },
  summaryNum: { fontSize: 30, fontWeight: "800", color: colors.primaryNavy },
  summaryLabel: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: 2 },
  warn: {
    backgroundColor: "#FFF8EC", borderColor: colors.warningOrange, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md,
  },
  warnHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  warnTitle: { flex: 1, fontSize: 21, fontWeight: "800", color: "#8A5A00" },
  warnPair: { fontSize: fontSizes.body, color: "#8A5A00", marginTop: 6, lineHeight: 25 },
  tabs: {
    flexDirection: "row", backgroundColor: colors.lightBlueBg,
    borderRadius: radii.pill, padding: 4,
  },
  tab: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.pill },
  tabOn: { backgroundColor: colors.cardBg },
  tabText: { fontSize: fontSizes.body, fontWeight: "700", color: colors.textSecondary },
  tabTextOn: { color: colors.primaryNavy },
  swipeHint: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: -spacing.xs },
  card: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md, minHeight: 88,
  },
  iconBox: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  info: { flex: 1 },
  name: { fontSize: 21, fontWeight: "800", color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 5 },
  kindBadge: { borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 3 },
  kindText: { fontSize: 14, fontWeight: "700" },
  meta: { flex: 1, fontSize: fontSizes.body, color: colors.textSecondary },
  sub: { fontSize: 16, color: colors.textSecondary, marginTop: 3 },
  empty: {
    fontSize: 20, color: colors.textSecondary, textAlign: "center",
    marginTop: spacing.lg, lineHeight: 30,
  },
  actions: { flexDirection: "row", alignItems: "stretch" },
  actionBtn: {
    width: 84, alignItems: "center", justifyContent: "center", gap: 4,
    marginLeft: spacing.sm, borderRadius: radii.card,
  },
  actionText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  // (minTouch는 스와이프 액션 최소 높이 기준으로 유지)
  _touch: { minHeight: minTouch },
});

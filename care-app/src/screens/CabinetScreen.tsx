import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pill, Leaf, FileText, HelpCircle, AlertTriangle, ChevronRight } from "lucide-react-native";
import { BigButton } from "../components/BigButton";
import { ScreenHeader } from "../components/ScreenHeader";
import { supabase, Schedule } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { MedKind, groupByKind } from "../lib/medKind";
import { getKindMap, resolveKind } from "../lib/medStore";
import { lookupIngredients, fetchContraindications } from "../lib/drugData";
import { allIngredients, matchFindings, MedIngredients } from "../lib/interactions";
import { colors, fontSizes, spacing, radii } from "../theme/tokens";

// D-01 내 약장 — 내가 먹는 약 전부를 구분(처방약/일반약/건기식)별로 모아 본다.
// 회의 결정대로 유효기간은 넣지 않는다(실제 처방 데이터가 있어야 의미가 있어 보류).

type KindIcon = React.ComponentType<{ size?: number; color?: string }>;
const KIND_META: Record<MedKind | "미분류", { Icon: KindIcon; color: string; desc: string }> = {
  처방약: { Icon: FileText, color: colors.primaryBlue, desc: "처방을 받아 드시는 약" },
  일반약: { Icon: Pill, color: colors.secondaryBlue, desc: "약국에서 살 수 있는 약" },
  건기식: { Icon: Leaf, color: colors.successGreen, desc: "건강기능식품" },
  미분류: { Icon: HelpCircle, color: colors.textSecondary, desc: "눌러서 구분을 정해 주세요" },
};

export function CabinetScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Schedule[]>([]);
  const [kinds, setKinds] = useState<Record<string, MedKind>>({});
  const [warnCount, setWarnCount] = useState<number | null>(null); // null = 아직 확인 안 됨/준비 안 됨

  const load = useCallback(async () => {
    const pid = await getPatientId();
    if (!pid) return;
    const { data } = await supabase.from("schedules").select("*")
      .eq("patient_id", pid).eq("active", true).order("hour");
    const list = (data ?? []) as Schedule[];
    setItems(list);
    setKinds(await getKindMap());

    // 병용금기 확인은 부가 정보 — 실패하면 배너를 숨기고 약장은 그대로 보여준다.
    // 같은 약 이름이 여러 시간대로 등록돼 있으면 한 번만 본다(중복 경고 방지).
    const uniqueNames = [...new Set(list.map((s) => s.medicine_name))];
    if (uniqueNames.length < 2) { setWarnCount(0); return; }
    const ing = await lookupIngredients(uniqueNames);
    if (!ing.ready) { setWarnCount(null); return; }
    const meds: MedIngredients[] = uniqueNames.map((n) => ({
      scheduleId: n, name: n, ingredients: ing.data[n] ?? [],
    }));
    const rules = await fetchContraindications(allIngredients(meds));
    if (!rules.ready) { setWarnCount(null); return; }
    setWarnCount(matchFindings(meds, rules.data).length);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const groups = groupByKind(items, (s) => resolveKind(s.medicine_name, kinds));

  return (
    <View style={styles.screen}>
      <ScreenHeader title="내 약장" showBack={false} />
      <ScrollView contentContainerStyle={styles.list}>
        {/* 주의 배너 — 걸리는 게 있을 때만. 판단은 우리가 하지 않고 확인을 권한다. */}
        {warnCount !== null && warnCount > 0 ? (
          <Pressable
            onPress={() => nav.navigate("Interaction")}
            style={({ pressed }) => [styles.warn, pressed && { opacity: 0.92 }]}
          >
            <AlertTriangle size={24} color={colors.dangerRed} />
            <Text style={styles.warnText}>
              함께 드실 때 확인이 필요한 조합이 {warnCount}건 있어요
            </Text>
            <ChevronRight size={22} color={colors.dangerRed} />
          </Pressable>
        ) : null}

        {items.length === 0 ? (
          <Text style={styles.empty}>약장이 비어 있어요.{"\n"}아래에서 약을 등록해 주세요.</Text>
        ) : null}

        {groups.map(({ kind, items: group }) => {
          const { Icon, color, desc } = KIND_META[kind];
          return (
            <View key={kind} style={styles.group}>
              <View style={styles.groupHead}>
                <Icon size={22} color={color} />
                <Text style={[styles.groupTitle, { color }]}>{kind}</Text>
                <Text style={styles.groupCount}>{group.length}개</Text>
              </View>
              <Text style={styles.groupDesc}>{desc}</Text>
              {group.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => nav.navigate("MedicineDetail", { scheduleId: s.id })}
                  style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
                >
                  <View style={[styles.iconBox, { backgroundColor: color + "1A" }]}>
                    <Icon size={22} color={color} />
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.name}>{s.medicine_name}</Text>
                    <Text style={styles.time}>
                      {`${s.time_of_day} · ${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`}
                      {(s.repeat_days?.length ?? 0) > 0 ? "  (요일 반복)" : "  (매일)"}
                    </Text>
                  </View>
                  <ChevronRight size={22} color={colors.textSecondary} />
                </Pressable>
              ))}
            </View>
          );
        })}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>
        <BigButton label="+ 약 등록하기" onPress={() => nav.navigate("RegisterMethod")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7FAFF" },
  list: { padding: spacing.md, gap: spacing.md },
  warn: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: "#FFF0F0", borderColor: colors.dangerRed, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md,
  },
  warnText: { flex: 1, fontSize: 20, fontWeight: "700", color: colors.dangerRed, lineHeight: 27 },
  group: { gap: spacing.sm },
  groupHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  groupTitle: { fontSize: 24, fontWeight: "800" },
  groupCount: { fontSize: fontSizes.body, color: colors.textSecondary },
  groupDesc: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: -4 },
  card: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md, minHeight: 76,
  },
  iconBox: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  info: { flex: 1 },
  name: { fontSize: 22, fontWeight: "700", color: colors.text },
  time: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: 3 },
  footer: {
    padding: spacing.lg, backgroundColor: colors.cardBg,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  empty: {
    fontSize: 20, color: colors.textSecondary, textAlign: "center",
    marginTop: spacing.xl, lineHeight: 30,
  },
});

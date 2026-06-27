import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pill, Pencil, Trash2 } from "lucide-react-native";
import { BigButton } from "../components/BigButton";
import { ScreenHeader } from "../components/ScreenHeader";
import { supabase, Schedule } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { cancelSchedule } from "../lib/notifications";
import { spacing, fontSizes, colors, radii } from "../theme/tokens";

export function MedicineListScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Schedule[]>([]);

  const load = useCallback(async () => {
    const pid = await getPatientId(); if (!pid) return;
    const { data } = await supabase.from("schedules").select("*")
      .eq("patient_id", pid).eq("active", true).order("hour"); // 활성 일정만(비활성=이력 보존용)
    setItems(data ?? []);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function confirmDelete(s: Schedule) {
    Alert.alert(`'${s.medicine_name}' 삭제`, "이 복약 일정과 알림을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제", style: "destructive",
        onPress: async () => {
          try {
            // 하드 삭제하면 intake_records가 cascade로 함께 지워져 보호자 이력이 사라진다.
            // 비활성화(active=false)로 목록에서 빼고 과거 기록은 보존. 성공 후 알림 취소.
            const { error } = await supabase.from("schedules").update({ active: false }).eq("id", s.id);
            if (error) throw error;
            await cancelSchedule(s.id);
            await load();
          } catch {
            Alert.alert("삭제에 실패했어요", "인터넷 연결을 확인하고 다시 시도해 주세요.");
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="복약 관리" />
      <ScrollView contentContainerStyle={styles.list}>
        {items.length === 0 ? <Text style={styles.empty}>등록된 약이 없어요.</Text> : null}
        {items.map((s) => (
          <View key={s.id} style={styles.card}>
            <View style={styles.iconBox}><Pill size={22} color={colors.primaryBlue} /></View>
            <View style={styles.info}>
              <Text style={styles.name}>{s.medicine_name}</Text>
              <Text style={styles.time}>
                {`${s.time_of_day} · ${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`}
                {(s.repeat_days?.length ?? 0) > 0 ? "  (요일 반복)" : "  (매일)"}
              </Text>
            </View>
            <Pressable style={styles.actBtn} onPress={() => nav.navigate("ButtonRegister", { editId: s.id })} hitSlop={8}>
              <Pencil size={20} color={colors.primaryBlue} />
            </Pressable>
            <Pressable style={styles.actBtn} onPress={() => confirmDelete(s)} hitSlop={8}>
              <Trash2 size={20} color={colors.dangerRed} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
      {/* 등록 버튼 — 시스템 네비게이션 바와 겹치지 않게 하단 여백 확보 */}
      <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>
        <BigButton label="+ 약 등록하기" onPress={() => nav.navigate("RegisterMethod")} />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7FAFF" },
  list: { padding: spacing.lg, gap: spacing.sm },
  card: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md,
  },
  iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.lightBlueBg, alignItems: "center", justifyContent: "center" },
  info: { flex: 1 },
  name: { fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.text },
  time: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: 2 },
  actBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  empty: { fontSize: fontSizes.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});

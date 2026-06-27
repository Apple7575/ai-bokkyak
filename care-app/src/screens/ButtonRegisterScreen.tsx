import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet, Alert } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pill } from "lucide-react-native";
import { BigButton } from "../components/BigButton";
import { ScreenHeader } from "../components/ScreenHeader";
import { TimeChip } from "../components/TimeChip";
import { WheelPicker } from "../components/WheelPicker";
import { supabase } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { ensurePermission, scheduleReminders, cancelSchedule } from "../lib/notifications";
import { ensureStrongAlarmReady } from "../lib/alarmPermissions";
import { normalizeRepeatDays } from "../lib/schedule";
import { colors, fontSizes, spacing, radii } from "../theme/tokens";

const TODS = ["아침", "점심", "저녁", "취침"];
const HOUR_VALUES = Array.from({ length: 24 }, (_, i) => i);   // 0~23시 전부 스크롤로 선택
const MINUTE_VALUES = Array.from({ length: 60 }, (_, i) => i); // 0~59분 전부 스크롤로 선택
const DAYS = ["일", "월", "화", "수", "목", "금", "토"]; // index 0=일 … 6=토

export function ButtonRegisterScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const editId: string | undefined = useRoute<any>().params?.editId;
  const [name, setName] = useState("");
  const [tod, setTod] = useState("아침");
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  // 빈 배열 = 매일(설계 결정 #1). 요일 칩을 토글하면 해당 요일만 반복.
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false); // 더블탭 동기 가드(state는 비동기)

  // 수정 모드: 기존 일정을 불러와 폼을 채운다.
  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { data } = await supabase.from("schedules").select("*").eq("id", editId).single();
      if (data) {
        setName(data.medicine_name); setTod(data.time_of_day);
        setHour(data.hour); setMinute(data.minute); setRepeatDays(data.repeat_days ?? []);
      }
    })();
  }, [editId]);

  function toggleDay(d: number) {
    setRepeatDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  }

  async function save() {
    if (savingRef.current) return;
    if (!name.trim()) { Alert.alert("약 이름을 입력해 주세요"); return; }
    savingRef.current = true; // 첫 await 전에 동기 잠금
    setSaving(true);
    const pid = await getPatientId();
    if (!pid) { savingRef.current = false; setSaving(false); return; }
    const days = normalizeRepeatDays(repeatDays); // 정렬·중복제거된 int[], 빈배열=매일
    const row = { medicine_name: name.trim(), time_of_day: tod, hour, minute, repeat_days: days, active: true };
    await ensureStrongAlarmReady();
    try {
      if (editId) {
        // 이력 보존: 시간/요일을 바꾸면 과거 기록의 due-slot 기준이 깨지므로, 기존 행을 직접 고치지 않고
        // "새 활성 일정 등록 + 기존 비활성화"로 처리(과거 intake_records는 기존 행 기준으로 그대로 남김).
        const { data, error } = await supabase.from("schedules").insert({ patient_id: pid, ...row }).select().single();
        if (error || !data) throw error ?? new Error("insert 실패");
        // 알림 예약은 베스트에포트 — 실패해도 일정은 이미 저장됐으므로 재시도(중복 insert)하지 않는다.
        try { if (await ensurePermission()) await scheduleReminders(data.id, data.medicine_name, hour, minute, days, data.time_of_day); } catch {}
        await cancelSchedule(editId); // 기존 일정 알림 취소
        const { error: deactErr } = await supabase.from("schedules").update({ active: false }).eq("id", editId);
        if (deactErr) {
          // 새 일정은 등록됐지만 기존 행 비활성화 실패 → 둘 다 활성으로 남을 수 있음. 정직하게 안내.
          Alert.alert("수정은 저장됐어요", "이전 일정 정리에 실패했어요. '복약 관리'에서 이전 항목을 삭제해 주세요.");
        } else {
          Alert.alert("복약 일정을 수정했습니다.");
        }
      } else {
        const { data, error } = await supabase.from("schedules").insert({ patient_id: pid, ...row }).select().single();
        if (error || !data) throw error ?? new Error("insert 실패");
        // 알림 예약은 베스트에포트 — 실패해도 일정은 이미 저장됐으므로 재시도(중복 insert)하지 않는다.
        try { if (await ensurePermission()) await scheduleReminders(data.id, data.medicine_name, hour, minute, days, data.time_of_day); } catch {}
        Alert.alert("복약 일정을 등록했습니다.");
      }
      nav.navigate("Tabs");
    } catch (e: any) {
      Alert.alert("저장 실패", e?.message ?? "다시 시도해 주세요.");
      savingRef.current = false; setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title={editId ? "복약 수정" : "버튼으로 등록"} />
      <ScrollView contentContainerStyle={styles.c}>
        {/* 약 이름 */}
        <View style={styles.section}>
          <Text style={styles.label}>약 이름</Text>
          <View style={styles.inputWrap}>
            <View style={styles.inputIcon}>
              <Pill size={20} color={colors.primaryBlue} />
            </View>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="예: 고혈압약"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>

        {/* 언제 드시나요? */}
        <View style={styles.section}>
          <Text style={styles.label}>언제 드시나요?</Text>
          <View style={styles.row}>{TODS.map((t) => (
            <TimeChip key={t} label={t} selected={tod === t} onPress={() => setTod(t)} />
          ))}</View>
        </View>

        {/* 세부 시간 — 시/분을 스크롤로 선택(아무 시각이나 가능) */}
        <View style={styles.section}>
          <Text style={styles.label}>몇 시 몇 분</Text>
          <View style={styles.wheelRow}>
            <WheelPicker values={HOUR_VALUES} value={hour} onChange={setHour} suffix="시" />
            <WheelPicker values={MINUTE_VALUES} value={minute} onChange={setMinute} suffix="분" />
          </View>
        </View>

        {/* 반복 요일 — 선택 안 하면 매일 */}
        <View style={styles.section}>
          <Text style={styles.label}>반복 요일</Text>
          <Text style={styles.hint}>요일을 고르지 않으면 매일 알려드려요.</Text>
          <View style={styles.row}>
            <TimeChip label="매일" selected={repeatDays.length === 0} onPress={() => setRepeatDays([])} />
            {DAYS.map((d, i) => (
              <TimeChip key={d} label={d} selected={repeatDays.includes(i)} onPress={() => toggleDay(i)} />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* 하단 저장 버튼 — 시스템 네비게이션 바와 겹치지 않게 하단 여백 확보 */}
      <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>
        <BigButton label={saving ? "저장 중…" : editId ? "수정 저장하기" : "저장하기"} onPress={save} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cardBg },
  c: { padding: spacing.lg, paddingBottom: spacing.xl },
  section: { marginBottom: spacing.lg },
  label: { fontSize: fontSizes.body, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  hint: { fontSize: fontSizes.body, color: colors.textSecondary, marginBottom: spacing.sm, marginTop: -4 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.lightBlueBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.button,
    paddingHorizontal: 14,
  },
  inputIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  input: { flex: 1, fontSize: fontSizes.body, color: colors.text, paddingVertical: 16 },
  row: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 },
  wheelRow: { flexDirection: "row", justifyContent: "center", gap: spacing.lg, paddingVertical: spacing.sm },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    backgroundColor: colors.cardBg,
  },
});

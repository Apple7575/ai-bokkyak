import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pill, Sun, Sunset, Moon, Clock, Check } from "lucide-react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { WheelPicker } from "../components/WheelPicker";
import { supabase } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { ensurePermission, scheduleReminders } from "../lib/notifications";
import { ensureStrongAlarmReady } from "../lib/alarmPermissions";
import { normalizeRepeatDays } from "../lib/schedule";
import { TimeOfDay, TIME_OF_DAYS, defaultHourFor, timeOfDayForHour, slotLabel } from "../lib/timeOfDay";
import { buildDoseRows } from "../lib/medSummary";
import { colors, fontSizes, spacing, radii, minTouch } from "../theme/tokens";

// C-09 복용시점 등록 — 모든 등록 경로(이름 검색·사진·직접 입력)가 수렴하는 공통 관문.
// 시간대를 여러 개 고를 수 있고, 고른 시간대마다 schedule 행이 하나씩 생긴다.
// 요일을 하나도 고르지 않으면 repeat_days=[] = 매일 (설계 결정 #1).

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const AMOUNTS = ["1정", "2정", "1포"];
const HOUR_VALUES = Array.from({ length: 24 }, (_, i) => i);
const MINUTE_VALUES = Array.from({ length: 60 }, (_, i) => i);

const TOD_ICON: Record<TimeOfDay, React.ComponentType<{ size?: number; color?: string }>> = {
  아침: Sun, 점심: Sun, 저녁: Sunset, 취침: Moon,
};

function ampm(h: number, m: number): string {
  const ap = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ap} ${h12}:${String(m).padStart(2, "0")}`;
}

export function DoseTimeScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const medicineName: string = route.params?.medicineName ?? "";

  const [selected, setSelected] = useState<TimeOfDay[]>(["아침"]);
  // 시간대마다 시각을 따로 기억한다 (아침 8시 · 저녁 8시를 동시에 쓸 수 있어야 한다).
  const [timeBy, setTimeBy] = useState<Record<TimeOfDay, { hour: number; minute: number }>>({
    아침: { hour: defaultHourFor("아침"), minute: 0 },
    점심: { hour: defaultHourFor("점심"), minute: 0 },
    저녁: { hour: defaultHourFor("저녁"), minute: 0 },
    취침: { hour: defaultHourFor("취침"), minute: 0 },
  });
  const [editing, setEditing] = useState<TimeOfDay | null>(null); // 시각 고르는 중인 시간대
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [amount, setAmount] = useState<string>("1정");
  const [saving, setSaving] = useState(false);

  function toggleTod(t: TimeOfDay) {
    setSelected((prev) => {
      if (prev.includes(t)) {
        if (prev.length === 1) return prev; // 최소 하나는 남긴다
        if (editing === t) setEditing(null);
        return prev.filter((x) => x !== t);
      }
      return [...prev, t];
    });
  }

  function toggleDay(d: number) {
    setRepeatDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  // 시각을 바꾸면 그 시간대 칸의 값만 바뀐다. 시간대 자체는 사용자가 고른 것을 존중한다
  // (아침 칸에 7시를 넣든 9시를 넣든 '아침'이다).
  function setTime(t: TimeOfDay, patch: { hour?: number; minute?: number }) {
    setTimeBy((prev) => ({ ...prev, [t]: { ...prev[t], ...patch } }));
  }

  async function save(): Promise<void> {
    if (saving) return;
    if (!medicineName.trim()) { Alert.alert("약 이름이 없어요"); return; }
    setSaving(true);
    const pid = await getPatientId();
    if (!pid) { setSaving(false); return; }
    const days = normalizeRepeatDays(repeatDays);
    const rows = buildDoseRows(selected, timeBy);
    try {
      await ensureStrongAlarmReady();
      const granted = await ensurePermission();
      for (const r of rows) {
        const { data, error } = await supabase.from("schedules").insert({
          patient_id: pid,
          medicine_name: medicineName.trim(),
          time_of_day: r.time_of_day,
          hour: r.hour, minute: r.minute,
          repeat_days: days, active: true,
          dose_amount: amount,
        }).select().single();
        if (error || !data) throw error ?? new Error("insert 실패");
        // 알림 예약은 베스트에포트 — 실패해도 일정은 이미 저장됐다.
        if (granted) {
          try {
            await scheduleReminders(data.id, data.medicine_name, r.hour, r.minute, days, r.time_of_day);
          } catch {}
        }
      }
      nav.reset({ index: 0, routes: [{ name: "Tabs", params: { screen: "Cabinet" } }] });
    } catch {
      Alert.alert("저장에 실패했어요", "인터넷 연결을 확인하고 다시 시도해 주세요.");
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="언제 드세요?" />
      <ScrollView contentContainerStyle={styles.c}>
        {/* 고른 약 */}
        <View style={styles.medCard}>
          <View style={styles.medIcon}><Pill size={22} color={colors.primaryBlue} /></View>
          <Text style={styles.medName} numberOfLines={2}>{medicineName || "약을 고르지 않았어요"}</Text>
          <Pressable onPress={() => nav.goBack()} style={styles.changeBtn} hitSlop={8}>
            <Text style={styles.changeText}>바꾸기</Text>
          </Pressable>
        </View>

        {/* 복용 시간대 — 여러 개 */}
        <Text style={styles.section}>복용 시간대</Text>
        <Text style={styles.hint}>여러 개 고를 수 있어요.</Text>
        <View style={styles.todRow}>
          {TIME_OF_DAYS.map((t) => {
            const Icon = TOD_ICON[t];
            const on = selected.includes(t);
            return (
              <Pressable
                key={t}
                onPress={() => toggleTod(t)}
                style={[styles.todChip, on && styles.todChipOn]}
              >
                <Icon size={18} color={on ? "#fff" : colors.textSecondary} />
                <Text style={[styles.todText, on && styles.todTextOn]}>{slotLabel(t)}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 고른 시간대마다 시각 */}
        {TIME_OF_DAYS.filter((t) => selected.includes(t)).map((t) => (
          <View key={t}>
            <Pressable
              onPress={() => setEditing(editing === t ? null : t)}
              style={({ pressed }) => [styles.timeRow, pressed && { opacity: 0.9 }]}
            >
              <Clock size={20} color={colors.primaryBlue} />
              <Text style={styles.timeLabel}>{slotLabel(t)}</Text>
              <Text style={styles.timeValue}>{ampm(timeBy[t].hour, timeBy[t].minute)}</Text>
            </Pressable>
            {editing === t ? (
              <View style={styles.wheelRow}>
                <WheelPicker
                  values={HOUR_VALUES}
                  value={timeBy[t].hour}
                  onChange={(h) => setTime(t, { hour: h })}
                  suffix="시"
                />
                <WheelPicker
                  values={MINUTE_VALUES}
                  value={timeBy[t].minute}
                  onChange={(m) => setTime(t, { minute: m })}
                  suffix="분"
                />
              </View>
            ) : null}
            {/* 고른 시각이 그 시간대와 많이 어긋나면 알려준다(알람 제목이 이상해지지 않게) */}
            {timeOfDayForHour(timeBy[t].hour) !== t ? (
              <Text style={styles.mismatch}>
                {`${timeBy[t].hour}시는 보통 '${slotLabel(timeOfDayForHour(timeBy[t].hour))}'이에요. 이대로 두면 '${slotLabel(t)}' 알람으로 울립니다.`}
              </Text>
            ) : null}
          </View>
        ))}

        {/* 반복 */}
        <Text style={styles.section}>반복</Text>
        <View style={styles.todRow}>
          <Pressable
            onPress={() => setRepeatDays([])}
            style={[styles.repeatChip, repeatDays.length === 0 && styles.todChipOn]}
          >
            <Text style={[styles.todText, repeatDays.length === 0 && styles.todTextOn]}>매일</Text>
          </Pressable>
          {DAYS.map((d, i) => (
            <Pressable
              key={d}
              onPress={() => toggleDay(i)}
              style={[styles.dayChip, repeatDays.includes(i) && styles.todChipOn]}
            >
              <Text style={[styles.todText, repeatDays.includes(i) && styles.todTextOn]}>{d}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>요일을 하나도 고르지 않으면 매일 드시는 것으로 저장돼요.</Text>

        {/* 1회 복용량 */}
        <Text style={styles.section}>1회 복용량</Text>
        <View style={styles.todRow}>
          {AMOUNTS.map((a) => (
            <Pressable
              key={a}
              onPress={() => setAmount(a)}
              style={[styles.amountChip, amount === a && styles.todChipOn]}
            >
              <Text style={[styles.todText, amount === a && styles.todTextOn]}>{a}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>
        <Pressable
          onPress={() => { void save(); }}
          disabled={saving}
          style={({ pressed }) => [styles.saveBtn, (pressed || saving) && { opacity: 0.9 }]}
        >
          <Check size={22} color="#fff" />
          <Text style={styles.saveText}>{saving ? "저장 중…" : "약장에 넣기"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  c: { padding: spacing.md, paddingBottom: spacing.xl },
  medCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md,
  },
  medIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: colors.lightBlueBg,
    alignItems: "center", justifyContent: "center",
  },
  medName: { flex: 1, fontSize: 19, fontWeight: "700", color: colors.text },
  changeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.lightBlueBg },
  changeText: { fontSize: fontSizes.body, fontWeight: "700", color: colors.primaryBlue },
  section: { fontSize: 24, fontWeight: "800", color: colors.primaryNavy, marginTop: spacing.lg, marginBottom: spacing.xs },
  hint: { fontSize: fontSizes.body, color: colors.textSecondary, marginBottom: spacing.sm },
  todRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  todChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    minHeight: minTouch, paddingHorizontal: spacing.md, borderRadius: radii.pill,
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
  },
  todChipOn: { backgroundColor: colors.primaryBlue, borderColor: colors.primaryBlue },
  todText: { fontSize: 19, fontWeight: "700", color: colors.text },
  todTextOn: { color: "#fff" },
  repeatChip: {
    minHeight: minTouch, paddingHorizontal: spacing.lg, borderRadius: radii.pill,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
  },
  dayChip: {
    width: 56, minHeight: minTouch, borderRadius: radii.pill,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
  },
  amountChip: {
    minHeight: minTouch, paddingHorizontal: spacing.lg, borderRadius: radii.pill,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
  },
  timeRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    minHeight: minTouch, paddingHorizontal: spacing.md, marginTop: spacing.sm,
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card,
  },
  timeLabel: { fontSize: 19, fontWeight: "700", color: colors.text, flex: 1 },
  timeValue: { fontSize: 20, fontWeight: "800", color: colors.primaryBlue },
  wheelRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  mismatch: { fontSize: 16, color: colors.warningOrange, marginTop: 6, lineHeight: 23 },
  footer: {
    padding: spacing.lg, backgroundColor: colors.cardBg,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    minHeight: minTouch, borderRadius: radii.button, backgroundColor: colors.primaryBlue,
  },
  saveText: { fontSize: 21, fontWeight: "800", color: "#fff" },
});

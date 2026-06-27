import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BigButton } from "../components/BigButton";
import { WheelPicker } from "../components/WheelPicker";
import { supabase, Schedule } from "../lib/supabase";
import { scheduleSnooze } from "../lib/notifications";
import { SnoozeSpec, nextSnoozeFire } from "../lib/snooze";
import { spokenTime } from "../lib/spokenTime";
import { getPatientId } from "../lib/storage";
import { recordIntake } from "../lib/records";
import { doseSlot } from "../lib/schedule";
import { colors, fontSizes, spacing, radii } from "../theme/tokens";

const MIN_VALUES = Array.from({ length: 60 }, (_, i) => i + 1);
const HOUR_VALUES = Array.from({ length: 24 }, (_, i) => i);
const MINUTE_VALUES = Array.from({ length: 60 }, (_, i) => i);

// 잠금/알람 화면 위로 올라오는 바텀시트(transparentModal로 표시 — RootNavigator 참고).
export function SnoozePickerScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const scheduleId: string = useRoute<any>().params?.scheduleId;
  const [sch, setSch] = useState<Schedule | null>(null);
  const [tab, setTab] = useState<"duration" | "exact">("duration");
  const [minutes, setMinutes] = useState(5);
  const [exH, setExH] = useState(new Date().getHours());
  const [exM, setExM] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("schedules").select("*").eq("id", scheduleId).single();
      setSch(data);
    })();
  }, [scheduleId]);

  async function apply(spec: SnoozeSpec) {
    if (busy) return;
    if (!sch) { Alert.alert("오류", "복약 일정을 불러올 수 없습니다."); return; }
    setBusy(true);
    // 미루기의 핵심은 "다시 알림 예약". 이것만 성공하면 미루기는 성공.
    try {
      await scheduleSnooze(scheduleId, sch.medicine_name, spec, sch.hour, sch.minute, sch.time_of_day);
    } catch {
      Alert.alert("다시 알림 설정에 실패했어요", "잠시 후 다시 시도해 주세요.");
      setBusy(false);
      return;
    }
    // 예약 직후 카운트다운 목표시각 계산(이후 기록 지연과 무관하게 실제 트리거와 일치).
    const fireAt = nextSnoozeFire(spec, new Date()).toISOString();
    // 기록(snoozed)은 베스트에포트 — DB 저장이 실패해도 미루기 알림은 이미 예약됨(막지 않음). 단 실패는 안내.
    try {
      const pid = await getPatientId();
      if (pid) {
        const slot = doseSlot(sch.hour, sch.minute, new Date());
        await recordIntake({ patientId: pid, scheduleId, scheduledFor: slot, status: "snoozed", method: "버튼" });
      }
    } catch {
      Alert.alert("기록 저장 실패", "미루기 알림은 설정됐지만 복약 기록 저장에 실패했어요. (알림은 정상 동작)");
    }
    nav.reset({ index: 0, routes: [{ name: "SnoozeCountdown", params: { scheduleId, fireAt, hour: sch.hour, minute: sch.minute } }] });
  }

  const label = tab === "duration" ? `${minutes}분 후에 다시 알림` : `${spokenTime(exH, exM)}에 다시 알림`;

  return (
    <View style={styles.root}>
      {/* 어두운 배경 — 탭하면 닫힘 */}
      <Pressable style={styles.backdrop} onPress={() => nav.goBack()} />
      <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
        <View style={styles.grabber} />
        <Text style={styles.title}>얼마 후 알림을 드릴까요?</Text>
        {sch ? <Text style={styles.sub}>{sch.medicine_name}</Text> : null}

        <View style={styles.tabs}>
          <Pressable style={[styles.tab, tab === "duration" && styles.tabOn]} onPress={() => setTab("duration")}>
            <Text style={[styles.tabTxt, tab === "duration" && styles.tabTxtOn]}>기간</Text>
          </Pressable>
          <Pressable style={[styles.tab, tab === "exact" && styles.tabOn]} onPress={() => setTab("exact")}>
            <Text style={[styles.tabTxt, tab === "exact" && styles.tabTxtOn]}>정확한 시간</Text>
          </Pressable>
        </View>

        <View style={styles.wheels}>
          {tab === "duration" ? (
            <WheelPicker values={MIN_VALUES} value={minutes} onChange={setMinutes} suffix="분" />
          ) : (
            <>
              <WheelPicker values={HOUR_VALUES} value={exH} onChange={setExH} suffix="시" />
              <WheelPicker values={MINUTE_VALUES} value={exM} onChange={setExM} suffix="분" />
            </>
          )}
        </View>

        <BigButton
          label={label}
          onPress={() => apply(tab === "duration" ? { mode: "duration", minutes } : { mode: "exact", hour: exH, minute: exM })}
        />
        <View style={styles.presets}>
          {[10, 30, 60].map((m) => (
            <Pressable key={m} style={styles.preset} onPress={() => apply({ mode: "duration", minutes: m })}>
              <Text style={styles.presetTxt}>{m === 60 ? "1시간" : `${m}분`}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
  },
  grabber: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: spacing.md },
  title: { fontSize: fontSizes.title, fontWeight: "800", color: colors.primaryNavy, textAlign: "center" },
  sub: { fontSize: fontSizes.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs, marginBottom: spacing.sm },
  tabs: { flexDirection: "row", backgroundColor: colors.lightBlueBg, borderRadius: radii.button, padding: 4, marginTop: spacing.sm },
  tab: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.button },
  tabOn: { backgroundColor: colors.cardBg },
  tabTxt: { fontSize: fontSizes.body, fontWeight: "700", color: colors.textSecondary },
  tabTxtOn: { color: colors.primaryNavy },
  wheels: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.lg, marginVertical: spacing.md },
  presets: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  preset: { flex: 1, minHeight: 56, alignItems: "center", justifyContent: "center", backgroundColor: colors.lightBlueBg, borderRadius: radii.button },
  presetTxt: { fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.primaryBlue },
});

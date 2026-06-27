// care-app/src/screens/SnoozePickerScreen.tsx
import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { BigButton } from "../components/BigButton";
import { ScreenHeader } from "../components/ScreenHeader";
import { WheelPicker } from "../components/WheelPicker";
import { supabase } from "../lib/supabase";
import { scheduleSnooze } from "../lib/notifications";
import { SnoozeSpec, nextSnoozeFire } from "../lib/snooze";
import { spokenTime } from "../lib/spokenTime";
import { colors, fontSizes, spacing, radii } from "../theme/tokens";
import { getPatientId } from "../lib/storage";
import { recordIntake } from "../lib/records";
import { doseSlot } from "../lib/schedule";

const MIN_VALUES = Array.from({ length: 60 }, (_, i) => i + 1);
const HOUR_VALUES = Array.from({ length: 24 }, (_, i) => i);

export function SnoozePickerScreen() {
  const nav = useNavigation<any>();
  const scheduleId: string = useRoute<any>().params?.scheduleId;
  const [tab, setTab] = useState<"duration" | "exact">("duration");
  const [minutes, setMinutes] = useState(5);
  const [exH, setExH] = useState(new Date().getHours());
  const [exM, setExM] = useState(0);

  async function apply(spec: SnoozeSpec) {
    const { data: sch } = await supabase.from("schedules").select("*").eq("id", scheduleId).single();
    if (!sch) { nav.navigate("Tabs"); return; }
    // 원래 슬롯에 snoozed 기록 (보호자/이력에서 미복용으로 보이지 않도록)
    const pid = await getPatientId();
    if (pid) {
      const slot = doseSlot(sch.hour, sch.minute, new Date());
      try { await recordIntake({ patientId: pid, scheduleId, scheduledFor: slot, status: "snoozed", method: "버튼" }); } catch {}
    }
    try {
      await scheduleSnooze(scheduleId, sch.medicine_name, spec, sch.hour, sch.minute, sch.time_of_day);
    } catch {
      Alert.alert("다시 알림 설정 실패", "인터넷 연결을 확인해 주세요.");
      return;
    }
    const fireAt = nextSnoozeFire(spec, new Date()).toISOString();
    nav.reset({ index: 0, routes: [{ name: "SnoozeCountdown", params: { scheduleId, fireAt, hour: sch.hour, minute: sch.minute } }] });
  }

  const label = tab === "duration" ? `${minutes}분 후에 다시 알림` : `${spokenTime(exH, exM)}에 다시 알림`;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="잠시 미루기" />
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
            <WheelPicker values={Array.from({ length: 60 }, (_, i) => i)} value={exM} onChange={setExM} suffix="분" />
          </>
        )}
      </View>

      <View style={styles.footer}>
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
  screen: { flex: 1, backgroundColor: colors.cardBg },
  tabs: {
    flexDirection: "row",
    margin: spacing.lg,
    backgroundColor: colors.lightBlueBg,
    borderRadius: radii.button,
    padding: 4,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.button,
  },
  tabOn: { backgroundColor: colors.cardBg },
  tabTxt: { fontSize: fontSizes.body, fontWeight: "700", color: colors.textSecondary },
  tabTxtOn: { color: colors.primaryNavy },
  wheels: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  footer: { padding: spacing.lg },
  presets: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  preset: {
    flex: 1,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lightBlueBg,
    borderRadius: radii.button,
  },
  presetTxt: { fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.primaryBlue },
});

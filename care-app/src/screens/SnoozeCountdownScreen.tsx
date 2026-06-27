// care-app/src/screens/SnoozeCountdownScreen.tsx
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { BigButton } from "../components/BigButton";
import { supabase } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { recordIntake } from "../lib/records";
import { stopAlarm } from "../lib/notifications";
import { dueAtSlot } from "../lib/doseSlotSelect";
import { doseSlot } from "../lib/schedule";
import { colors, fontSizes, spacing } from "../theme/tokens";

function mmss(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function SnoozeCountdownScreen() {
  const nav = useNavigation<any>();
  const p = useRoute<any>().params as {
    scheduleId: string;
    fireAt: string;
    hour: number;
    minute: number;
  };
  const target = new Date(p.fireAt).getTime();
  const [remain, setRemain] = useState(target - Date.now());
  const [autoLeft, setAutoLeft] = useState(8); // 8초 후 자동으로 홈
  const didNavigate = useRef(false);

  useEffect(() => {
    const t = setInterval(() => {
      setRemain(target - Date.now());
      setAutoLeft((x) => x - 1);
    }, 1000);
    return () => clearInterval(t);
  }, [target]);

  useEffect(() => {
    if (autoLeft <= 0 && !didNavigate.current) {
      didNavigate.current = true;
      nav.reset({ index: 0, routes: [{ name: "Tabs" }] });
    }
  }, [autoLeft, nav]);

  async function takeAll() {
    const pid = await getPatientId();
    if (pid) {
      const { data } = await supabase
        .from("schedules")
        .select("*")
        .eq("patient_id", pid)
        .eq("active", true);
      const slot = doseSlot(p.hour, p.minute, new Date());
      const ids = dueAtSlot(data ?? [], p.hour, p.minute, slot);
      for (const id of ids) {
        try {
          await recordIntake({
            patientId: pid,
            scheduleId: id,
            scheduledFor: slot,
            status: "completed",
            method: "버튼",
          });
          await stopAlarm(id);
        } catch {}
      }
    }
    nav.reset({ index: 0, routes: [{ name: "Tabs" }] });
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>일정 변경됨</Text>
      <Text style={styles.sub}>다음 알림까지 남은 시간</Text>
      <Text style={styles.count}>{mmss(remain)}</Text>
      <View style={{ flex: 1 }} />
      <BigButton
        label={`일정 화면으로 돌아가기 (${Math.max(0, autoLeft)})`}
        onPress={() => {
          if (!didNavigate.current) {
            didNavigate.current = true;
            nav.reset({ index: 0, routes: [{ name: "Tabs" }] });
          }
        }}
      />
      <BigButton label="지금 모두 먹기" variant="secondary" onPress={takeAll} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cardBg,
    padding: spacing.lg,
    paddingTop: spacing.xl * 2,
    alignItems: "center",
  },
  title: {
    fontSize: fontSizes.title,
    fontWeight: "800",
    color: colors.primaryNavy,
    marginTop: spacing.xl,
  },
  sub: {
    fontSize: fontSizes.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  count: {
    fontSize: 64,
    fontWeight: "800",
    color: colors.text,
    marginTop: spacing.lg,
  },
});

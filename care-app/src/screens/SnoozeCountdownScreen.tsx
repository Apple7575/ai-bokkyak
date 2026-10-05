// care-app/src/screens/SnoozeCountdownScreen.tsx
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

// 미룬 시간을 말로. 몇 분 후(5분~1시간)와 시각 지정(몇 시간 뒤일 수 있다) 둘 다 다룬다.
// 발사 시각을 모르면(파라미터 깨짐) "잠시 후".
function afterLabel(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "잠시 후";
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min}분 후`;
  const h = Math.floor(min / 60), m = min % 60;
  return m === 0 ? `${h}시간 후` : `${h}시간 ${m}분 후`;
}

// 자동으로 홈으로 가기까지 — 8초는 어르신이 문구를 읽기도 전에 사라졌다.
const AUTO_EXIT_SEC = 15;

export function SnoozeCountdownScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const p = useRoute<any>().params as {
    scheduleId: string;
    fireAt: string;
    hour: number;
    minute: number;
  };
  const target = new Date(p.fireAt).getTime();
  const [remain, setRemain] = useState(target - Date.now());
  // 제목에 쓰는 "N분 후"는 들어온 순간 기준으로 고정한다 — 초가 줄어도 제목이 흔들리지 않게.
  const [after] = useState(() => afterLabel(target - Date.now()));
  const [autoLeft, setAutoLeft] = useState(AUTO_EXIT_SEC);
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
      let failed = false;
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
        } catch { failed = true; }
      }
      if (failed) {
        Alert.alert("저장에 실패했어요", "인터넷 연결을 확인하고 다시 눌러 주세요.");
        return;
      }
    }
    nav.reset({ index: 0, routes: [{ name: "Tabs" }] });
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.md }]}>
      <Text style={styles.title}>{`${after} 다시 알려드릴게요`}</Text>
      <Text style={styles.sub}>다음 알림까지 남은 시간</Text>
      <Text style={styles.count}>{mmss(remain)}</Text>
      <View style={{ flex: 1 }} />
      <BigButton
        label={`홈으로 (${Math.max(0, autoLeft)})`}
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
    backgroundColor: colors.canvas,
    padding: spacing.lg,
    alignItems: "center",
  },
  title: {
    fontSize: fontSizes.title,
    fontWeight: "800",
    color: colors.primaryNavy,
    marginTop: spacing.xl,
    textAlign: "center",
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

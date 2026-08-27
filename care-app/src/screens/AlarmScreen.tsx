import React, { useEffect, useRef, useState } from "react";
import { Image, View, Text, StyleSheet, Alert, ScrollView } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell } from "lucide-react-native";
import { BigButton } from "../components/BigButton";
import { CompletionFeedback } from "../components/CompletionFeedback";
import { MedicineMark } from "../components/MedicineMark";
import { supabase, Schedule } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { recordIntake, undoIntake } from "../lib/records";
import { logAlarmEvent } from "../lib/analytics";
import { stopAlarm } from "../lib/notifications";
import { startRinging, stopRinging } from "../lib/alarmRinger";
import { doseSlot } from "../lib/schedule";
import { colors, fontSizes, spacing, shadows } from "../theme/tokens";

const INTAKE_ART = require("../../assets/illustrations/intake-complete.png");

export function AlarmScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const scheduleId: string | undefined = route.params?.scheduleId;
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [completionVisible, setCompletionVisible] = useState(false);
  const savedRef = useRef(false);
  const undoneRef = useRef(false);
  const finishRequestedRef = useRef(false);
  const completionArgsRef = useRef<{ patientId: string; scheduleId: string; scheduledFor: Date } | null>(null);
  const ready = !scheduleId || !!schedule;
  const tod = schedule?.time_of_day || "복약";

  // 진입 시: 알림측 정지 → 스케줄 조회 → 인앱 연속 울림(소리 루프+진동) 시작.
  // 취소 플래그로 가드 — 이탈 후 시작된 재생은 즉시 stopRinging.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!scheduleId) return;
      await stopAlarm(scheduleId); // 화면 진입=인지 → 알림측 소리/반복 정지
      const { data } = await supabase.from("schedules").select("*").eq("id", scheduleId).single();
      if (cancelled) return;
      setSchedule(data);
      if (data) {
        // 알파 지표: 알람이 실제 발생(화면 진입)한 시각을 예정 슬롯과 함께 남긴다.
        // 베스트에포트 — 실패해도 알람 흐름을 막지 않는다.
        getPatientId().then((pid) => {
          if (pid) {
            logAlarmEvent({
              patientId: pid, scheduleId,
              scheduledFor: doseSlot(data.hour, data.minute, new Date()), type: "fired",
            });
          }
        });
        const todStr = data.time_of_day || "아침";
        // 인앱 연속 울림(소리 루프+진동). ~2.5분 자동정지.
        await startRinging(todStr, () => {});
        if (cancelled) stopRinging();
      }
    })();
    return () => {
      cancelled = true;
      stopRinging();
    };
  }, [scheduleId]);

  // 저장 중에는 버튼을 잠근다. 완료 저장이 끝나기 전에 "되돌리기"를 누른 뒤
  // 다른 응답(건너뛰기 등)을 고르면, 뒤늦게 도착한 되돌리기 삭제가 새 기록까지
  // 지워 버리는 경쟁을 막기 위함. (intake_records는 슬롯당 한 행이어야 한다.)
  const [busy, setBusy] = useState(false);

  // 완료 모달을 닫고 홈으로. 알람으로 콜드 스타트한 경우 Tabs가 push되어
  // 이 화면이 살아 있으므로, 모달을 명시적으로 닫지 않으면 홈 위에 남는다.
  function leave() {
    setCompletionVisible(false);
    nav.navigate("Tabs");
  }

  async function respond(status: "completed" | "skipped") {
    if (busy) return;
    void stopRinging();
    const pid = await getPatientId();
    if (!pid || !scheduleId || !schedule) { nav.navigate("Tabs"); return; }
    const slot = doseSlot(schedule.hour, schedule.minute, new Date());
    setBusy(true);
    if (status === "completed") {
      savedRef.current = false;
      undoneRef.current = false;
      finishRequestedRef.current = false;
      completionArgsRef.current = { patientId: pid, scheduleId, scheduledFor: slot };
      setCompletionVisible(true);
    }
    try {
      await recordIntake({ patientId: pid, scheduleId, scheduledFor: slot, status, method: "버튼" });
      await stopAlarm(scheduleId);
    } catch {
      setCompletionVisible(false);
      setBusy(false);
      Alert.alert("저장에 실패했어요", "인터넷 연결을 확인하고 다시 눌러 주세요.");
      return;
    }
    if (status === "completed") {
      savedRef.current = true;
      if (undoneRef.current) {
        // 저장 중에 되돌리기를 눌렀던 경우 — 여기서 삭제를 수행한 뒤에야 버튼을 연다.
        try {
          await undoIntake({ patientId: pid, scheduleId, scheduledFor: slot });
          savedRef.current = false;
        } catch {
          Alert.alert("되돌리지 못했어요", "기록 화면에서 복용 기록을 확인해 주세요.");
        }
        setBusy(false);
        return;
      }
      setBusy(false);
      if (finishRequestedRef.current) leave();
      return;
    }
    setBusy(false);
    leave();
  }

  function finishCompletion() {
    if (savedRef.current) leave();
    else finishRequestedRef.current = true;
  }

  async function undoCompletion() {
    undoneRef.current = true;
    finishRequestedRef.current = false;
    setCompletionVisible(false);
    const args = completionArgsRef.current;
    // 아직 저장 전이면 respond()의 후속 처리가 되돌리기를 수행한다(busy 유지).
    if (!savedRef.current || !args) return;
    setBusy(true);
    try {
      await undoIntake(args);
      savedRef.current = false;
    } catch {
      Alert.alert("되돌리지 못했어요", "인터넷 연결을 확인하고 기록 화면에서 확인해 주세요.");
    }
    setBusy(false);
  }

  function goSnooze() {
    stopRinging();
    nav.navigate("SnoozePicker", { scheduleId });
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        {/* Bell emphasis */}
        <View style={styles.bellWrap}>
          <Image source={INTAKE_ART} style={styles.intakeArt} resizeMode="contain" />
          <View style={styles.bellHaloSmall}>
            <View style={styles.bellCircle}>
              <Bell size={30} color={colors.primaryBlue} strokeWidth={2.2} />
            </View>
          </View>
        </View>

        {/* Title — 약 이름을 크게 보여줘 같은 시간대 여러 약도 구분 */}
        <Text style={styles.title}>
          {schedule ? `${schedule.medicine_name} 드실 시간이에요` : `${tod} 약 복용 시간입니다`}
        </Text>
        {schedule ? <View style={styles.medicineMark}><MedicineMark name={schedule.medicine_name} size={62} /></View> : null}
        <Text style={styles.subtitle}>{`${tod} 약 · 드신 후 복용 완료를 눌러주세요.`}</Text>

        {ready ? (
          <>
            <View style={{ height: spacing.md }} />
            <BigButton label="지금 약 먹기" disabled={busy} onPress={() => respond("completed")} />
            <BigButton label="안 먹고 건너뛰기" variant="secondary" disabled={busy} onPress={() => respond("skipped")} />
            <BigButton label="잠시 미루기" variant="secondary" disabled={busy} onPress={goSnooze} />
          </>
        ) : (
          <Text style={styles.loading}>불러오는 중...</Text>
        )}
      </ScrollView>
      <CompletionFeedback
        visible={completionVisible}
        medicineName={schedule?.medicine_name ?? "약"}
        onUndo={() => { void undoCompletion(); }}
        onDone={finishCompletion}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flexGrow: 1, padding: spacing.lg, justifyContent: "center" },
  bellWrap: { height: 138, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  intakeArt: { width: "86%", height: "112%" },
  bellHaloSmall: { position: "absolute", right: 14, top: 0, width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: colors.coralSoft, ...shadows.card },
  bellCircle: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
    ...shadows.floating,
  },
  title: {
    fontSize: fontSizes.title, fontWeight: "800", color: colors.primaryNavy,
    textAlign: "center", marginTop: spacing.md,
  },
  subtitle: {
    fontSize: fontSizes.body, color: colors.textSecondary,
    textAlign: "center", marginTop: spacing.sm,
  },
  medicineMark: { alignItems: "center", marginTop: spacing.md },
  loading: { textAlign: "center", fontSize: fontSizes.body, color: colors.textSecondary, marginTop: spacing.lg },
});

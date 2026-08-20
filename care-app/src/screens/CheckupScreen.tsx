import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Volume2, Check, X, Clock, Pill } from "lucide-react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { supabase, Schedule, Patient } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { recordIntake } from "../lib/records";
import { todaySlot } from "../lib/schedule";
import { speak, stopSpeaking } from "../lib/tts";
import {
  buildCheckupList, checkupGreeting, checkupPrompt, checkupTimeLabel,
  checkupSummary, answerToStatus, CheckupAnswer,
} from "../lib/checkup";
import { colors, fontSizes, spacing, radii, minTouch } from "../theme/tokens";

// 복약 확인 — TTS가 읽어주고, 답은 화면 터치로 한다.
//
// 이 화면은 AI 건강전화(OpenAI Realtime + WebRTC 양방향 통화)를 대체한다.
// 회의 결정 2026-08-20: 음성 AI(마이크·음성 인식)를 전부 걷어내고, 말은 앱이
// 하고 결정은 손으로 하게 한다. 나중에 음성을 다시 넣을 때 이 화면만 바꾸면 된다.
//
// 지키는 것:
//   · 소리는 절대 버튼을 막지 않는다. TTS는 뒤에서 돌고, 버튼은 언제나 눌린다
//     (QA 2026-08-20에서 "적용될 때까지 다른 버튼이 안 눌린다"로 지적된 패턴).
//   · 기록은 recordIntake(upsert) — 같은 (schedule, 시각)에 중복 행이 생기지 않는다.
//   · 슬롯은 todaySlot. 아직 안 울린 오늘의 미래 회차도 확인 대상이라, doseSlot으로
//     과거로 굴리면 어제 기록을 덮어쓴다.

type Phase = "loading" | "asking" | "done" | "error";

export function CheckupScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [list, setList] = useState<Schedule[]>([]);
  const [index, setIndex] = useState(0);
  const [takenCount, setTakenCount] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const patientIdRef = useRef<string | null>(null);
  // 이 확인 세션의 기준 날짜. 자정을 넘겨도 시작한 날의 슬롯에 기록한다.
  const baseDateRef = useRef<Date>(new Date());
  // 화면을 떠난 뒤 늦게 도착한 응답이 상태를 되살리지 않게 한다.
  const aliveRef = useRef(true);

  // 소리는 항상 곁다리로 — 실패해도 화면 흐름을 막지 않는다.
  const say = useCallback((text: string) => {
    setSpeaking(true);
    speak(text)
      .catch(() => {})
      .finally(() => { if (aliveRef.current) setSpeaking(false); });
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    (async () => {
      try {
        const pid = await getPatientId();
        if (!pid) throw new Error("환자 정보가 없어요. 앱을 다시 설정해 주세요.");
        patientIdRef.current = pid;
        const now = new Date();
        baseDateRef.current = now;

        const { data: patient } = await supabase
          .from("patients").select("*").eq("id", pid).maybeSingle();

        const { data: schs, error: sErr } = await supabase
          .from("schedules").select("*").eq("patient_id", pid).eq("active", true);
        if (sErr) throw new Error("복약 일정을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.");

        // 오늘 이미 복용 완료로 기록된 약은 다시 묻지 않는다.
        const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
        const { data: recs, error: rErr } = await supabase
          .from("intake_records").select("*").eq("patient_id", pid)
          .gte("scheduled_for", dayStart.toISOString())
          .lt("scheduled_for", dayEnd.toISOString());
        if (rErr) throw new Error("오늘 복약 기록을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.");
        const done = new Set(
          (recs ?? []).filter((r) => r.status === "completed").map((r) => r.schedule_id as string)
        );

        const items = buildCheckupList((schs ?? []) as Schedule[], done, now);
        if (!aliveRef.current) return;
        setList(items);

        const name = (patient as Patient | null)?.name;
        if (items.length === 0) {
          setPhase("done");
          say(checkupSummary(0, 0));
        } else {
          setPhase("asking");
          // 인사와 첫 질문을 한 번에 읽어준다 — 두 번 나눠 부르면 speak()가 앞 것을
          // 끊어버려 인사만 들리고 질문이 사라진다.
          say(`${checkupGreeting(name)} ${checkupPrompt(items[0])}`);
        }
      } catch (e: any) {
        if (!aliveRef.current) return;
        setErrorMsg(e?.message ?? "불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        setPhase("error");
      }
    })();
    return () => { aliveRef.current = false; void stopSpeaking(); };
  }, [say]);

  async function answer(a: CheckupAnswer): Promise<void> {
    const dose = list[index];
    if (!dose) return;
    const pid = patientIdRef.current;
    const status = answerToStatus(a);

    // 화면부터 넘긴다. 저장은 뒤에서 — 네트워크를 기다리며 버튼이 굳지 않게.
    const next = index + 1;
    if (a === "먹었어요") setTakenCount((c) => c + 1);
    setIndex(next);
    if (next < list.length) {
      say(checkupPrompt(list[next]));
    } else {
      setPhase("done");
      say(checkupSummary(list.length, takenCount + (a === "먹었어요" ? 1 : 0)));
    }

    if (!status || !pid) return; // "나중에"는 기록하지 않는다
    try {
      await recordIntake({
        patientId: pid,
        scheduleId: dose.id,
        scheduledFor: todaySlot(dose.hour, dose.minute, baseDateRef.current),
        status,
        method: "버튼",
      });
    } catch {
      // 기록 실패를 조용히 삼키면 "눌렀는데 반영이 안 된" 상태가 된다. 끝 화면에서 알린다.
      if (aliveRef.current) setSaveFailed(true);
    }
  }

  if (phase === "loading") {
    return (
      <View style={s.screen}>
        <ScreenHeader title="복약 확인" />
        <View style={s.center}>
          <ActivityIndicator color={colors.primaryBlue} size="large" />
          <Text style={s.centerText}>오늘 드실 약을 불러오는 중이에요…</Text>
        </View>
      </View>
    );
  }

  if (phase === "error") {
    return (
      <View style={s.screen}>
        <ScreenHeader title="복약 확인" />
        <View style={s.center}>
          <Text style={s.errorText}>{errorMsg}</Text>
          <Pressable onPress={() => nav.goBack()} style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.9 }]}>
            <Text style={s.primaryBtnText}>돌아가기</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (phase === "done") {
    return (
      <View style={[s.screen, { paddingBottom: insets.bottom + spacing.md }]}>
        <ScreenHeader title="복약 확인" />
        <View style={s.center}>
          <View style={s.doneIcon}><Check size={44} color={colors.successGreen} /></View>
          <Text style={s.doneText}>{checkupSummary(list.length, takenCount)}</Text>
          {saveFailed ? (
            <Text style={s.warnText}>
              일부 기록을 저장하지 못했어요.{"\n"}인터넷 연결을 확인하고 기록 화면에서 확인해 주세요.
            </Text>
          ) : null}
        </View>
        <View style={s.footer}>
          <Pressable
            onPress={() => nav.goBack()}
            style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={s.primaryBtnText}>홈으로</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const dose = list[index];
  return (
    <View style={[s.screen, { paddingBottom: insets.bottom + spacing.md }]}>
      <ScreenHeader title="복약 확인" />

      <View style={s.body}>
        <Text style={s.progress}>{`${index + 1} / ${list.length}`}</Text>

        <View style={s.card}>
          <View style={s.pillIcon}><Pill size={34} color={colors.primaryBlue} /></View>
          <Text style={s.medName}>{dose.medicine_name}</Text>
          <Text style={s.medTime}>{checkupTimeLabel(dose)}</Text>
        </View>

        <View style={s.question}>
          {/* 소리가 나오는 중임을 보여줄 뿐, 버튼을 막지는 않는다 */}
          <Volume2 size={22} color={speaking ? colors.primaryBlue : colors.textSecondary} />
          <Text style={s.questionText}>드셨어요?</Text>
        </View>
      </View>

      <View style={s.footer}>
        <Pressable
          onPress={() => { void answer("먹었어요"); }}
          style={({ pressed }) => [s.answerBtn, s.yesBtn, pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
        >
          <Check size={26} color="#fff" />
          <Text style={s.answerText}>먹었어요</Text>
        </Pressable>

        <Pressable
          onPress={() => { void answer("안먹었어요"); }}
          style={({ pressed }) => [s.answerBtn, s.noBtn, pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
        >
          <X size={26} color="#fff" />
          <Text style={s.answerText}>아직 안 먹었어요</Text>
        </Pressable>

        <Pressable
          onPress={() => { void answer("나중에"); }}
          style={({ pressed }) => [s.laterBtn, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          <Clock size={20} color={colors.textSecondary} />
          <Text style={s.laterText}>이 약은 넘기기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7FAFF" },
  body: { flex: 1, padding: spacing.md, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.md },
  centerText: { fontSize: fontSizes.body, color: colors.textSecondary, textAlign: "center" },
  errorText: { fontSize: 20, color: colors.dangerRed, textAlign: "center", lineHeight: 30 },
  progress: { fontSize: fontSizes.body, fontWeight: "700", color: colors.textSecondary, marginBottom: spacing.md },
  card: {
    width: "100%", backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.lg, alignItems: "center",
  },
  pillIcon: {
    width: 72, height: 72, borderRadius: 999, backgroundColor: colors.lightBlueBg,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.md,
  },
  medName: { fontSize: 32, fontWeight: "800", color: colors.primaryNavy, textAlign: "center" },
  medTime: { fontSize: 21, color: colors.textSecondary, marginTop: spacing.xs },
  question: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  questionText: { fontSize: 26, fontWeight: "800", color: colors.text },
  footer: { padding: spacing.md, gap: spacing.sm },
  answerBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    minHeight: 68, borderRadius: radii.button,
  },
  yesBtn: { backgroundColor: colors.successGreen },
  noBtn: { backgroundColor: colors.warningOrange },
  answerText: { fontSize: 24, fontWeight: "800", color: "#fff" },
  laterBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    minHeight: minTouch, borderRadius: radii.button,
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
  },
  laterText: { fontSize: 19, fontWeight: "700", color: colors.textSecondary },
  doneIcon: {
    width: 88, height: 88, borderRadius: 999, backgroundColor: colors.successGreen + "1A",
    alignItems: "center", justifyContent: "center",
  },
  doneText: { fontSize: 24, fontWeight: "800", color: colors.primaryNavy, textAlign: "center", lineHeight: 36 },
  warnText: { fontSize: fontSizes.body, color: colors.dangerRed, textAlign: "center", lineHeight: 26 },
  primaryBtn: {
    minHeight: 60, borderRadius: radii.button, backgroundColor: colors.primaryBlue,
    alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl,
  },
  primaryBtnText: { fontSize: 21, fontWeight: "800", color: "#fff" },
});

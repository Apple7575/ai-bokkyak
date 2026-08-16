import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Mic, Check, ChevronRight, Clock, Hand } from "lucide-react-native";
import InCallManager from "react-native-incall-manager";
import { supabase } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { ensurePermission, scheduleReminders } from "../lib/notifications";
import { ensureStrongAlarmReady } from "../lib/alarmPermissions";
import { useSpeechToText } from "../hooks/useSpeechToText";
import { playCues, stopCues, currentCueId } from "../lib/cuePlayer";
import { CUES, CueId, DISCLAIMER } from "../lib/voiceScript";
import { DoseTime, Slot, SLOTS, parseUtterance, afterMealTimes, CONTEXT_WORDS } from "../lib/voiceParse";
import {
  GuideState, INITIAL_STATE, cuesForStep, onUtterance, onNoReply,
  onPickCount, onPickTimes, onConfirm, onSkip,
} from "../lib/voiceGuideFlow";
import { isLikelyEcho, isLongCue } from "../lib/voiceEcho";
import { logGuideEvent } from "../lib/analytics";
import { colors, fontSizes, spacing, radii, minTouch } from "../theme/tokens";

// 음성으로 복용 알람을 설정하는 온보딩 (문서 §4).
//
// 온보딩에서는 약 이름을 받지 않는다 — 횟수와 시간만 정한다(문서 §1).
// 약 이름은 완료 후 "1분 복용 위험 분석"에서 간편 등록으로 받는다.
//
// 음성·터치 병행(문서 §2): 모든 음성 질문의 선택지를 화면 버튼으로 동시 노출한다.
// 발화가 어려운 어르신은 처음부터 끝까지 터치만으로 진행할 수 있다.

const NO_REPLY_MS = 5000; // 문서 §5 무응답 5초

function ampm(h: number, m: number): string {
  const ap = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ap} ${h12}:${String(m).padStart(2, "0")}`;
}

export function VoiceGuideScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<GuideState>(INITIAL_STATE);
  const [caption, setCaption] = useState<string>(CUES.V01.text);
  const [saving, setSaving] = useState(false);
  const [tapHint, setTapHint] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;
  const noReplyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 로그: 버튼으로 넘어간 단계 수 / 무응답·실패 횟수 (문서 §7)
  const stats = useRef({ noReply: 0, fail: 0, buttonFallback: 0, echoFiltered: 0, tapInterrupt: 0 });

  function clearNoReply(): void {
    if (noReplyTimer.current) { clearTimeout(noReplyTimer.current); noReplyTimer.current = null; }
  }

  // 멘트를 재생하면서 동시에 마이크를 연다 (barge-in).
  //
  // 스피커 소리가 마이크로 되돌아오는 문제는 두 겹으로 막는다:
  //   ① InCallManager 통신 모드 — 기기 AEC가 걸리길 기대한다(기기마다 다름)
  //   ② 대본 대조 필터 — 인식 결과가 지금 나가는 멘트와 겹치면 버린다
  // 그래도 새는 경우를 대비해 화면 탭으로 즉시 끊을 수 있게 해 둔다(③).
  const runCues = useCallback(async (ids: CueId[], listenAfter: boolean) => {
    clearNoReply();
    const s0 = stateRef.current;
    const canListen = listenAfter && !s0.voiceOff && s0.step !== "done" && s0.step !== "skipped";
    if (ids.length > 0) {
      setCaption(CUES[ids[ids.length - 1]].text);
      setTapHint(ids.some((id) => isLongCue(CUES[id].text)));
      // 재생을 기다리지 않고 마이크를 먼저 연다 — 그래야 말을 끊을 수 있다.
      if (canListen) { try { await speech.start(); } catch {} }
      await playCues(ids);
      setTapHint(false);
    }
    const s = stateRef.current;
    if (!canListen || s.voiceOff || s.step === "done" || s.step === "skipped") return;
    try {
      // 재생 중 인식이 끝나 마이크가 닫혔을 수 있으니 다시 연다.
      await speech.start();
      // 5초 무응답 → V11 (단계마다 1회)
      noReplyTimer.current = setTimeout(() => {
        stats.current.noReply++;
        const t = onNoReply(stateRef.current);
        setState(t.state);
        if (t.play.length > 0) { speech.stop(); void runCues(t.play, true); }
      }, NO_REPLY_MS);
    } catch {
      // 마이크 권한 거부 등 — 버튼으로 계속 진행할 수 있으므로 막지 않는다.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 발화가 끝나면 상태머신에 넘긴다.
  const onSpeechFinal = useCallback((text: string) => {
    // ② 대본 대조 필터: 지금 나가는 멘트가 되돌아온 것이면 버리고 계속 듣는다.
    //    짧은 답("네", "세 번")은 필터를 타지 않는다 — voiceEcho.ts 참고.
    const playing = currentCueId();
    if (playing && isLikelyEcho(text, CUES[playing].text)) {
      stats.current.echoFiltered++;
      speech.start().catch(() => {});
      return;
    }
    // 사용자가 말했다 → 나가던 안내를 즉시 멈춘다 (barge-in).
    void stopCues();
    setTapHint(false);
    clearNoReply();
    const before = stateRef.current;
    const t = onUtterance(before, parseUtterance(text));
    if (t.state.failCount > before.failCount) stats.current.fail++;
    setState(t.state);
    void runCues(t.play, t.state.step !== "done" && t.state.step !== "skipped");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runCues]);

    // 제한 어휘를 인식기에 미리 알려 준다 (문서 §7 문맥 바이어싱)
  const speech = useSpeechToText(onSpeechFinal, CONTEXT_WORDS);

  // 첫 진입: 통신 모드를 켜고(기기 AEC 기대) V01 재생 + 듣기 시작
  useEffect(() => {
    // ① 통신 모드 + 스피커. 어르신이 폰을 귀에 대지 않아도 들리게 하면서
    //    기기 에코 제거가 걸리길 기대한다. 되는지는 기기마다 다르다.
    try {
      InCallManager.start({ media: "audio" });
      InCallManager.setSpeakerphoneOn(true);
    } catch {}
    void runCues(cuesForStep("count"), true);
    return () => {
      clearNoReply(); void stopCues();
      try { InCallManager.stop(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ③ 화면 탭으로 즉시 끊기. 에코 필터가 새거나 AEC가 안 걸리는 기기를 위한 확실한 길.
  function tapToSpeak() {
    if (!currentCueId()) return;
    void stopCues();
    setTapHint(false);
    stats.current.tapInterrupt++;
    const s = stateRef.current;
    if (s.voiceOff || s.step === "done" || s.step === "skipped") return;
    speech.start().catch(() => {});
  }

  // 버튼 입력 — 음성과 같은 상태머신을 지난다.
  function pickCount(n: number) {
    stats.current.buttonFallback++;
    speech.stop(); clearNoReply();
    const t = onPickCount(stateRef.current, n);
    setState(t.state);
    void runCues(t.play, true);
  }

  function useAfterMealDefaults() {
    stats.current.buttonFallback++;
    speech.stop(); clearNoReply();
    const s = stateRef.current;
    const t = onPickTimes(s, afterMealTimes(s.slots));
    setState(t.state);
    void runCues(t.play, true);
  }

  function confirm(ok: boolean) {
    stats.current.buttonFallback++;
    speech.stop(); clearNoReply();
    const t = onConfirm(stateRef.current, ok);
    setState(t.state);
    void runCues(t.play, !ok);
  }

  function skip() {
    speech.stop(); clearNoReply();
    const t = onSkip(stateRef.current);
    setState(t.state);
    void runCues(t.play, false);
    void logGuideEvent({ step: "skipped", ...stats.current });
    setTimeout(() => nav.reset({ index: 0, routes: [{ name: "Tabs" }] }), 1500);
  }

  // 시간 카드 탭 — 시각을 30분 단위로 조정한다(문서 §4 "탭 수정 가능").
  function bumpTime(i: number, deltaMin: number) {
    setState((prev) => {
      const times = [...prev.times];
      const t = times[i];
      if (!t) return prev;
      let total = t.hour * 60 + t.minute + deltaMin;
      total = ((total % 1440) + 1440) % 1440;
      times[i] = { ...t, hour: Math.floor(total / 60), minute: total % 60 };
      return { ...prev, times };
    });
  }

  // 완료 → 알람 저장. 약 이름은 아직 없으므로 시간대 이름으로 임시 등록한다
  // (문서 §1: 온보딩에서 약 이름을 받지 않는다).
  async function saveAlarms(): Promise<void> {
    if (saving) return;
    setSaving(true);
    const pid = await getPatientId();
    if (!pid) { setSaving(false); return; }
    try {
      await ensureStrongAlarmReady();
      const granted = await ensurePermission();
      for (const t of state.times) {
        const { data, error } = await supabase.from("schedules").insert({
          patient_id: pid,
          medicine_name: `${t.slot} 약`,   // 위험 분석에서 실제 약 이름으로 바꾼다
          time_of_day: t.slot, hour: t.hour, minute: t.minute,
          repeat_days: [] as number[], active: true,
        }).select().single();
        if (error || !data) throw error ?? new Error("insert 실패");
        if (granted) {
          try {
            await scheduleReminders(data.id, data.medicine_name, t.hour, t.minute, [], t.slot);
          } catch {}
        }
      }
      void logGuideEvent({ step: "done", ...stats.current });
      nav.reset({ index: 0, routes: [{ name: "Tabs" }, { name: "RegisterMethod" }] });
    } catch {
      Alert.alert("저장에 실패했어요", "인터넷 연결을 확인하고 다시 시도해 주세요.");
      setSaving(false);
    }
  }

  const listening = speech.listening;

  return (
    <Pressable style={styles.screen} onPress={tapToSpeak} accessibilityRole="button">
      <ScrollView contentContainerStyle={[styles.c, { paddingTop: insets.top + spacing.md, paddingBottom: spacing.xl + insets.bottom }]}>
        {/* 우상단 건너뛰기 — 단계 1~3 어디서든 (문서 §4) */}
        {state.step !== "done" && state.step !== "skipped" ? (
          <Pressable onPress={skip} style={styles.skipBtn} hitSlop={10}>
            <Text style={styles.skipText}>나중에 설정할게요</Text>
          </Pressable>
        ) : null}

        {/* 음성 인디케이터 + 자막 */}
        <View style={styles.micWrap}>
          <View style={[styles.micHalo, listening && styles.micHaloOn]}>
            <View style={styles.micCircle}>
              <Mic size={40} color={listening ? colors.primaryBlue : colors.textSecondary} />
            </View>
          </View>
          <Text style={styles.listenLabel}>
            {state.voiceOff ? "아래 버튼으로 골라 주세요"
              : listening ? "듣고 있어요" : "잠시만요…"}
          </Text>
        </View>

        <Text style={styles.caption}>{caption}</Text>
        {tapHint ? (
          <View style={styles.tapHint}>
            <Hand size={20} color={colors.primaryBlue} />
            <Text style={styles.tapHintText}>말씀하시려면 화면을 눌러 주세요</Text>
          </View>
        ) : null}
        {speech.transcript ? <Text style={styles.heard}>{speech.transcript}</Text> : null}

        {/* 단계 1 — 횟수 버튼 2x2 (문서 §4) */}
        {state.step === "count" ? (
          <View style={styles.grid}>
            {[1, 2, 3, 4].map((n) => (
              <Pressable key={n} onPress={() => pickCount(n)}
                style={({ pressed }) => [styles.gridBtn, pressed && { opacity: 0.9 }]}>
                <Text style={styles.gridText}>{n === 4 ? "4번 이상" : `${n}번`}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* 단계 2 — 시간대 칩 + 시간 카드 */}
        {state.step === "time" ? (
          <>
            <View style={styles.chipRow}>
              {SLOTS.filter((s) => state.slots.includes(s)).map((s: Slot) => (
                <View key={s} style={styles.chip}><Text style={styles.chipText}>{s}</Text></View>
              ))}
            </View>
            {state.times.map((t: DoseTime, i: number) => (
              <View key={`${t.slot}-${i}`} style={styles.timeCard}>
                <Clock size={20} color={colors.primaryBlue} />
                <Text style={styles.timeSlot}>{t.slot}</Text>
                <Pressable onPress={() => bumpTime(i, -30)} style={styles.bump} hitSlop={8}>
                  <Text style={styles.bumpText}>−30분</Text>
                </Pressable>
                <Text style={styles.timeValue}>{ampm(t.hour, t.minute)}</Text>
                <Pressable onPress={() => bumpTime(i, 30)} style={styles.bump} hitSlop={8}>
                  <Text style={styles.bumpText}>+30분</Text>
                </Pressable>
              </View>
            ))}
            <Pressable onPress={useAfterMealDefaults}
              style={({ pressed }) => [styles.wideBtn, pressed && { opacity: 0.9 }]}>
              <Text style={styles.wideText}>
                {state.times.length > 0 ? "이 시간으로 할게요" : "식사 후로 맞춰 주세요"}
              </Text>
            </Pressable>
          </>
        ) : null}

        {/* 단계 3 — 요약. 동적 내용은 화면 전용, 음성으로 읽지 않는다 (문서 §2) */}
        {state.step === "confirm" ? (
          <>
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>하루 {state.times.length}번 알림을 드릴게요</Text>
              {state.times.map((t, i) => (
                <Text key={i} style={styles.summaryLine}>{`${t.slot} · ${ampm(t.hour, t.minute)}`}</Text>
              ))}
            </View>
            <Pressable onPress={() => confirm(true)}
              style={({ pressed }) => [styles.wideBtn, pressed && { opacity: 0.9 }]}>
              <Check size={22} color="#fff" />
              <Text style={styles.wideText}>네, 맞아요</Text>
            </Pressable>
            <Pressable onPress={() => confirm(false)}
              style={({ pressed }) => [styles.wideBtnGhost, pressed && { opacity: 0.9 }]}>
              <Text style={styles.wideTextGhost}>다시 설정할게요</Text>
            </Pressable>
          </>
        ) : null}

        {/* 단계 4 — 완료 + 위험 분석 제안 */}
        {state.step === "done" ? (
          <>
            <View style={styles.doneCard}>
              <Check size={36} color={colors.successGreen} />
              <Text style={styles.doneTitle}>복용 알람 설정이 끝났어요</Text>
              {state.times.map((t, i) => (
                <Text key={i} style={styles.summaryLine}>{`${t.slot} · ${ampm(t.hour, t.minute)}`}</Text>
              ))}
            </View>

            <View style={styles.riskCard}>
              <View style={styles.badge}><Text style={styles.badgeText}>간편 등록으로 평생 복용 관리</Text></View>
              <Text style={styles.riskTitle}>1분 복용 위험 분석</Text>
              <Text style={styles.riskDesc}>
                약과 영양제를 여러 개 함께 드시면 자칫 약이 독이 될 수도 있어요.
                지금 드시는 조합이 괜찮은지 확인해 보세요.
              </Text>
              <Pressable onPress={() => { void saveAlarms(); }} disabled={saving}
                style={({ pressed }) => [styles.wideBtn, (pressed || saving) && { opacity: 0.9 }]}>
                <Text style={styles.wideText}>
                  {saving ? "저장 중…" : "1분 복용 위험 분석 시작하기"}
                </Text>
                <ChevronRight size={20} color="#fff" />
              </Pressable>
            </View>

            <Pressable onPress={() => { void saveAlarms(); }} style={styles.homeLink} hitSlop={8}>
              <Text style={styles.homeLinkText}>홈으로 갈게요</Text>
            </Pressable>
            <Text style={styles.disclaimer}>{DISCLAIMER}</Text>
          </>
        ) : null}
      </ScrollView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.lightBlueBg },
  c: { padding: spacing.md, gap: spacing.md },
  skipBtn: { alignSelf: "flex-end", paddingHorizontal: spacing.sm, paddingVertical: 6 },
  skipText: { fontSize: fontSizes.body, color: colors.textSecondary, fontWeight: "600" },
  micWrap: { alignItems: "center", gap: spacing.sm },
  micHalo: {
    width: 128, height: 128, borderRadius: 999, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(100,116,139,0.10)",
  },
  micHaloOn: { backgroundColor: "rgba(37,99,235,0.16)" },
  micCircle: {
    width: 92, height: 92, borderRadius: 999, backgroundColor: colors.cardBg,
    alignItems: "center", justifyContent: "center",
  },
  listenLabel: { fontSize: fontSizes.body, color: colors.textSecondary, fontWeight: "700" },
  caption: {
    fontSize: 21, color: colors.text, lineHeight: 32, textAlign: "center",
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md,
  },
  heard: { fontSize: 19, color: colors.primaryBlue, textAlign: "center", fontWeight: "700" },
  tapHint: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    backgroundColor: colors.lightBlueBg, borderRadius: radii.pill,
    paddingVertical: 10, paddingHorizontal: spacing.md,
  },
  tapHintText: { fontSize: 17, fontWeight: "700", color: colors.primaryBlue },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  gridBtn: {
    width: "48%", minHeight: 88, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card,
  },
  gridText: { fontSize: 26, fontWeight: "800", color: colors.primaryNavy },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center" },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radii.pill,
    backgroundColor: colors.primaryBlue,
  },
  chipText: { fontSize: 19, fontWeight: "800", color: "#fff" },
  timeCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md, minHeight: minTouch,
  },
  timeSlot: { fontSize: 19, fontWeight: "800", color: colors.text, width: 52 },
  timeValue: { flex: 1, fontSize: 21, fontWeight: "800", color: colors.primaryBlue, textAlign: "center" },
  bump: {
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: radii.button,
    backgroundColor: colors.lightBlueBg,
  },
  bumpText: { fontSize: 15, fontWeight: "700", color: colors.primaryBlue },
  wideBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    minHeight: minTouch, borderRadius: radii.button, backgroundColor: colors.primaryBlue,
  },
  wideText: { fontSize: 20, fontWeight: "800", color: "#fff" },
  wideBtnGhost: {
    alignItems: "center", justifyContent: "center", minHeight: minTouch,
    borderRadius: radii.button, backgroundColor: colors.cardBg,
    borderColor: colors.border, borderWidth: 1,
  },
  wideTextGhost: { fontSize: 20, fontWeight: "700", color: colors.text },
  summary: {
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.lg, gap: 6,
  },
  summaryTitle: { fontSize: 24, fontWeight: "800", color: colors.primaryNavy, marginBottom: spacing.xs },
  summaryLine: { fontSize: 21, color: colors.text },
  doneCard: {
    alignItems: "center", gap: 6,
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.lg,
  },
  doneTitle: { fontSize: 24, fontWeight: "800", color: colors.primaryNavy, marginVertical: spacing.xs },
  riskCard: {
    backgroundColor: colors.cardBg, borderColor: colors.primaryBlue, borderWidth: 2,
    borderRadius: radii.card, padding: spacing.lg, gap: spacing.sm,
  },
  badge: {
    alignSelf: "flex-start", backgroundColor: colors.lightBlueBg,
    borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 5,
  },
  badgeText: { fontSize: 14, fontWeight: "800", color: colors.primaryBlue },
  riskTitle: { fontSize: 24, fontWeight: "800", color: colors.primaryNavy },
  riskDesc: { fontSize: 18, color: colors.textSecondary, lineHeight: 27, marginBottom: spacing.xs },
  homeLink: { alignSelf: "center", paddingVertical: spacing.sm },
  homeLinkText: { fontSize: fontSizes.body, color: colors.textSecondary, fontWeight: "600" },
  disclaimer: { fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 21 },
});

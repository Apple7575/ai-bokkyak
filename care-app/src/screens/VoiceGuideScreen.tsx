import React, { useCallback, useEffect, useRef, useState } from "react";
import { Image, View, Text, ScrollView, StyleSheet, Pressable, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Volume2, Check, ChevronRight, ChevronLeft, Clock } from "lucide-react-native";
import { supabase } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { ensurePermission, scheduleReminders } from "../lib/notifications";
import { ensureStrongAlarmReady } from "../lib/alarmPermissions";
import { playCues, stopCues, currentCueId } from "../lib/cuePlayer";
import { useTypedCaption } from "../hooks/useTypedCaption";
import { CUES, CueId, DISCLAIMER } from "../lib/voiceScript";
import { DoseTime, Slot, SLOTS, afterMealTimes } from "../lib/voiceParse";
import { slotLabel } from "../lib/timeOfDay";
import {
  GuideState, INITIAL_STATE, cuesForStep,
  onPickCount, onPickTimes, onAcceptDefaults, onConfirm, onSkip,
  stepIndex, GUIDE_TOTAL_STEPS,
} from "../lib/voiceGuideFlow";
import { logGuideEvent } from "../lib/analytics";
import { colors, fontSizes, spacing, radii, minTouch } from "../theme/tokens";

const VOICE_ART = require("../../assets/illustrations/voice-companion.png");

// 복용 알람 설정 온보딩 (문서 §4).
//
// 안내는 음성으로, 대답은 화면 터치로 받는다. 음성 입력(STT)은 뺐다 —
// 인식 실패·에코·마이크 권한이라는 실패 지점이 셋이나 되는데, 온보딩은
// 여기서 막히면 앱 자체를 못 쓰는 자리라 확실한 길 하나만 남겼다.
// 그래서 멘트도 "말씀해 주세요"가 아니라 "아래에서 골라 주세요"라고 한다.
//
// 온보딩에서는 약 이름을 받지 않는다 — 횟수와 시간만 정한다(문서 §1).
// 약 이름은 완료 후 "1분 복용 위험 분석"에서 간편 등록으로 받는다.

function ampm(h: number, m: number): string {
  const ap = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ap} ${h12}:${String(m).padStart(2, "0")}`;
}

export function VoiceGuideScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<GuideState>(INITIAL_STATE);
  // caption은 멘트 원문(접근성·폴백용), typed는 음성 길이에 맞춰 타이핑되는 표시본.
  const [caption, setCaption] = useState<string>(CUES.V01.text);
  const typed = useTypedCaption();
  const [saving, setSaving] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  // 지금 시각을 조정 중인 시간 카드. 시안대로 고른 카드에만 −/+ 를 띄운다.
  const [editing, setEditing] = useState<number | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  // 로그 (문서 §7): 어디서 막히는지 보려면 진행 방식과 안내를 끊은 횟수가 필요하다.
  const stats = useRef({ buttonFallback: 0, tapInterrupt: 0 });

  // 멘트를 재생하고 자막을 그 길이에 맞춰 친다.
  const runCues = useCallback(async (ids: CueId[]) => {
    if (ids.length === 0) return;
    setCaption(CUES[ids[ids.length - 1]].text);
    setSpeaking(true);
    await playCues(ids, (id, durationMs) => {
      setCaption(CUES[id].text);
      typed.begin(CUES[id].text, durationMs);
    });
    setSpeaking(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 첫 진입: V01 재생
  useEffect(() => {
    void runCues(cuesForStep("count"));
    return () => { void stopCues(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 화면 탭 = 안내 건너뛰기. 이미 아는 내용을 끝까지 듣고 있을 필요는 없다.
  // 끊더라도 자막은 전문으로 채워 둔다 — 반쯤 친 문장이 남으면 읽을 수가 없다.
  function skipNarration() {
    const playing = currentCueId();
    if (!playing) return;
    void stopCues();
    typed.finish(CUES[playing].text);
    setSpeaking(false);
    stats.current.tapInterrupt++;
  }

  function pickCount(n: number) {
    stats.current.buttonFallback++;
    const t = onPickCount(stateRef.current, n);
    setState(t.state);
    setEditing(null);
    void runCues(t.play);
  }

  // 시간대 칩 탭 — 그 시간대의 카드를 조정 대상으로 고른다 (시안).
  function selectSlot(slot: Slot) {
    const i = stateRef.current.times.findIndex((t) => t.slot === slot);
    setEditing((prev) => (i < 0 || prev === i ? null : i));
  }

  function useAfterMealDefaults() {
    stats.current.buttonFallback++;
    const s = stateRef.current;
    // 시각이 아직 없으면 식후 기본값을 제안(V03)하고, 있으면 그대로 확정한다.
    if (s.times.length === 0) {
      const times = afterMealTimes(s.slots);
      setState({ ...s, times, proposedDefaults: true });
      void runCues(["V03"]);
      return;
    }
    const t = onPickTimes(s, s.times);
    setState(t.state);
    void runCues(t.play);
  }

  // V03(식후 기본값 제안)에 대한 응답.
  function acceptDefaults(ok: boolean) {
    stats.current.buttonFallback++;
    const t = onAcceptDefaults(stateRef.current, ok);
    setState(t.state);
    void runCues(t.play);
  }

  function confirm(ok: boolean) {
    stats.current.buttonFallback++;
    const t = onConfirm(stateRef.current, ok);
    setState(t.state);
    setEditing(null);
    void runCues(t.play);
  }

  function skip() {
    const t = onSkip(stateRef.current);
    setState(t.state);
    void runCues(t.play);
    void logGuideEvent({ step: "skipped", ...stats.current });
    setTimeout(() => nav.reset({ index: 0, routes: [{ name: "Tabs" }] }), 1500);
  }

  // 시각을 30분 단위로 조정한다 (문서 §4 "탭 수정 가능").
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

  const progress = stepIndex(state.step);

  // 뒤로: 한 단계 되돌린다. 첫 단계에서 누르면 안내를 그만두고 앞 화면으로.
  // 되돌아간 단계의 멘트를 다시 재생해 어디로 왔는지 소리로도 알려 준다.
  function goBack() {
    void stopCues();
    setEditing(null);
    const s = stateRef.current;
    if (s.step === "time") {
      setState({ ...s, step: "count", proposedDefaults: false });
      void runCues(cuesForStep("count"));
      return;
    }
    if (s.step === "confirm") {
      setState({ ...s, step: "time" });
      void runCues(cuesForStep("time"));
      return;
    }
    if (nav.canGoBack()) nav.goBack();
  }

  return (
    // 상단 인셋은 ScrollView 바깥에. contentContainerStyle에 주면 스크롤할 때
    // 내용이 상태바 밑으로 올라와 겹친다.
    <Pressable style={[styles.screen, { paddingTop: insets.top }]} onPress={skipNarration}
      accessibilityRole="button" accessibilityLabel="안내 건너뛰기">
      <ScrollView contentContainerStyle={[styles.c, { paddingTop: spacing.md, paddingBottom: spacing.xl + insets.bottom }]}>
        {/* 헤더 — 뒤로가기 · 진행 표시(4칸) · 건너뛰기 (시안 + 문서 §4) */}
        <View style={styles.header}>
          <Pressable onPress={goBack} hitSlop={12} style={styles.backBtn}
            accessibilityRole="button" accessibilityLabel="뒤로">
            <ChevronLeft size={26} color={colors.textSecondary} />
          </Pressable>

          {progress !== null ? (
            <View style={styles.progressWrap} accessibilityLabel={`${progress}단계, 전체 ${GUIDE_TOTAL_STEPS}단계`}>
              <View style={styles.segRow}>
                {Array.from({ length: GUIDE_TOTAL_STEPS }, (_, i) => (
                  <View key={i} style={[styles.seg, i < progress && styles.segOn]} />
                ))}
              </View>
              <Text style={styles.progressText}>{progress}/{GUIDE_TOTAL_STEPS}</Text>
            </View>
          ) : <View style={styles.progressWrap} />}

          {state.step !== "done" && state.step !== "skipped" ? (
            <Pressable onPress={skip} hitSlop={10} style={styles.skipBtn}>
              <Text style={styles.skipText}>나중에</Text>
            </Pressable>
          ) : <View style={styles.skipBtn} />}
        </View>

        {/* 안내 음성 인디케이터 — 마이크가 아니라 스피커다. 듣는 게 아니라 말하는 중이라는 뜻. */}
        <View style={styles.voiceArtCard}>
          <Image source={VOICE_ART} style={styles.voiceArt} resizeMode="contain" />
        </View>

        <View style={styles.micWrap}>
          <View style={[styles.micHalo, speaking && styles.micHaloOn]}>
            <View style={styles.micCircle}>
              <Volume2 size={40} color={speaking ? colors.primaryBlue : colors.textSecondary} />
            </View>
          </View>
          <Text style={styles.listenLabel}>
            {speaking ? "안내해 드리고 있어요" : "아래에서 골라 주세요"}
          </Text>
        </View>

        <Text style={styles.caption}>{typed.display || caption}</Text>

        {/* 단계 1 — 횟수 버튼 2x2 (문서 §4) */}
        {state.step === "count" ? (
          <View style={styles.grid}>
            {[1, 2, 3, 4].map((n) => (
              <Pressable key={n} onPress={() => pickCount(n)}
                style={({ pressed }) => [styles.gridBtn, pressed && styles.pressedCard]}>
                <Text style={styles.gridText}>{n === 4 ? "4번 이상" : `${n}번`}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* 단계 2 — 시간대 칩 + 시간 카드. 칩을 누르면 그 카드만 −/+ 가 열린다 (시안) */}
        {state.step === "time" ? (
          <>
            <View style={styles.chipRow}>
              {SLOTS.filter((s) => state.slots.includes(s)).map((s: Slot) => {
                const i = state.times.findIndex((t) => t.slot === s);
                const on = editing !== null && editing === i;
                return (
                  <Pressable key={s} onPress={() => selectSlot(s)} hitSlop={6}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.9 }]}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{slotLabel(s)}</Text>
                  </Pressable>
                );
              })}
            </View>

            {state.times.map((t: DoseTime, i: number) => {
              const open = editing === i;
              return (
                <Pressable key={`${t.slot}-${i}`} onPress={() => setEditing(open ? null : i)}
                  style={[styles.timeCard, open && styles.timeCardOn]}
                  accessibilityRole="button"
                  accessibilityLabel={`${slotLabel(t.slot)} ${ampm(t.hour, t.minute)}, 눌러서 시간 조정`}>
                  <Clock size={20} color={open ? colors.primaryBlue : colors.textSecondary} />
                  <Text style={styles.timeSlot}>{slotLabel(t.slot)}</Text>
                  {open ? (
                    <Pressable onPress={() => bumpTime(i, -30)} style={styles.bump} hitSlop={8}
                      accessibilityLabel="30분 앞으로">
                      <Text style={styles.bumpText}>−30분</Text>
                    </Pressable>
                  ) : null}
                  <Text style={styles.timeValue}>{ampm(t.hour, t.minute)}</Text>
                  {open ? (
                    <Pressable onPress={() => bumpTime(i, 30)} style={styles.bump} hitSlop={8}
                      accessibilityLabel="30분 뒤로">
                      <Text style={styles.bumpText}>+30분</Text>
                    </Pressable>
                  ) : null}
                </Pressable>
              );
            })}

            {/* 식후 기본값을 제안한 상태(V03)면 네/다시로 받는다 */}
            {state.proposedDefaults ? (
              <>
                <Pressable onPress={() => acceptDefaults(true)}
                  style={({ pressed }) => [styles.wideBtn, pressed && { opacity: 0.9 }]}>
                  <Check size={22} color="#fff" />
                  <Text style={styles.wideText}>네, 이 시간으로 할게요</Text>
                </Pressable>
                <Pressable onPress={() => acceptDefaults(false)}
                  style={({ pressed }) => [styles.wideBtnGhost, pressed && { opacity: 0.9 }]}>
                  <Text style={styles.wideTextGhost}>다시 고를게요</Text>
                </Pressable>
              </>
            ) : (
              <Pressable onPress={useAfterMealDefaults}
                style={({ pressed }) => [styles.wideBtn, pressed && { opacity: 0.9 }]}>
                <Text style={styles.wideText}>
                  {state.times.length > 0 ? "이 시간으로 할게요" : "식사 후로 맞춰 주세요"}
                </Text>
              </Pressable>
            )}
          </>
        ) : null}

        {/* 단계 3 — 요약. 동적 내용은 화면 전용, 음성으로 읽지 않는다 (문서 §2) */}
        {state.step === "confirm" ? (
          <>
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>하루 {state.times.length}번 알림을 드릴게요</Text>
              {state.times.map((t, i) => (
                <Text key={i} style={styles.summaryLine}>{`${slotLabel(t.slot)} · ${ampm(t.hour, t.minute)}`}</Text>
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
                <Text key={i} style={styles.summaryLine}>{`${slotLabel(t.slot)} · ${ampm(t.hour, t.minute)}`}</Text>
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
  screen: { flex: 1, backgroundColor: colors.canvas },
  voiceArtCard: { width: "100%", height: 180, borderRadius: radii.hero, backgroundColor: colors.coralSoft, overflow: "hidden", marginBottom: spacing.md },
  voiceArt: { width: "106%", height: "112%", marginLeft: -8, marginTop: -8 },
  c: { padding: spacing.md, gap: spacing.md },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  backBtn: { width: 60, height: 44, justifyContent: "center" },
  skipBtn: { width: 60, height: 44, alignItems: "flex-end", justifyContent: "center" },
  progressWrap: { flex: 1, alignItems: "center" },
  segRow: { flexDirection: "row", gap: 6 },
  seg: { width: 26, height: 5, borderRadius: 3, backgroundColor: colors.border },
  segOn: { backgroundColor: colors.primaryBlue },
  progressText: {
    marginTop: 6, fontSize: 13, fontWeight: "700", color: colors.textSecondary,
  },
  skipText: { fontSize: fontSizes.body, color: colors.textSecondary, fontWeight: "600" },
  micWrap: { alignItems: "center", gap: spacing.sm },
  micHalo: {
    width: 128, height: 128, borderRadius: 999, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.canvasMuted,
  },
  micHaloOn: { backgroundColor: colors.primarySoft },
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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  gridBtn: {
    width: "48%", minHeight: 88, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card,
  },
  pressedCard: { opacity: 0.9, borderColor: colors.primaryBlue },
  gridText: { fontSize: 26, fontWeight: "800", color: colors.primaryNavy },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center" },
  chip: {
    minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radii.pill,
    justifyContent: "center",
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
  },
  chipOn: { backgroundColor: colors.primaryBlue, borderColor: colors.primaryBlue },
  chipText: { fontSize: 19, fontWeight: "800", color: colors.textSecondary },
  chipTextOn: { color: "#fff" },
  timeCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md, minHeight: minTouch,
  },
  timeCardOn: { borderColor: colors.primaryBlue, borderWidth: 2 },
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

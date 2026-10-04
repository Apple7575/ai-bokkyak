import React, { useEffect, useRef, useState } from "react";
import { Image, View, Text, ScrollView, StyleSheet, Pressable, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronLeft, Clock } from "lucide-react-native";
import { BigButton } from "../components/BigButton";
import { supabase } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { isKakaoLinked, linkKakao } from "../lib/kakaoAccount";
import { ensurePermission, scheduleReminders, warnNotificationsOff } from "../lib/notifications";
import { ensureStrongAlarmReady } from "../lib/alarmPermissions";
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
// 안내는 글자로, 대답은 화면 터치로 받는다. 음성 입력(STT)은 뺐다 —
// 인식 실패·에코·마이크 권한이라는 실패 지점이 셋이나 되는데, 온보딩은
// 여기서 막히면 앱 자체를 못 쓰는 자리라 확실한 길 하나만 남겼다.
// 그래서 문구도 "말씀해 주세요"가 아니라 "아래에서 골라 주세요"라고 한다.
//
// 2026-10-03 팀 결정: 이 화면은 글자만 보여 준다. 녹음 멘트 재생·음성 길이에
// 맞춘 자막 타이핑·화면 탭으로 재생 중단은 모두 뺐다(재생기·타이핑 훅·mp3 삭제).
// 문장은 여전히 voiceScript.ts 한 곳에 있고, 어느 단계에 어느 문장을 보여 줄지는
// voiceGuideFlow.ts가 정한다. 한 단계에 문장이 여럿이면 줄바꿈으로 이어 붙여
// 한 번에 전부 보여 준다.
//
// 온보딩에서는 약 이름을 받지 않는다 — 횟수와 시간만 정한다(문서 §1).
// 약 이름은 나중에 약장의 간편 등록에서 받는다. (회의 2026-09-03: 알람 설정을
// 마치면 바로 홈이다 — 위험 분석을 여기서 다시 제안하지 않는다. 점검은
// 인트로 → 1분 점검 → 가입 → 결과 → 알람 설정의 한 흐름으로만 잇는다.)

// 단계에 딸린 문장(들)을 화면에 보여 줄 한 덩어리로 합친다. 여럿이면 줄바꿈으로 잇는다.
function captionFor(ids: CueId[]): string {
  return ids.map((id) => CUES[id].text).join("\n");
}

function ampm(h: number, m: number): string {
  const ap = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ap} ${h12}:${String(m).padStart(2, "0")}`;
}

export function VoiceGuideScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<GuideState>(INITIAL_STATE);
  // 지금 단계의 안내 문구. 들어서는 즉시 전문을 그대로 보여 준다.
  const [caption, setCaption] = useState<string>(captionFor(cuesForStep("count")));
  const [saving, setSaving] = useState(false);
  // 더블탭 동기 가드 — state만으로는 첫 await 사이의 두 번째 탭을 못 막아 알람 행이 두 벌 생긴다.
  const savingRef = useRef(false);
  // 지금 시각을 조정 중인 시간 카드. 시안대로 고른 카드에만 −/+ 를 띄운다.
  const [editing, setEditing] = useState<number | null>(null);
  // 완료 단계의 카카오 "연결" 카드 — 회의 2026-09-10: 카카오는 기기 이전용 연결. 미연결(false)일 때만 띄운다.
  // null(아직 모름·조회 실패)·true면 카드 없음. saving과 별개의 busy — 연결 중에도 "홈으로 가기"는 살아 있다.
  const [linked, setLinked] = useState<boolean | null>(null);
  const [linking, setLinking] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;
  // 로그 (문서 §7): 어디서 막히는지 보려면 진행 방식이 필요하다.
  // tapInterrupt는 음성을 끊은 횟수였다 — 글자만 보여 주는 지금은 늘 0이지만
  // 로그 스키마(voice_guide_events.tap_interrupt_count)는 그대로라 열은 남긴다.
  const stats = useRef({ buttonFallback: 0, tapInterrupt: 0 });

  // 단계에 딸린 문구를 즉시 전부 보여 준다. 빈 배열이면 지금 문구를 유지한다.
  function showCues(ids: CueId[]) {
    if (ids.length === 0) return;
    setCaption(captionFor(ids));
  }

  // 완료 단계에 들어서면 연결 상태를 한 번 조회한다.
  useEffect(() => {
    if (state.step !== "done") return;
    let alive = true;
    (async () => {
      const pid = await getPatientId();
      if (!pid) return;
      const v = await isKakaoLinked(pid);
      if (alive) setLinked(v);
    })();
    return () => { alive = false; };
  }, [state.step]);

  async function linkAccount(): Promise<void> {
    if (linking) return;
    const pid = await getPatientId();
    if (!pid) return;
    setLinking(true);
    try {
      const r = await linkKakao(pid);
      if (r.ok) {
        setLinked(true);
        Alert.alert("연결됐어요", "휴대폰을 바꿔도 이 정보를 그대로 쓸 수 있어요.");
      } else if (!r.canceled) {
        Alert.alert("카카오 연결하기", r.message);
      }
    } finally {
      setLinking(false);
    }
  }

  function pickCount(n: number) {
    stats.current.buttonFallback++;
    const t = onPickCount(stateRef.current, n);
    setState(t.state);
    setEditing(null);
    showCues(t.play);
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
      showCues(["V03"]);
      return;
    }
    const t = onPickTimes(s, s.times);
    setState(t.state);
    showCues(t.play);
  }

  // V03(식후 기본값 제안)에 대한 응답.
  function acceptDefaults(ok: boolean) {
    stats.current.buttonFallback++;
    const t = onAcceptDefaults(stateRef.current, ok);
    setState(t.state);
    showCues(t.play);
  }

  function confirm(ok: boolean) {
    stats.current.buttonFallback++;
    const t = onConfirm(stateRef.current, ok);
    setState(t.state);
    setEditing(null);
    showCues(t.play);
  }

  function skip() {
    const t = onSkip(stateRef.current);
    setState(t.state);
    showCues(t.play);
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
    if (savingRef.current) return;
    savingRef.current = true; // 첫 await 전에 동기적으로 잠근다
    setSaving(true);
    const pid = await getPatientId();
    if (!pid) { savingRef.current = false; setSaving(false); return; }
    try {
      await ensureStrongAlarmReady();
      const granted = await ensurePermission();
      for (const t of state.times) {
        const { data, error } = await supabase.from("schedules").insert({
          patient_id: pid,
          medicine_name: `${t.slot} 약`,   // 약장의 간편 등록에서 실제 약 이름으로 바꾼다
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
      // 저장은 됐지만 알림 권한이 없으면 알람이 조용히 안 울린다 — 그 사실을 알린다.
      if (!granted) warnNotificationsOff();
      // 회의 2026-09-03: 알람 설정을 마치면 바로 홈. 약 등록·위험 분석을 이어 붙이지 않는다.
      nav.reset({ index: 0, routes: [{ name: "Tabs" }] });
    } catch {
      Alert.alert("저장에 실패했어요", "인터넷 연결을 확인하고 다시 시도해 주세요.");
      savingRef.current = false;
      setSaving(false);
    }
  }

  const progress = stepIndex(state.step);

  // 뒤로: 한 단계 되돌린다. 첫 단계에서 누르면 안내를 그만두고 앞 화면으로.
  // 되돌아간 단계의 문구를 다시 보여 줘 어디로 왔는지 알려 준다.
  function goBack() {
    setEditing(null);
    const s = stateRef.current;
    if (s.step === "time") {
      setState({ ...s, step: "count", proposedDefaults: false });
      showCues(cuesForStep("count"));
      return;
    }
    if (s.step === "confirm") {
      setState({ ...s, step: "time" });
      showCues(cuesForStep("time"));
      return;
    }
    if (nav.canGoBack()) nav.goBack();
  }

  return (
    // 상단 인셋은 ScrollView 바깥에. contentContainerStyle에 주면 스크롤할 때
    // 내용이 상태바 밑으로 올라와 겹친다.
    <View style={[styles.screen, { paddingTop: insets.top }]}>
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
            <Pressable onPress={skip} hitSlop={10} style={styles.skipBtn}
              accessibilityRole="button" accessibilityLabel="나중에 설정하기">
              <Text style={styles.skipText}>나중에</Text>
            </Pressable>
          ) : <View style={styles.skipBtn} />}
        </View>

        <View style={styles.voiceArtCard}>
          <Image source={VOICE_ART} style={styles.voiceArt} resizeMode="contain" />
        </View>

        {/* 안내 문구 — 소리 없이 글자로만. 들어서는 즉시 전문이 보인다. */}
        <Text style={styles.caption} accessibilityRole="text" accessibilityLiveRegion="polite">
          {caption}
        </Text>

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
                      accessibilityRole="button" accessibilityLabel="30분 앞으로">
                      <Text style={styles.bumpText}>−30분</Text>
                    </Pressable>
                  ) : null}
                  <Text style={styles.timeValue}>{ampm(t.hour, t.minute)}</Text>
                  {open ? (
                    <Pressable onPress={() => bumpTime(i, 30)} style={styles.bump} hitSlop={8}
                      accessibilityRole="button" accessibilityLabel="30분 뒤로">
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
                  <Check size={22} color={colors.white} />
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
              <Check size={22} color={colors.white} />
              <Text style={styles.wideText}>네, 맞아요</Text>
            </Pressable>
            <Pressable onPress={() => confirm(false)}
              style={({ pressed }) => [styles.wideBtnGhost, pressed && { opacity: 0.9 }]}>
              <Text style={styles.wideTextGhost}>다시 설정할게요</Text>
            </Pressable>
          </>
        ) : null}

        {/* 단계 4 — 완료. 회의 2026-09-03: 위험 분석을 다시 제안하지 않고 바로 홈으로 */}
        {state.step === "done" ? (
          <>
            <View style={styles.doneCard}>
              <Check size={36} color={colors.successGreen} />
              <Text style={styles.doneTitle}>복용 알람 설정이 끝났어요</Text>
              {state.times.map((t, i) => (
                <Text key={i} style={styles.summaryLine}>{`${slotLabel(t.slot)} · ${ampm(t.hour, t.minute)}`}</Text>
              ))}
            </View>

            {/* 카카오 연결 제안 — 미연결일 때만. 홈으로 가기는 연결과 무관하게 아래에 그대로 */}
            {linked === false ? (
              <View style={styles.linkCard}>
                <Text style={styles.linkTitle}>휴대폰을 바꿔도 그대로</Text>
                <Text style={styles.linkBody}>지금 정보는 이 휴대폰에만 있어요. 카카오를 연결하면 새 기기에서도 이어서 쓸 수 있어요.</Text>
                <BigButton variant="secondary" label={linking ? "연결 중…" : "카카오 연결하기"} onPress={() => { void linkAccount(); }} disabled={linking} />
              </View>
            ) : null}

            {/* 이 버튼이 실제로 알람을 저장한다 — "홈으로 가기"라고만 쓰면 저장되는 줄 모른다 */}
            <BigButton label={saving ? "저장 중…" : "알람 저장하고 홈으로"} onPress={() => { void saveAlarms(); }} disabled={saving} />
            <Text style={styles.disclaimer}>{DISCLAIMER}</Text>
          </>
        ) : null}
      </ScrollView>
    </View>
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
    marginTop: 6, fontSize: 16, fontWeight: "700", color: colors.textSecondary,
  },
  skipText: { fontSize: fontSizes.body, color: colors.textSecondary, fontWeight: "600" },
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
  chipTextOn: { color: colors.white },
  timeCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md, minHeight: minTouch,
  },
  timeCardOn: { borderColor: colors.primaryBlue, borderWidth: 2 },
  timeSlot: { fontSize: 19, fontWeight: "800", color: colors.text, width: 52 },
  timeValue: { flex: 1, fontSize: 21, fontWeight: "800", color: colors.primaryBlue, textAlign: "center" },
  bump: {
    minHeight: 44, justifyContent: "center",
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: radii.button,
    backgroundColor: colors.lightBlueBg,
  },
  bumpText: { fontSize: fontSizes.body, fontWeight: "700", color: colors.primaryBlue },
  wideBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    minHeight: minTouch, borderRadius: radii.button, backgroundColor: colors.primaryBlue,
  },
  wideText: { fontSize: 20, fontWeight: "800", color: colors.white },
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
  linkCard: {
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.lg, gap: spacing.xs,
  },
  linkTitle: { fontSize: fontSizes.emphasis, fontWeight: "800", color: colors.primaryNavy },
  linkBody: { fontSize: fontSizes.body, lineHeight: 27, color: colors.textSecondary, marginBottom: spacing.xs },
  disclaimer: { fontSize: 16, color: colors.textSecondary, textAlign: "center", lineHeight: 24 },
});

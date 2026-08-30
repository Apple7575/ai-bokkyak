import React, { useCallback, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Image, Alert } from "react-native";
import notifee from "@notifee/react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, User, Clock, Pencil, Volume2, ChevronRight, AlertTriangle } from "lucide-react-native";
import { Logo } from "../components/Logo";
import { MedicineMark } from "../components/MedicineMark";
import { supabase, Schedule, IntakeRecord } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { commitQuickCheckDraft } from "../lib/quickCheckDraft";
import { checkedCount } from "../lib/quickCheck";
import { nextNotificationTime, todaySlot } from "../lib/schedule";
import { hasExactAlarm } from "../lib/alarmPermissions";
import { MedKind } from "../lib/medKind";
import { getKindMap, resolveKind } from "../lib/medStore";
import { lookupIngredients, fetchContraindications } from "../lib/drugData";
import { allIngredients, matchFindings, MedIngredients } from "../lib/interactions";
import { colors, fontSizes, spacing, radii, shadows, tabBarClearance, minTouch } from "../theme/tokens";

const HOME_ART = require("../../assets/illustrations/home-medication.png");

// B-01 홈 — 확정 시안 기준.
// 위에서부터: 다음 복약 시간(복약 확인 진입 포함) → 오늘 복약 일정 → 내 약장 요약 → 주의.

function fmt(d: Date): string {
  const h = d.getHours(), m = d.getMinutes();
  const ap = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ap} ${h12}:${String(m).padStart(2, "0")}`;
}

// 화면에 쓰는 구분 라벨. 내부 값("건기식")보다 긴 이름을 쓴다.
const KIND_LABEL: Record<MedKind | "미분류", string> = {
  처방약: "처방약", 일반약: "일반약", 건기식: "건강기능식품", 미분류: "미분류",
};
const KIND_COLOR: Record<MedKind | "미분류", string> = {
  처방약: colors.primaryBlue,
  일반약: colors.secondaryBlue,
  건기식: colors.successGreen,
  미분류: colors.textSecondary,
};

type Row = { s: Schedule; at: Date; kind: MedKind | "미분류"; status: "완료" | "건너뜀" | "미룸" | "예정" };

export function HomeScreen() {
  const nav = useNavigation<any>();
  // 홈은 ScreenHeader가 없어 직접 상태바 높이를 피해야 한다.
  // (없으면 시각·통신사 표시와 인사말이 겹친다 — QA 2026-08-09)
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<Row[]>([]);
  const [next, setNext] = useState<{ s: Schedule; at: Date; kind: MedKind | "미분류" } | null>(null);
  const [counts, setCounts] = useState<Record<MedKind | "미분류", number>>({
    처방약: 0, 일반약: 0, 건기식: 0, 미분류: 0,
  });
  const [total, setTotal] = useState(0);
  const [alarmOk, setAlarmOk] = useState(true);
  const [warnCount, setWarnCount] = useState(0);

  // 가입 직후 점검 결과 저장에 실패해 기기에 남은 초안이 있으면 홈이 뜰 때마다 다시 시도한다.
  // 성공하면 결과 전체를 보여 준다. 실패하면 배너로 알리고 "다시 시도" 버튼을 준다 —
  // 자동 재시도 실패는 조용히 넘기되(진입마다 Alert가 뜨면 성가시다), 수동 시도는 Alert로.
  const [draftPending, setDraftPending] = useState(false);
  // 한 번에 하나만 — commit은 단순 insert라 동시에 두 번 돌면 결과 행이 중복된다.
  const draftInFlight = useRef(false);
  // 자동 시도가 도는 중에 버튼을 누르면 그 시도의 결과를 사용자에게 알려야 한다(버튼이 먹통처럼 보이지 않게).
  const alertOnFail = useRef(false);
  const retryDraft = useCallback(async (pid: string, manual = false) => {
    if (manual) alertOnFail.current = true;
    if (draftInFlight.current) return;
    draftInFlight.current = true;
    try {
      const committed = await commitQuickCheckDraft(pid);
      setDraftPending(false);
      if (committed?.findings) {
        nav.navigate("QuickCheckResult", { unlocked: true, findings: committed.findings, unmatched: committed.unmatched, checked: checkedCount(committed) });
      }
    } catch {
      setDraftPending(true);
      if (alertOnFail.current) Alert.alert("점검 결과를 저장하지 못했어요", "인터넷 연결을 확인하고 다시 눌러 주세요.");
    } finally {
      draftInFlight.current = false;
      alertOnFail.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    const pid = await getPatientId();
    if (!pid) return;
    void retryDraft(pid);
    const { data } = await supabase.from("schedules").select("*")
      .eq("patient_id", pid).eq("active", true).order("hour");
    const all = (data ?? []) as Schedule[];
    const kinds = await getKindMap();
    const now = new Date();

    // 내 약장 요약 — 같은 약이 여러 시간대로 등록돼 있어도 1종으로 센다.
    const byName = new Map<string, MedKind | "미분류">();
    for (const s of all) {
      if (byName.has(s.medicine_name)) continue;
      byName.set(s.medicine_name, resolveKind(s.medicine_name, kinds) ?? "미분류");
    }
    const c: Record<MedKind | "미분류", number> = { 처방약: 0, 일반약: 0, 건기식: 0, 미분류: 0 };
    for (const k of byName.values()) c[k]++;
    setCounts(c);
    setTotal(byName.size);

    // 오늘 요일에 해당하는 약만 (빈 repeat_days=매일, 설계 결정 #1)
    const due = all.filter((s) => {
      const d = s.repeat_days ?? [];
      return d.length === 0 || d.includes(now.getDay());
    });

    // 오늘 기록 — 완료/건너뜀/미룸 배지
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
    const { data: recs } = await supabase.from("intake_records").select("*")
      .eq("patient_id", pid)
      .gte("scheduled_for", dayStart.toISOString())
      .lt("scheduled_for", dayEnd.toISOString());
    const statusBy = new Map<string, IntakeRecord["status"]>();
    for (const r of (recs ?? []) as IntakeRecord[]) statusBy.set(r.schedule_id, r.status);

    const list: Row[] = due.map((s): Row => {
      const st = statusBy.get(s.id);
      const status: Row["status"] =
        st === "completed" ? "완료" : st === "skipped" ? "건너뜀" : st === "snoozed" ? "미룸" : "예정";
      return {
        s,
        at: todaySlot(s.hour, s.minute, now),
        kind: resolveKind(s.medicine_name, kinds) ?? "미분류",
        status,
      };
    }).sort((a, b) => a.at.getTime() - b.at.getTime());
    setRows(list);

    // 다음 복약 — 아직 응답하지 않은 것 중 가장 이른 것
    const pending = all.filter((s) => statusBy.get(s.id) !== "completed");
    const nx = pending
      .map((s) => ({ s, at: nextNotificationTime(s, now) }))
      .sort((a, b) => a.at.getTime() - b.at.getTime())[0];
    setNext(nx ? { ...nx, kind: resolveKind(nx.s.medicine_name, kinds) ?? "미분류" } : null);

    hasExactAlarm().then(setAlarmOk);

    // 주의 조합 — 참조 데이터가 없으면 조용히 0으로 두고 배너를 숨긴다.
    const names = [...byName.keys()];
    if (names.length < 2) { setWarnCount(0); return; }
    const ing = await lookupIngredients(names);
    if (!ing.ready) { setWarnCount(0); return; }
    const meds: MedIngredients[] = names.map((n) => ({ scheduleId: n, name: n, ingredients: ing.data[n] ?? [] }));
    const rules = await fetchContraindications(allIngredients(meds));
    if (!rules.ready) { setWarnCount(0); return; }
    setWarnCount(matchFindings(meds, rules.data).length);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    // 상단 인셋은 ScrollView 바깥에 준다. contentContainerStyle에 주면 스크롤할 때
    // 내용이 상태바(시계·배터리) 밑으로 올라와 겹친다.
    <View style={[styles.screen, { paddingTop: insets.top }]}>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.c, { paddingTop: spacing.md, paddingBottom: tabBarClearance + insets.bottom }]}
    >
      {/* 브랜드 헤더 */}
      <View style={styles.brandRow}>
        <Logo size={40} />
        <View style={{ flex: 1 }} />
        <View style={styles.iconBtn}><Bell size={22} color={colors.primaryBlue} /></View>
        <Pressable
          onPress={() => nav.navigate("More")}
          style={({ pressed }) => [styles.iconBtn, styles.iconBtnGap, pressed && { opacity: 0.85 }]}
          hitSlop={6}
        >
          <User size={22} color={colors.primaryBlue} />
        </Pressable>
      </View>

      <Text style={styles.greet}>안녕하세요!</Text>
      <Text style={styles.greetSub}>오늘도 건강한 하루 보내세요.</Text>

      {/* 정확알람 권한 경고 */}
      {!alarmOk ? (
        <Pressable style={styles.warnPerm} onPress={() => notifee.openAlarmPermissionSettings()}>
          <AlertTriangle size={20} color={colors.dangerRed} />
          <Text style={styles.warnPermText}>
            정확한 복약 알람을 위해 '알람 및 리마인더' 권한이 필요해요. 눌러서 설정 열기
          </Text>
        </Pressable>
      ) : null}

      {/* 가입 때 저장 못 한 1분 점검 결과 — 자동 재시도 실패 시에만 보인다 */}
      {draftPending ? (
        <View style={styles.warnCard}>
          <View style={styles.warnHead}>
            <AlertTriangle size={22} color={colors.warningOrange} />
            <Text style={styles.warnTitle}>점검 결과를 아직 저장하지 못했어요</Text>
          </View>
          <Pressable
            onPress={() => { void getPatientId().then((pid) => { if (pid) void retryDraft(pid, true); }); }}
            style={({ pressed }) => [styles.draftRetryBtn, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <Text style={styles.draftRetryText}>다시 저장하기</Text>
          </Pressable>
        </View>
      ) : null}

      {/* ① 다음 복약 시간 + ② 음성 AI 진입 */}
      <View style={styles.hero}>
        <Image source={HOME_ART} style={styles.heroArt} resizeMode="contain" />
        <View style={styles.heroTop}>
          <View style={styles.heroChip}>
            <Clock size={17} color={colors.white} />
            <Text style={styles.heroChipText}>다음 복약 시간</Text>
          </View>
          {next ? (
            <Pressable
              onPress={() => nav.navigate("ButtonRegister", { editId: next.s.id })}
              style={styles.heroEdit}
              hitSlop={10}
            >
              <Pencil size={20} color={colors.white} />
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.heroTime}>{next ? fmt(next.at) : "등록된 약이 없어요"}</Text>
        {next ? (
          <View style={styles.heroMedRow}>
            <Text style={styles.heroMed}>{next.s.medicine_name}</Text>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{KIND_LABEL[next.kind]}</Text>
            </View>
          </View>
        ) : null}

        {/* AI 건강전화(양방향 음성 통화)를 걷어내고 TTS+터치 확인으로 바꿨다
            (회의 결정 2026-08-20). 알람 시간 변경은 '내 약장'의 수정 버튼에서 한다. */}
        <Pressable
          onPress={() => nav.navigate("Checkup")}
          style={({ pressed }) => [styles.voiceBtn, pressed && { opacity: 0.9 }]}
        >
          <Volume2 size={22} color={colors.white} />
          <Text style={styles.voiceBtnText}>오늘 복약 확인하기</Text>
        </Pressable>
      </View>

      {/* 오늘 복약 일정 */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>오늘 복약 일정</Text>
          <Pressable onPress={() => nav.navigate("Cabinet")} style={styles.moreBtn} hitSlop={8}>
            <Text style={styles.moreText}>전체 보기</Text>
            <ChevronRight size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
        {rows.length === 0 ? (
          <Text style={styles.empty}>오늘 드실 약이 없어요.</Text>
        ) : (
          rows.map((r) => (
            <Pressable
              key={r.s.id}
              onPress={() => nav.navigate("MedicineDetail", { scheduleId: r.s.id })}
              style={({ pressed }) => [styles.doseRow, pressed && { opacity: 0.9 }]}
            >
              <MedicineMark name={r.s.medicine_name} size={44} />
              {/* 약 이름이 1순위 — 좁은 폰(360dp)에서도 눌리지 않게 시각·구분은 둘째 줄로 */}
              <View style={styles.doseMain}>
                <Text style={styles.doseName} numberOfLines={1}>{r.s.medicine_name}</Text>
                <View style={styles.doseMeta}>
                  <Text style={styles.doseTime}>{fmt(r.at)}</Text>
                  <View style={[styles.kindBadge, { backgroundColor: KIND_COLOR[r.kind] + "1A" }]}>
                    <Text style={[styles.kindBadgeText, { color: KIND_COLOR[r.kind] }]}>{KIND_LABEL[r.kind]}</Text>
                  </View>
                </View>
              </View>
              <View style={[styles.statusBadge, r.status === "완료" && styles.statusDone]}>
                <Text style={[styles.statusText, r.status === "완료" && styles.statusDoneText]}>{r.status}</Text>
              </View>
            </Pressable>
          ))
        )}
      </View>

      {/* 내 약장 요약 */}
      <Pressable
        onPress={() => nav.navigate("Cabinet")}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}
      >
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>내 약장</Text>
          <View style={styles.moreBtn}>
            <Text style={styles.moreText}>총 {total}종 관리 중</Text>
            <ChevronRight size={18} color={colors.textSecondary} />
          </View>
        </View>
        <View style={styles.tileRow}>
          {(["처방약", "일반약", "건기식"] as const).map((k) => (
            <View key={k} style={[styles.tile, { backgroundColor: KIND_COLOR[k] + "12" }]}>
              <Text style={[styles.tileLabel, { color: KIND_COLOR[k] }]}>{KIND_LABEL[k]}</Text>
              <Text style={styles.tileCount}>{counts[k]}</Text>
            </View>
          ))}
        </View>
      </Pressable>

      {/* ③ 주의 조합 */}
      {warnCount > 0 ? (
        <View style={styles.warnCard}>
          <View style={styles.warnHead}>
            <AlertTriangle size={22} color={colors.warningOrange} />
            <Text style={styles.warnTitle}>주의가 필요한 조합 {warnCount}건</Text>
          </View>
          <Text style={styles.warnDesc}>성분 중복 가능성 · 약사 확인 권장</Text>
          <Pressable
            onPress={() => nav.navigate("Interaction")}
            style={({ pressed }) => [styles.warnBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.warnBtnText}>약사에게 확인 요청</Text>
            <ChevronRight size={18} color={colors.white} />
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flex: 1 },
  c: { padding: spacing.md, gap: spacing.md },
  brandRow: { flexDirection: "row", alignItems: "center" },
  iconBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceRaised,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  iconBtnGap: { marginLeft: spacing.sm },
  greet: { fontSize: 32, fontWeight: "800", color: colors.primaryNavy, marginTop: -spacing.xs, letterSpacing: -0.8 },
  greetSub: { fontSize: 19, lineHeight: 28, color: colors.textSecondary, marginTop: -spacing.sm },
  warnPerm: {
    flexDirection: "row", gap: spacing.sm, alignItems: "center",
    backgroundColor: colors.dangerSoft, borderColor: colors.dangerRed, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md,
  },
  warnPermText: { flex: 1, fontSize: fontSizes.body, color: colors.dangerRed, fontWeight: "700" },

  hero: {
    backgroundColor: colors.primaryNavy, borderRadius: radii.hero, padding: spacing.lg,
    overflow: "hidden", ...shadows.floating,
  },
  heroArt: { position: "absolute", width: 190, height: 150, right: -22, top: 18, opacity: 0.48 },
  heroTop: { flexDirection: "row", alignItems: "center" },
  heroChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.14)", borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 2, paddingVertical: 5,
  },
  heroChipText: { color: colors.white, fontSize: 16, fontWeight: "700" },
  heroEdit: {
    marginLeft: "auto", width: 44, height: 44, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center",
  },
  heroTime: { color: colors.white, fontSize: fontSizes.hero, fontWeight: "800", marginTop: spacing.md, letterSpacing: -1 },
  heroMedRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 },
  heroMed: { color: colors.white, fontSize: 22, fontWeight: "700", flexShrink: 1 },
  heroBadge: { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 3 },
  heroBadgeText: { color: colors.white, fontSize: 15, fontWeight: "700" },
  voiceBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    // 옛 디자인 그대로: 파란 히어로 위 반투명 흰 버튼
    minHeight: 60, borderRadius: radii.button, marginTop: spacing.md,
    backgroundColor: "rgba(255,255,255,0.22)", borderWidth: 1, borderColor: "rgba(255,255,255,0.45)",
  },
  voiceBtnText: { color: colors.white, fontSize: 20, fontWeight: "800" },

  card: {
    backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md, ...shadows.card,
  },
  cardHead: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  cardTitle: { fontSize: 24, fontWeight: "800", color: colors.primaryNavy, flex: 1 },
  moreBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  moreText: { fontSize: fontSizes.body, color: colors.textSecondary, fontWeight: "600" },
  empty: { fontSize: 19, color: colors.textSecondary, paddingVertical: spacing.md },
  doseRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border,
  },
  doseMain: { flex: 1, minWidth: 0, gap: 4 },
  doseMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  doseTime: { fontSize: fontSizes.body, fontWeight: "700", color: colors.text },
  doseName: { fontSize: 20, fontWeight: "700", color: colors.text },
  kindBadge: { borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 3 },
  kindBadgeText: { fontSize: 14, fontWeight: "700" },
  statusBadge: {
    marginLeft: "auto", borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: colors.lightBlueBg,
  },
  statusDone: { backgroundColor: colors.primaryBlue },
  statusText: { fontSize: 15, fontWeight: "700", color: colors.textSecondary },
  statusDoneText: { color: colors.white },

  tileRow: { flexDirection: "row", gap: spacing.sm },
  tile: { flex: 1, borderRadius: radii.card, paddingVertical: spacing.md, paddingHorizontal: spacing.sm },
  tileLabel: { fontSize: 15, fontWeight: "700" },
  tileCount: { fontSize: 30, fontWeight: "800", color: colors.primaryNavy, marginTop: 2 },

  warnCard: {
    backgroundColor: colors.warningSoft, borderColor: colors.warningOrange, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md,
  },
  warnHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  draftRetryBtn: { marginTop: spacing.sm, minHeight: minTouch, borderRadius: radii.pill, backgroundColor: colors.primaryBlue, alignItems: "center", justifyContent: "center" },
  draftRetryText: { fontSize: fontSizes.emphasis, fontWeight: "800", color: colors.white },
  warnTitle: { fontSize: 21, fontWeight: "800", color: colors.text, flex: 1 },
  warnDesc: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.md },
  warnBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    minHeight: 56, borderRadius: radii.button, backgroundColor: colors.warningOrange,
  },
  warnBtnText: { color: colors.white, fontSize: 19, fontWeight: "800" },
});

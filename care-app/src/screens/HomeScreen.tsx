import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import notifee from "@notifee/react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Bell, Phone, ChevronRight, Clock, AlertTriangle } from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";
import { BigButton } from "../components/BigButton";
import { ScheduleCard } from "../components/ScheduleCard";
import { supabase, Schedule } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { nextNotificationTime } from "../lib/schedule";
import { hasExactAlarm } from "../lib/alarmPermissions";
import { colors, fontSizes, spacing, radii } from "../theme/tokens";

function fmt(d: Date): string {
  const h = d.getHours(); const m = d.getMinutes();
  const ap = h < 12 ? "오전" : "오후"; const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ap} ${h12}:${String(m).padStart(2, "0")}`;
}

export function HomeScreen() {
  const nav = useNavigation<any>();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [alarmOk, setAlarmOk] = useState(true);

  useFocusEffect(useCallback(() => {
    (async () => {
      const pid = await getPatientId(); if (!pid) return;
      const { data } = await supabase.from("schedules").select("*")
        .eq("patient_id", pid).eq("active", true).order("hour");
      setSchedules(data ?? []);
    })();
    hasExactAlarm().then(setAlarmOk);
  }, []));

  const now = new Date();
  const next = schedules.length
    ? schedules.map((s) => ({ s, t: nextNotificationTime(s, now) }))
        .sort((a, b) => a.t.getTime() - b.t.getTime())[0]
    : null;

  // "오늘 복약 일정"은 오늘 요일에 해당하는 약만(빈 repeat_days=매일, 설계 결정 #1).
  // 요일 반복이 생기면서 월요일 약이 금요일 목록에 뜨던 문제 방지.
  const dueToday = schedules.filter((s) => {
    const days = s.repeat_days ?? [];
    return days.length === 0 || days.includes(now.getDay());
  });

  // Visual donut driven only by today's due schedules (no extra query):
  // shows how full today's plan is, capped so the ring stays readable.
  const total = dueToday.length;
  const ringPct = total === 0 ? 0 : Math.min(100, Math.round((total / 4) * 100));
  const R = 36;
  const C = 2 * Math.PI * R;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.c}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.greet}>안녕하세요!</Text>
          <Text style={styles.greetSub}>오늘도 건강한 하루 보내세요.</Text>
        </View>
        <View style={styles.headerIcons}>
          {/* 보호자 아이콘(UserCheck)은 보호자 기능 제거(B-01)와 함께 뺐다. */}
          <View style={[styles.iconBtn, { backgroundColor: colors.lightBlueBg }]}>
            <Bell size={22} color={colors.primaryBlue} />
          </View>
        </View>
      </View>

      {/* 정확알람 권한 꺼짐 경고 배너 */}
      {!alarmOk ? (
        <Pressable style={styles.warn} onPress={() => notifee.openAlarmPermissionSettings()}>
          <AlertTriangle size={20} color={colors.dangerRed} />
          <Text style={styles.warnText}>
            정확한 복약 알람을 위해 '알람 및 리마인더' 권한이 필요해요. 이 권한이 꺼져 있으면 알람이 늦게 울릴 수 있습니다. 눌러서 설정 열기
          </Text>
        </Pressable>
      ) : null}

      {/* 음성 AI가 이 앱의 핵심이라, 홈 최상단에 가장 크게 둔다 (B-01 확정).
          기존에는 화면 중간의 일반 버튼 하나여서 눈에 띄지 않았다. */}
      <Pressable
        onPress={() => nav.navigate("Call")}
        style={({ pressed }) => [styles.callCard, pressed && { opacity: 0.92 }]}
      >
        <View style={styles.callIcon}>
          <Phone size={34} color="#fff" strokeWidth={2} />
        </View>
        <View style={styles.callTextWrap}>
          <Text style={styles.callTitle}>AI 건강전화</Text>
          <Text style={styles.callSub}>눌러서 통화하고 약을 확인하세요</Text>
        </View>
        <ChevronRight size={26} color="#fff" />
      </Pressable>

      {/* Next medicine hero card */}
      <View style={styles.hero}>
        <View style={styles.heroLabelRow}>
          <Clock size={16} color="#fff" />
          <Text style={styles.heroLabel}>다음 복약 시간</Text>
        </View>
        <Text style={styles.heroTime}>{next ? fmt(next.t) : "등록된 약이 없어요"}</Text>
        {next ? <Text style={styles.heroMed}>{next.s.medicine_name}</Text> : null}
        <Pressable style={styles.heroBtn} onPress={() => nav.navigate("MedicineList")}>
          <Text style={styles.heroBtnText}>복약 일정 보기</Text>
          <ChevronRight size={16} color="#fff" />
        </Pressable>
      </View>

      {/* AI 건강전화는 위 카드로 올렸으므로 여기서는 중복 제거 */}
      <BigButton label="약 등록 / 복약 관리" onPress={() => nav.navigate("MedicineList")} />

      {/* Today's schedule */}
      <Text style={styles.section}>오늘 복약 일정</Text>
      {dueToday.map((s) => (
        <ScheduleCard key={s.id} name={s.medicine_name} time={fmt(nextNotificationTime(s, now))} />
      ))}

      {/* Progress / status card */}
      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>오늘의 복약 현황</Text>
        <View style={styles.statusRow}>
          <Svg width={88} height={88} viewBox="0 0 88 88">
            <Circle cx={44} cy={44} r={R} fill="none" stroke={colors.lightBlueBg} strokeWidth={10} />
            <Circle
              cx={44}
              cy={44}
              r={R}
              fill="none"
              stroke={colors.primaryBlue}
              strokeWidth={10}
              strokeDasharray={C}
              strokeDashoffset={C * (1 - ringPct / 100)}
              strokeLinecap="round"
              transform="rotate(-90 44 44)"
            />
          </Svg>
          <View style={styles.statusTextWrap}>
            <Text style={styles.statusCount}>{total}개</Text>
            <Text style={styles.statusDesc}>오늘 등록된 복약 일정</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7FAFF" },
  c: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.lg,
  },
  headerText: { flexShrink: 1 },
  // 고령층 대상 — 홈 글자를 전반적으로 키웠다 (B-01 "텍스트 더 키워야 함").
  greet: { fontSize: 30, fontWeight: "800", color: colors.primaryNavy },
  greetSub: { fontSize: 20, color: colors.textSecondary, marginTop: spacing.xs },
  headerIcons: { flexDirection: "row", gap: spacing.sm },
  iconBtn: { width: 48, height: 48, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  callCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.primaryBlue,
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.md,
    minHeight: 108, // BigButton(56)의 약 2배 — 홈에서 가장 큰 요소
    shadowColor: colors.primaryBlue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 6,
  },
  callIcon: {
    width: 64, height: 64, borderRadius: 999,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  callTextWrap: { flex: 1 },
  callTitle: { fontSize: 30, fontWeight: "800", color: "#fff" },
  callSub: { fontSize: 19, color: "rgba(255,255,255,0.9)", marginTop: 4 },
  hero: {
    backgroundColor: colors.primaryBlue,
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: colors.primaryBlue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  heroLabelRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  heroLabel: { color: "#cfe0ff", fontSize: 20 },
  heroTime: { color: "#fff", fontSize: fontSizes.hero, fontWeight: "800", marginVertical: spacing.xs },
  heroMed: { color: "#fff", fontSize: 26, fontWeight: "700" },
  heroBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: radii.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  heroBtnText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  section: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  warn: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    backgroundColor: "#FFF0F0",
    borderColor: colors.dangerRed,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  warnText: { flex: 1, fontSize: fontSizes.body, color: colors.dangerRed, fontWeight: "700" },
  statusCard: {
    backgroundColor: colors.cardBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  statusTitle: { fontSize: 26, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  statusTextWrap: { flexShrink: 1 },
  statusCount: { fontSize: 36, fontWeight: "800", color: colors.primaryNavy },
  statusDesc: { fontSize: 20, color: colors.textSecondary, marginTop: spacing.xs },
});

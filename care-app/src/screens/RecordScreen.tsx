import React, { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Calendar, LocaleConfig } from "react-native-calendars";
import { ScreenHeader } from "../components/ScreenHeader";
import { StatusBadge } from "../components/StatusBadge";
import { supabase, IntakeRecord, Schedule } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { dayMark, markColor, monthlyAdherence } from "../lib/adherence";
import { statusLabel, IntakeStatus } from "../lib/intakeStatus";
import { colors, fontSizes, radii, spacing } from "../theme/tokens";

LocaleConfig.locales["ko"] = {
  monthNames: ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"],
  monthNamesShort: ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"],
  dayNames: ["일요일","월요일","화요일","수요일","목요일","금요일","토요일"],
  dayNamesShort: ["일","월","화","수","목","금","토"],
  today: "오늘",
};
LocaleConfig.defaultLocale = "ko";

// 로컬(기기) 기준 YYYY-MM-DD. toISOString은 UTC라 날짜가 밀릴 수 있어 직접 포맷.
function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 특정 날짜(요일)에 해당 스케줄이 예정되어 있는지.
// 일정 생성일 이전 날짜는 슬롯 아님(월 중간 등록 시 앞쪽 날짜 미응답으로 안 깎임).
// repeat_days 빈 배열 = 매일, 아니면 getDay()(0=일~6=토) 포함 여부.
function scheduledOn(s: Schedule, date: Date): boolean {
  const created = new Date(s.created_at); created.setHours(0, 0, 0, 0);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (d.getTime() < created.getTime()) return false;
  if (!s.repeat_days || s.repeat_days.length === 0) return true;
  return s.repeat_days.includes(date.getDay());
}

type DayDetail = { medicine_name: string; status: IntakeStatus | "missed" };

export function RecordScreen() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [records, setRecords] = useState<IntakeRecord[]>([]);
  const [selected, setSelected] = useState<string>(() => localKey(new Date()));
  // 달력에서 보고 있는 달(매월 1일). 이전/다음 달로 이동하면 이 값 기준으로 조회·집계한다.
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const pid = await getPatientId();
        if (!pid) return;
        const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1, 0, 0, 0, 0);
        const monthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1, 0, 0, 0, 0);
        // active 필터 제거: 중단된 약도 과거 기록 이름 해석/집계·달력 마킹에 필요.
        // (active는 미래 알림 예약용 개념이고 과거 기록/달력에는 전체 일정 사용)
        const { data: schs } = await supabase
          .from("schedules")
          .select("*")
          .eq("patient_id", pid);
        const { data: recs } = await supabase
          .from("intake_records")
          .select("*")
          .eq("patient_id", pid)
          .gte("scheduled_for", monthStart.toISOString())
          .lt("scheduled_for", monthEnd.toISOString());
        setSchedules((schs ?? []) as Schedule[]);
        setRecords((recs ?? []) as IntakeRecord[]);
      })();
    }, [visibleMonth])
  );

  // 이번 달 날짜별 집계 → 달력 마킹 + 월 이행률.
  const { markedDates, monthPct } = useMemo(() => {
    // 보이는 달의 연/월·일수 기준으로 집계. isPast/isToday 판정은 실제 오늘 기준 유지.
    const now = new Date();
    const todayKey = localKey(now);
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 날짜별 완료 수 집계 (로컬 키 기준)
    const completedByDay = new Map<string, number>();
    for (const r of records) {
      if (r.status !== "completed") continue;
      const key = localKey(new Date(r.scheduled_for));
      completedByDay.set(key, (completedByDay.get(key) ?? 0) + 1);
    }

    const marked: Record<string, { selected: boolean; selectedColor?: string }> = {};
    let totalScheduled = 0;
    let totalCompleted = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day, 0, 0, 0, 0);
      const key = localKey(date);
      const isPast = date.getTime() < todayMidnight.getTime();
      const isToday = key === todayKey;
      const slots = schedules.reduce((n, s) => n + (scheduledOn(s, date) ? 1 : 0), 0);
      const completed = completedByDay.get(key) ?? 0;

      // 이행률: 과거 + 오늘의 예정 슬롯/완료만 합산 (미래 제외)
      if (isPast || isToday) {
        totalScheduled += slots;
        totalCompleted += completed;
      }

      const color = markColor(dayMark(slots, completed, isPast));
      if (color) {
        marked[key] = { selected: true, selectedColor: color };
      }
    }

    // 선택된 날짜는 항상 표시 (색이 없으면 중립 파랑). 미선택(빈 값)이면 강조 없음.
    if (selected) {
      if (marked[selected]) {
        marked[selected] = { ...marked[selected], selected: true };
      } else {
        marked[selected] = { selected: true, selectedColor: colors.secondaryBlue };
      }
    }

    return { markedDates: marked, monthPct: monthlyAdherence(totalScheduled, totalCompleted) };
  }, [schedules, records, selected, visibleMonth]);

  // 선택 날짜 상세: 약 이름 + 상태. 완료/스누즈/건너뛰기 기록 + 과거 미응답 슬롯(missed).
  const dayDetails = useMemo<DayDetail[]>(() => {
    if (!selected) return [];
    const [y, m, d] = selected.split("-").map(Number);
    const date = new Date(y, m - 1, d, 0, 0, 0, 0);
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const isPast = date.getTime() < todayMidnight.getTime();

    const schMap = new Map(schedules.map((s) => [s.id, s.medicine_name]));
    const dayRecords = records.filter((r) => localKey(new Date(r.scheduled_for)) === selected);

    const details: DayDetail[] = dayRecords.map((r) => ({
      medicine_name: schMap.get(r.schedule_id) ?? "약",
      status: r.status,
    }));

    // 과거 날짜: 예정 슬롯 수보다 기록이 적으면 나머지는 "미확인(missed)"로 표시
    if (isPast) {
      const scheduledMeds = schedules.filter((s) => scheduledOn(s, date));
      const recordedScheduleIds = new Set(dayRecords.map((r) => r.schedule_id));
      for (const s of scheduledMeds) {
        if (!recordedScheduleIds.has(s.id)) {
          details.push({ medicine_name: s.medicine_name, status: "missed" });
        }
      }
    }
    return details;
  }, [schedules, records, selected]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="복약 기록" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.adherenceCard}>
          <Text style={styles.adherenceLabel}>이번 달 복약 이행률</Text>
          <Text style={styles.adherencePct}>{monthPct}%</Text>
        </View>

        <View style={styles.calendarWrap}>
          <Calendar
            current={localKey(visibleMonth)}
            markedDates={markedDates}
            onDayPress={(d: { dateString: string }) => setSelected(d.dateString)}
            onMonthChange={(m: { year: number; month: number }) => {
              setVisibleMonth(new Date(m.year, m.month - 1, 1));
              setSelected("");
            }}
            theme={{
              arrowColor: colors.primaryBlue,
              textDayFontSize: fontSizes.body, // 18
              textMonthFontSize: fontSizes.emphasis, // 22
              textDayHeaderFontSize: 16,
              textSectionTitleColor: colors.textSecondary,
              monthTextColor: colors.primaryNavy,
              todayTextColor: colors.primaryBlue,
            }}
          />
        </View>

        <View style={styles.legend}>
          <LegendDot color={colors.successGreen} label="완료" />
          <LegendDot color={colors.warningOrange} label="1회 누락" />
          <LegendDot color={colors.dangerRed} label="2회+ 누락" />
          <LegendDot color={colors.border} label="일정 없음" />
        </View>

        {!selected ? (
          <Text style={styles.empty}>날짜를 선택하세요.</Text>
        ) : (
          <>
            <Text style={styles.sectionTitle}>{formatSelected(selected)} 기록</Text>
            {dayDetails.length === 0 ? (
              <Text style={styles.empty}>이 날의 기록이 없어요.</Text>
            ) : (
              dayDetails.map((item, i) => (
                <View key={`${item.medicine_name}-${i}`} style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.name}>{item.medicine_name}</Text>
                    <Text style={styles.meta}>{statusLabel(item.status)}</Text>
                  </View>
                  {item.status === "missed" ? null : <StatusBadge status={item.status} />}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function formatSelected(key: string): string {
  const [, m, d] = key.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7FAFF" },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  adherenceCard: {
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md, alignItems: "center",
  },
  adherenceLabel: { fontSize: fontSizes.body, color: colors.textSecondary },
  adherencePct: { fontSize: fontSizes.hero, fontWeight: "800", color: colors.successGreen, marginTop: 4 },
  calendarWrap: {
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.xs, overflow: "hidden",
  },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  legendDot: { width: 14, height: 14, borderRadius: 7 },
  legendText: { fontSize: 14, color: colors.textSecondary },
  sectionTitle: { fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.text, marginTop: spacing.sm },
  empty: { fontSize: fontSizes.body, color: colors.textSecondary, textAlign: "center", marginTop: spacing.md },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md,
  },
  rowLeft: { flexShrink: 1, gap: 4 },
  name: { fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.text },
  meta: { fontSize: fontSizes.body, color: colors.textSecondary },
});

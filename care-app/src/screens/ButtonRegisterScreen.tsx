import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet, Alert } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pill } from "lucide-react-native";
import { BigButton } from "../components/BigButton";
import { ScreenHeader } from "../components/ScreenHeader";
import { TimeChip } from "../components/TimeChip";
import { WheelPicker } from "../components/WheelPicker";
import { supabase } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { ensurePermission, scheduleReminders, cancelSchedule } from "../lib/notifications";
import { ensureStrongAlarmReady } from "../lib/alarmPermissions";
import { normalizeRepeatDays } from "../lib/schedule";
import {
  TimeOfDay, TIME_OF_DAYS, isTimeOfDay, timeOfDayForHour, hourForTimeOfDay,
} from "../lib/timeOfDay";
import { colors, fontSizes, spacing, radii } from "../theme/tokens";

const HOUR_VALUES = Array.from({ length: 24 }, (_, i) => i);   // 0~23시 전부 스크롤로 선택
const MINUTE_VALUES = Array.from({ length: 60 }, (_, i) => i); // 0~59분 전부 스크롤로 선택
const DAYS = ["일", "월", "화", "수", "목", "금", "토"]; // index 0=일 … 6=토

export function ButtonRegisterScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const editId: string | undefined = useRoute<any>().params?.editId;
  const [name, setName] = useState("");
  const [tod, setTod] = useState<TimeOfDay>("아침");
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  // 빈 배열 = 매일(설계 결정 #1). 요일 칩을 토글하면 해당 요일만 반복.
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false); // 더블탭 동기 가드(state는 비동기)

  // 수정 모드: 기존 일정을 불러와 폼을 채운다.
  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { data } = await supabase.from("schedules").select("*").eq("id", editId).single();
      if (data) {
        setName(data.medicine_name);
        setHour(data.hour); setMinute(data.minute); setRepeatDays(data.repeat_days ?? []);
        // 기존에 저장된 시간대가 시각과 어긋나 있으면(구버전 데이터) 시각 기준으로 바로잡는다.
        const saved = data.time_of_day;
        setTod(isTimeOfDay(saved) && saved === timeOfDayForHour(data.hour) ? saved : timeOfDayForHour(data.hour));
      }
    })();
  }, [editId]);

  // 시간대 칩 → 그 시간대에 맞는 시각으로. 이미 그 시간대 안이면 시각을 건드리지 않는다.
  function pickTod(t: TimeOfDay) {
    setTod(t);
    setHour((h) => hourForTimeOfDay(t, h));
  }
  // 시각을 바꾸면 시간대가 따라온다. 8시를 고르면 "점심"이 남아 있을 수 없다.
  function pickHour(h: number) {
    setHour(h);
    setTod(timeOfDayForHour(h));
  }

  function toggleDay(d: number) {
    setRepeatDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  }

  async function save() {
    if (savingRef.current) return;
    if (!name.trim()) { Alert.alert("약 이름을 입력해 주세요"); return; }
    // 새 등록은 여기서 저장하지 않는다. 이름만 받고 복용시점 등록(C-09)으로 넘긴다 —
    // 모든 등록 경로(이름 검색·사진·직접 입력)가 같은 관문을 지나게 해야
    // 복수 시간대·복용량 같은 항목이 경로마다 달라지지 않는다.
    if (!editId) {
      nav.navigate("DoseTime", { medicineName: name.trim() });
      return;
    }
    savingRef.current = true; // 첫 await 전에 동기 잠금
    setSaving(true);
    const pid = await getPatientId();
    if (!pid) { savingRef.current = false; setSaving(false); return; }
    const days = normalizeRepeatDays(repeatDays); // 정렬·중복제거된 int[], 빈배열=매일
    const row = { medicine_name: name.trim(), time_of_day: tod, hour, minute, repeat_days: days, active: true };
    await ensureStrongAlarmReady();
    try {
      if (editId) {
        // 이력 보존: 시간/요일을 바꾸면 과거 기록의 due-slot 기준이 깨지므로, 기존 행을 직접 고치지 않고
        // "새 활성 일정 등록 + 기존 비활성화"로 처리(과거 intake_records는 기존 행 기준으로 그대로 남김).
        const { data, error } = await supabase.from("schedules").insert({ patient_id: pid, ...row }).select().single();
        if (error || !data) throw error ?? new Error("insert 실패");
        // 알림 예약은 베스트에포트 — 실패해도 일정은 이미 저장됐으므로 재시도(중복 insert)하지 않는다.
        try { if (await ensurePermission()) await scheduleReminders(data.id, data.medicine_name, hour, minute, days, data.time_of_day); } catch {}
        await cancelSchedule(editId); // 기존 일정 알림 취소
        const { error: deactErr } = await supabase.from("schedules").update({ active: false }).eq("id", editId);
        if (deactErr) {
          // 새 일정은 등록됐지만 기존 행 비활성화 실패 → 둘 다 활성으로 남을 수 있음. 정직하게 안내.
          Alert.alert("수정은 저장됐어요", "이전 일정 정리에 실패했어요. '내 약장'에서 이전 항목을 삭제해 주세요.");
        } else {
          Alert.alert("복약 일정을 수정했습니다.");
        }
      } else {
        const { data, error } = await supabase.from("schedules").insert({ patient_id: pid, ...row }).select().single();
        if (error || !data) throw error ?? new Error("insert 실패");
        // 알림 예약은 베스트에포트 — 실패해도 일정은 이미 저장됐으므로 재시도(중복 insert)하지 않는다.
        try { if (await ensurePermission()) await scheduleReminders(data.id, data.medicine_name, hour, minute, days, data.time_of_day); } catch {}
        Alert.alert("복약 일정을 등록했습니다.");
      }
      // 저장하면 '내 약장' 탭으로 (C-04 확정 "저장하면 바로 약장 등록").
      // reset으로 스택을 비운다 — navigate만 하면 하단 탭이 사라지고 뒤로가기가
      // 방금 저장한 등록 화면으로 되돌아간다 (QA 2026-08-09).
      nav.reset({ index: 0, routes: [{ name: "Tabs", params: { screen: "Cabinet" } }] });
    } catch (e: any) {
      Alert.alert("저장 실패", e?.message ?? "다시 시도해 주세요.");
      savingRef.current = false; setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title={editId ? "복약 수정" : "약 이름 입력"} />
      <ScrollView contentContainerStyle={styles.c}>
        {/* 약 이름 */}
        <View style={styles.section}>
          <Text style={styles.label}>약 이름</Text>
          <View style={styles.inputWrap}>
            <View style={styles.inputIcon}>
              <Pill size={20} color={colors.primaryBlue} />
            </View>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="예: 고혈압약"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>

        {/* 새로 등록할 때는 이름만 받고 복용시점은 공통 관문(C-09)에서 정한다.
            수정할 때만 이 화면에서 시간까지 고친다 — 기존 일정의 시각·요일을
            바꾸는 화면이 따로 필요하기 때문. */}
        {editId ? (
        <>
        {/* 언제 드시나요? — 시간대와 시각은 항상 서로 맞춘다.
            따로 고르게 두면 「점심 · 08:00」 같은 일정이 만들어져, 아침 8시에
            "점심 약 복용 시간입니다"가 울린다 (QA 2026-08-09). */}
        <View style={styles.section}>
          <Text style={styles.label}>언제 드시나요?</Text>
          <View style={styles.row}>{TIME_OF_DAYS.map((t) => (
            <TimeChip key={t} label={t} selected={tod === t} onPress={() => pickTod(t)} />
          ))}</View>
        </View>

        {/* 세부 시간 — 시/분을 스크롤로 선택(아무 시각이나 가능) */}
        <View style={styles.section}>
          <Text style={styles.label}>몇 시 몇 분</Text>
          <View style={styles.wheelRow}>
            <WheelPicker values={HOUR_VALUES} value={hour} onChange={pickHour} suffix="시" />
            <WheelPicker values={MINUTE_VALUES} value={minute} onChange={setMinute} suffix="분" />
          </View>
          <Text style={styles.hint}>{`${tod} 시간대로 ${hour}시 ${minute}분에 알려드려요.`}</Text>
        </View>

        {/* 반복 요일 — 선택 안 하면 매일 */}
        <View style={styles.section}>
          <Text style={styles.label}>반복 요일</Text>
          <Text style={styles.hint}>요일을 고르지 않으면 매일 알려드려요.</Text>
          <View style={styles.row}>
            <TimeChip label="매일" selected={repeatDays.length === 0} onPress={() => setRepeatDays([])} />
            {DAYS.map((d, i) => (
              <TimeChip key={d} label={d} selected={repeatDays.includes(i)} onPress={() => toggleDay(i)} />
            ))}
          </View>
        </View>
        </>
        ) : (
          <Text style={styles.hint}>
            약 이름을 적고 다음으로 넘어가면, 언제 드시는지와 복용량을 정할 수 있어요.
          </Text>
        )}
      </ScrollView>

      {/* 하단 저장 버튼 — 시스템 네비게이션 바와 겹치지 않게 하단 여백 확보 */}
      <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>
        <BigButton label={saving ? "저장 중…" : editId ? "수정 저장하기" : "다음"} onPress={save} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cardBg },
  c: { padding: spacing.lg, paddingBottom: spacing.xl },
  section: { marginBottom: spacing.lg },
  label: { fontSize: fontSizes.body, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  hint: { fontSize: fontSizes.body, color: colors.textSecondary, marginBottom: spacing.sm, marginTop: -4 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.lightBlueBg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.button,
    paddingHorizontal: 14,
  },
  inputIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  input: { flex: 1, fontSize: fontSizes.body, color: colors.text, paddingVertical: 16 },
  row: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 },
  wheelRow: { flexDirection: "row", justifyContent: "center", gap: spacing.lg, paddingVertical: spacing.sm },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    backgroundColor: colors.cardBg,
  },
});

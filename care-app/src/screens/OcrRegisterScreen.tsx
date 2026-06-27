import React, { useRef, useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet, Alert, ActivityIndicator, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { Trash2 } from "lucide-react-native";
import { BigButton } from "../components/BigButton";
import { ScreenHeader } from "../components/ScreenHeader";
import { TimeChip } from "../components/TimeChip";
import { gptOcrPrescription } from "../lib/ocr";
import { ParsedSchedule } from "../lib/parse";
import { normalizeRepeatDays } from "../lib/schedule";
import { supabase } from "../lib/supabase";
import { getPatientId } from "../lib/storage";
import { ensurePermission, scheduleReminders } from "../lib/notifications";
import { speak } from "../lib/tts";
import { colors, fontSizes, spacing, radii } from "../theme/tokens";

const TODS = ["아침", "점심", "저녁", "취침"];
const HOURS = [7, 8, 9, 12, 13, 18, 19, 20, 21];
const MINUTES = [0, 15, 30, 45];
const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function OcrRegisterScreen() {
  const nav = useNavigation<any>();
  const [items, setItems] = useState<ParsedSchedule[]>([]);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false); // 더블탭 동기 가드(state는 비동기라 레이스 가능)

  function patch(i: number, p: Partial<ParsedSchedule>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  }
  function remove(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }
  function toggleDay(i: number, d: number) {
    setItems((prev) => prev.map((it, idx) => {
      if (idx !== i) return it;
      const has = it.repeat_days.includes(d);
      return { ...it, repeat_days: has ? it.repeat_days.filter((x) => x !== d) : [...it.repeat_days, d] };
    }));
  }

  async function capture(source: "camera" | "library") {
    try {
      const perm = source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("권한이 필요해요", source === "camera" ? "카메라 권한을 허용해 주세요." : "사진 보관함 권한을 허용해 주세요.");
        return;
      }
      const opts: ImagePicker.ImagePickerOptions = {
        base64: true, quality: 0.5, mediaTypes: ImagePicker.MediaTypeOptions.Images,
      };
      const res = source === "camera"
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.[0]?.base64) return;
      setItems([]); // 새 사진 인식 시작 — 이전 결과가 새 사진 것처럼 등록되지 않게 비운다.
      setLoading(true);
      setScanned(true);
      const meds = await gptOcrPrescription(res.assets[0].base64);
      setItems(meds);
      if (meds.length === 0) {
        Alert.alert("약을 찾지 못했어요", "글자가 잘 보이게 다시 촬영하거나, 버튼으로 직접 등록해 주세요.");
      }
    } catch {
      setItems([]); // 인식 실패 시에도 이전 결과를 남기지 않는다.
      Alert.alert("인식에 실패했어요", "인터넷 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  async function registerAll() {
    if (items.length === 0 || savingRef.current) return;
    savingRef.current = true; // 첫 await 전에 동기적으로 잠가 더블탭 중복 등록 방지
    setSaving(true);
    const pid = await getPatientId();
    if (!pid) { savingRef.current = false; setSaving(false); return; }
    // schedules엔 (intake_records와 달리) 중복 방지 제약이 없다. 중간 실패 시 이미 저장된
    // 항목이 재시도로 중복 등록되지 않게, 성공한 것만 목록에서 빼고 남은 것만 다시 시도한다.
    const remaining = [...items];
    try {
      const granted = await ensurePermission();
      while (remaining.length > 0) {
        const it = remaining[0];
        if (!it.medicine_name.trim()) { remaining.shift(); continue; }
        const days = normalizeRepeatDays(it.repeat_days);
        const { data, error } = await supabase.from("schedules").insert({
          patient_id: pid, medicine_name: it.medicine_name.trim(), time_of_day: it.time_of_day,
          hour: it.hour, minute: it.minute, repeat_days: days, active: true,
        }).select().single();
        if (error || !data) throw error ?? new Error("insert 실패");
        remaining.shift(); // DB 저장 성공 → 즉시 목록에서 제거(알림 예약 실패와 무관하게 중복 방지).
        // 알림 예약은 베스트에포트 — 실패해도 일정은 이미 저장됐으므로 재등록(중복)하지 않는다.
        if (granted) { try { await scheduleReminders(data.id, data.medicine_name, it.hour, it.minute, days, it.time_of_day); } catch {} }
      }
      await speak("복약 일정을 등록했습니다.");
      nav.navigate("Tabs");
    } catch {
      setItems(remaining); // 아직 저장 안 된 항목만 남겨 재시도 중복 방지
      Alert.alert("일부만 저장됐어요", "남은 약만 다시 등록해 주세요. 인터넷 연결을 확인해 주세요.");
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="사진으로 약 등록" />
      <ScrollView contentContainerStyle={styles.c}>
        <Text style={styles.guide}>약봉투나 약 포장을 촬영하면 자동으로 읽어드려요.</Text>

        <BigButton label="약봉투 촬영하기" onPress={() => capture("camera")} />
        <BigButton label="사진 보관함에서 고르기" variant="secondary" onPress={() => capture("library")} />

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primaryBlue} />
            <Text style={styles.loadingText}>사진에서 약 정보를 읽고 있어요…</Text>
          </View>
        ) : null}

        {!loading && scanned && items.length > 0 ? (
          <>
            <Text style={styles.section}>인식된 약 ({items.length}개) — 확인 후 등록하세요</Text>
            {items.map((it, i) => (
              <View key={i} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardLabel}>약 이름</Text>
                  <Pressable style={styles.removeBtn} onPress={() => remove(i)} hitSlop={8}>
                    <Trash2 size={16} color={colors.dangerRed} />
                    <Text style={styles.remove}>삭제</Text>
                  </Pressable>
                </View>
                <TextInput
                  style={styles.input}
                  value={it.medicine_name}
                  onChangeText={(t) => patch(i, { medicine_name: t })}
                  placeholder="약 이름"
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={styles.cardLabel}>시간대</Text>
                <View style={styles.row}>{TODS.map((t) => (
                  <TimeChip key={t} label={t} selected={it.time_of_day === t} onPress={() => patch(i, { time_of_day: t })} />
                ))}</View>

                <Text style={styles.cardLabel}>몇 시</Text>
                <View style={styles.row}>{HOURS.map((h) => (
                  <TimeChip key={h} label={`${h}시`} selected={it.hour === h} onPress={() => patch(i, { hour: h })} />
                ))}</View>

                <Text style={styles.cardLabel}>몇 분</Text>
                <View style={styles.row}>{MINUTES.map((m) => (
                  <TimeChip key={m} label={`${m}분`} selected={it.minute === m} onPress={() => patch(i, { minute: m })} />
                ))}</View>

                <Text style={styles.cardLabel}>반복 요일 (없으면 매일)</Text>
                <View style={styles.row}>
                  <TimeChip label="매일" selected={it.repeat_days.length === 0} onPress={() => patch(i, { repeat_days: [] })} />
                  {DAYS.map((d, di) => (
                    <TimeChip key={d} label={d} selected={it.repeat_days.includes(di)} onPress={() => toggleDay(i, di)} />
                  ))}
                </View>
              </View>
            ))}

            <BigButton label={saving ? "등록 중…" : `${items.length}개 모두 등록하기`} onPress={registerAll} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cardBg },
  c: { padding: spacing.lg, paddingBottom: spacing.xl },
  guide: { fontSize: fontSizes.body, fontWeight: "600", color: colors.text, marginBottom: spacing.md },
  loading: { alignItems: "center", paddingVertical: spacing.xl },
  loadingText: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: spacing.md },
  section: { fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md, marginBottom: spacing.md,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardLabel: { fontSize: fontSizes.body, fontWeight: "700", color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  removeBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  remove: { fontSize: fontSizes.body, color: colors.dangerRed, fontWeight: "700" },
  input: {
    backgroundColor: colors.lightBlueBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.button, fontSize: fontSizes.body, color: colors.text, padding: 14,
  },
  row: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 },
});

import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from "react-native";
import { Volume2, VolumeX, Play, Check } from "lucide-react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { getAlarmSoundSettings, setAlarmSoundSettings } from "../lib/alarmSettings";
import { playPreview, stopPreview } from "../lib/alarmRinger";
import { resyncAllAlarms } from "../lib/alarmSync";
import { colors, fontSizes, radii, spacing, minTouch } from "../theme/tokens";

const SLOTS: { tod: string; desc: string }[] = [
  { tod: "아침", desc: "아침 약 드실 시간 안내" },
  { tod: "점심", desc: "점심 약 드실 시간 안내" },
  { tod: "저녁", desc: "저녁 약 드실 시간 안내" },
  { tod: "취침", desc: "주무시기 전 약 안내" },
];

export function AlarmSoundScreen() {
  const [silent, setSilent] = useState<boolean | null>(null); // null = 불러오는 중
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    getAlarmSoundSettings().then((s) => { if (alive) setSilent(s.silent); });
    // 화면을 떠나면 미리 듣기 재생을 반드시 멈춘다.
    return () => { alive = false; void stopPreview(); };
  }, []);

  async function choose(nextSilent: boolean): Promise<void> {
    if (saving || silent === nextSilent) return;
    setSaving(true);
    const prev = silent;
    setSilent(nextSilent); // 낙관적 반영 — 실패 시 되돌린다
    try {
      await stopPreview();
      await setAlarmSoundSettings({ silent: nextSilent });
      // 이미 예약된 알람은 예전 채널을 물고 있으므로 전부 다시 예약해야 설정이 반영된다.
      await resyncAllAlarms();
    } catch {
      setSilent(prev);
      Alert.alert("설정을 저장하지 못했어요", "잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  if (silent === null) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="알림 소리 설정" />
        <Text style={styles.loading}>불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="알림 소리 설정" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>알람 소리</Text>

        <Pressable
          onPress={() => { void choose(false); }}
          style={({ pressed }) => [styles.optionCard, !silent && styles.optionOn, pressed && { opacity: 0.9 }]}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.primaryBlue + "1A" }]}>
            <Volume2 size={24} color={colors.primaryBlue} />
          </View>
          <View style={styles.optionTextWrap}>
            <Text style={styles.optionLabel}>켜짐</Text>
            <Text style={styles.optionSub}>알람 시간에 안내 음성이 나와요.</Text>
          </View>
          {!silent ? <Check size={24} color={colors.primaryBlue} /> : null}
        </Pressable>

        <Pressable
          onPress={() => { void choose(true); }}
          style={({ pressed }) => [styles.optionCard, silent && styles.optionOn, pressed && { opacity: 0.9 }]}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.textSecondary + "1A" }]}>
            <VolumeX size={24} color={colors.textSecondary} />
          </View>
          <View style={styles.optionTextWrap}>
            <Text style={styles.optionLabel}>꺼짐</Text>
            <Text style={styles.optionSub}>알람 시간에 진동만 울려요.</Text>
          </View>
          {silent ? <Check size={24} color={colors.primaryBlue} /> : null}
        </Pressable>

        <Text style={styles.note}>
          소리를 꺼도 알람 화면은 그대로 떠요. 진동으로 알려드립니다.
        </Text>

        <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>안내 음성 미리 듣기</Text>
        <View style={styles.group}>
          {SLOTS.map(({ tod, desc }, i) => (
            <View key={tod} style={[styles.rowItem, i < SLOTS.length - 1 && styles.rowDivider]}>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowLabel}>{tod} 알람</Text>
                <Text style={styles.rowSub}>{desc}</Text>
              </View>
              <Pressable
                onPress={() => { void playPreview(tod); }}
                style={({ pressed }) => [styles.playBtn, pressed && { opacity: 0.9 }]}
                hitSlop={8}
              >
                <Play size={18} color="#fff" />
                <Text style={styles.playBtnText}>미리 듣기</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7FAFF" },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  loading: { textAlign: "center", fontSize: fontSizes.body, color: colors.textSecondary, marginTop: spacing.lg },
  sectionTitle: {
    fontSize: fontSizes.emphasis, fontWeight: "800", color: colors.primaryNavy,
    marginBottom: spacing.sm, marginLeft: spacing.xs,
  },
  optionCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    minHeight: minTouch, padding: spacing.md, marginBottom: spacing.sm,
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card,
  },
  optionOn: { borderColor: colors.primaryBlue, borderWidth: 2 },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  optionTextWrap: { flex: 1 },
  optionLabel: { fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.text },
  optionSub: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: 2 },
  note: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: spacing.xs, marginLeft: spacing.xs },
  group: {
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, overflow: "hidden",
  },
  rowItem: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: 14,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowTextWrap: { flex: 1 },
  rowLabel: { fontSize: fontSizes.body, fontWeight: "700", color: colors.text },
  rowSub: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: 2 },
  playBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    minHeight: 48, paddingHorizontal: 16, borderRadius: radii.button,
    backgroundColor: colors.primaryBlue,
  },
  playBtnText: { fontSize: fontSizes.body, fontWeight: "700", color: "#fff" },
});

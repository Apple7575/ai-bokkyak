import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, Platform } from "react-native";
import { Volume2, VolumeX, Play, Check } from "lucide-react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { IllustrationBanner } from "../components/IllustrationBanner";
import { getAlarmSoundSettings, setAlarmSoundSettings } from "../lib/alarmSettings";
import { playPreview, stopPreview } from "../lib/alarmRinger";
import { resyncAllAlarms } from "../lib/alarmSync";
import { colors, fontSizes, radii, spacing, minTouch } from "../theme/tokens";

const SOUND_ART = require("../../assets/illustrations/alarm-sound.png");

const SLOTS: { tod: string; desc: string }[] = [
  { tod: "아침", desc: "아침 약 드실 시간 안내" },
  { tod: "점심", desc: "점심 약 드실 시간 안내" },
  { tod: "저녁", desc: "저녁 약 드실 시간 안내" },
  { tod: "취침", desc: "주무시기 전 약 안내" },
];

export function AlarmSoundScreen() {
  const [silent, setSilent] = useState<boolean | null>(null); // null = 불러오는 중
  const [applying, setApplying] = useState(false);            // 예약된 알람에 반영 중
  // 연속으로 눌렀을 때 늦게 끝난 재예약이 최신 설정을 덮어쓰지 않도록 세대를 센다.
  const genRef = useRef(0);

  useEffect(() => {
    let alive = true;
    getAlarmSoundSettings().then((s) => { if (alive) setSilent(s.silent); });
    // 화면을 떠나면 미리 듣기 재생을 반드시 멈춘다.
    return () => { alive = false; void stopPreview(); };
  }, []);

  // QA 2026-08-20: 켜짐/꺼짐을 눌렀을 때 다른 버튼이 잠시 안 눌렸다.
  //   원인은 저장(빠름)과 예약된 알람 재동기화(느림, 일정 수에 비례)를 한 await로 묶고
  //   그동안 입력을 막은 것이다. 저장만 기다리고, 재동기화는 뒤에서 돌린다.
  //   재동기화는 멱등이라 도중에 다시 눌러도 안전하다.
  async function choose(nextSilent: boolean): Promise<void> {
    if (silent === nextSilent) return;
    const gen = ++genRef.current;
    const prev = silent;
    setSilent(nextSilent); // 낙관적 반영 — 저장이 실패하면 되돌린다
    void stopPreview();
    try {
      await setAlarmSoundSettings({ silent: nextSilent });
    } catch {
      if (genRef.current === gen) setSilent(prev);
      Alert.alert("설정을 저장하지 못했어요", "잠시 후 다시 시도해 주세요.");
      return;
    }
    // 이미 예약된 알람은 예전 채널/소리를 물고 있으므로 다시 예약해야 설정이 반영된다.
    // 화면을 막지 않고 진행 표시만 남긴다.
    setApplying(true);
    try {
      await resyncAllAlarms();
    } catch {
      // 다음 앱 실행 때 resyncAllAlarms가 다시 돌면서 따라잡는다 — 사용자를 막지 않는다.
    } finally {
      if (genRef.current === gen) setApplying(false);
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
        <IllustrationBanner source={SOUND_ART} tone="coral" height={184} imageScale={0.9} />
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
        {applying ? <Text style={styles.applying}>알람에 적용하는 중이에요…</Text> : null}

        {/* 아이폰에서 "알람이 울렸는데 안내 음성이 안 나온다"는 QA 보고.
            iOS는 무음 모드(옆면 스위치/제어센터 벨 끄기)면 알림 소리를 재생하지 않는다.
            앱이 어찌할 수 없는 OS 동작이라, 대신 어디를 확인하면 되는지 알려준다.
            알림을 누르면 뜨는 알람 화면의 안내 음성은 무음 모드에서도 나온다
            (alarmRinger가 playsInSilentModeIOS로 재생). */}
        {Platform.OS === "ios" && !silent ? (
          <View style={styles.iosNote}>
            <Text style={styles.iosNoteTitle}>아이폰에서 소리가 안 나온다면</Text>
            <Text style={styles.iosNoteText}>
              휴대폰이 <Text style={styles.iosNoteStrong}>무음 모드</Text>면 알림 소리가 나오지 않아요.
              화면 오른쪽 위에서 아래로 쓸어내려 <Text style={styles.iosNoteStrong}>종 모양</Text>을 꺼 주세요.
              {"\n"}무음 모드여도 알림을 누르면 알람 화면에서 안내 음성이 나옵니다.
            </Text>
          </View>
        ) : null}

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
  screen: { flex: 1, backgroundColor: colors.canvas },
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
  applying: { fontSize: fontSizes.body, color: colors.primaryBlue, marginTop: spacing.xs, marginLeft: spacing.xs },
  iosNote: {
    backgroundColor: colors.lightBlueBg, borderRadius: radii.card,
    padding: spacing.md, marginTop: spacing.md,
  },
  iosNoteTitle: { fontSize: fontSizes.body, fontWeight: "800", color: colors.primaryNavy, marginBottom: 4 },
  iosNoteText: { fontSize: fontSizes.body, color: colors.primaryNavy, lineHeight: 27 },
  iosNoteStrong: { fontWeight: "800" },
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

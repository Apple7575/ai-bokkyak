import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { Check, Volume2 } from "lucide-react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { IllustrationBanner } from "../components/IllustrationBanner";
import { SpeechRate, SPEECH_RATES, describeRate, speedOf } from "../lib/ttsSpeed";
import { getSpeechRate, setSpeechRate } from "../lib/voiceSettings";
import { speak, stopSpeaking } from "../lib/tts";
import { colors, fontSizes, radii, spacing, minTouch } from "../theme/tokens";

const SPEED_ART = require("../../assets/illustrations/voice-speed.png");

// 음성 안내 속도 설정. 고르면 바로 그 속도로 들려줘서 비교할 수 있게 한다.
const SAMPLE = "아침 약 드실 시간이에요.";

export function VoiceSpeedScreen() {
  const [rate, setRate] = useState<SpeechRate | null>(null);      // null = 불러오는 중
  const [playing, setPlaying] = useState<SpeechRate | null>(null); // 지금 들려주는 중인 항목
  // 빠르게 연달아 누르면 늦게 끝난 요청이 최신 선택을 덮어쓸 수 있어 세대를 센다.
  const genRef = useRef(0);

  useEffect(() => {
    let alive = true;
    getSpeechRate().then((r) => { if (alive) setRate(r); });
    return () => { alive = false; void stopSpeaking(); };
  }, []);

  // QA 2026-08-20: '느리게'를 누르면 '보통'이 한동안 안 눌렸다.
  //   원인은 저장 + 샘플 재생(캐시가 없으면 네트워크 왕복 최대 4초)을 다 기다리는
  //   동안 화면 입력을 막은 것이다. 선택은 즉시 반영하고, 소리는 뒤에서 따라온다.
  //   speak()가 내부에서 stopSpeaking을 먼저 하므로 도중에 다른 항목을 눌러도
  //   이전 샘플이 끊기고 새 샘플이 나온다.
  async function choose(next: SpeechRate): Promise<void> {
    const gen = ++genRef.current;
    const prev = rate;
    setRate(next);      // 낙관적 반영 — 저장이 실패하면 되돌린다
    setPlaying(next);
    try {
      await setSpeechRate(next);
    } catch {
      if (genRef.current === gen) { setRate(prev); setPlaying(null); }
      Alert.alert("설정을 저장하지 못했어요", "잠시 후 다시 시도해 주세요.");
      return;
    }
    try {
      // 바꾼 속도를 들려준다 — 숫자보다 귀로 확인하는 편이 빠르다.
      // 방금 저장한 값을 명시적으로 넘긴다(저장 반영 전 읽기 경합 방지).
      await speak(SAMPLE, { speed: speedOf(next) });
    } catch {
      // 소리가 안 나와도 설정은 이미 저장됐다 — 흐름을 막지 않는다.
    } finally {
      if (genRef.current === gen) setPlaying(null);
    }
  }

  if (rate === null) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="음성 안내 속도" />
        <Text style={styles.loading}>불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="음성 안내 속도" />
      <ScrollView contentContainerStyle={styles.content}>
        <IllustrationBanner source={SPEED_ART} tone="sage" height={164} />
        <Text style={styles.lead}>
          알람과 안내 음성을 읽어주는 빠르기예요. 고르시면 바로 들려드립니다.
        </Text>

        {SPEECH_RATES.map((r) => (
          <Pressable
            key={r}
            onPress={() => { void choose(r); }}
            style={({ pressed }) => [styles.card, rate === r && styles.cardOn, pressed && { opacity: 0.9 }]}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.primaryBlue + "1A" }]}>
              <Volume2 size={24} color={colors.primaryBlue} />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.label}>{r}</Text>
              <Text style={styles.desc}>
                {playing === r ? "들려드리는 중이에요…" : describeRate(r)}
              </Text>
            </View>
            {playing === r ? (
              <ActivityIndicator color={colors.primaryBlue} />
            ) : rate === r ? (
              <Check size={24} color={colors.primaryBlue} />
            ) : null}
          </Pressable>
        ))}

        <Text style={styles.note}>
          알람에 쓰는 안내 음성(아침·점심·저녁·취침)은 미리 만들어 둔 소리라 속도가
          바뀌지 않아요. 그 밖의 안내 음성에 적용됩니다.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  loading: { textAlign: "center", fontSize: fontSizes.body, color: colors.textSecondary, marginTop: spacing.lg },
  lead: { fontSize: 19, color: colors.textSecondary, lineHeight: 28, marginBottom: spacing.md },
  card: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    minHeight: minTouch, padding: spacing.md, marginBottom: spacing.sm,
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card,
  },
  cardOn: { borderColor: colors.primaryBlue, borderWidth: 2 },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  textWrap: { flex: 1 },
  label: { fontSize: 22, fontWeight: "700", color: colors.text },
  desc: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: 2 },
  note: {
    fontSize: fontSizes.body, color: colors.textSecondary, lineHeight: 26,
    marginTop: spacing.md,
  },
});

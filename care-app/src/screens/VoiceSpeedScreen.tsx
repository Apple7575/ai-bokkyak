import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from "react-native";
import { Check, Volume2 } from "lucide-react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { SpeechRate, SPEECH_RATES, describeRate } from "../lib/ttsSpeed";
import { getSpeechRate, setSpeechRate } from "../lib/voiceSettings";
import { speak, stopSpeaking } from "../lib/tts";
import { colors, fontSizes, radii, spacing, minTouch } from "../theme/tokens";

// 음성 안내 속도 설정. 고르면 바로 그 속도로 들려줘서 비교할 수 있게 한다.
const SAMPLE = "아침 약 드실 시간이에요.";

export function VoiceSpeedScreen() {
  const [rate, setRate] = useState<SpeechRate | null>(null); // null = 불러오는 중
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getSpeechRate().then((r) => { if (alive) setRate(r); });
    return () => { alive = false; void stopSpeaking(); };
  }, []);

  async function choose(next: SpeechRate): Promise<void> {
    if (busy) return;
    setBusy(true);
    const prev = rate;
    setRate(next);
    try {
      await setSpeechRate(next);
      // 바꾼 속도를 즉시 들려준다 — 숫자보다 귀로 확인하는 편이 빠르다.
      await speak(SAMPLE);
    } catch {
      setRate(prev);
      Alert.alert("설정을 저장하지 못했어요", "잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
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
              <Text style={styles.desc}>{describeRate(r)}</Text>
            </View>
            {rate === r ? <Check size={24} color={colors.primaryBlue} /> : null}
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
  screen: { flex: 1, backgroundColor: "#F7FAFF" },
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

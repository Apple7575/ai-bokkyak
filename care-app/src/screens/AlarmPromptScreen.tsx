import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Logo } from "../components/Logo";
import { BigButton } from "../components/BigButton";
import { getPatientName } from "../lib/storage";
import { colors, fontSizes, spacing, radii, shadows } from "../theme/tokens";

const LOGO_CARD = 104;
const LOGO_SIZE = 80;

// 이름 입력 직후(Case C·D) — 점검을 건너뛴 사용자에게도 알람을 설정할 기회를 준다.
// 두 선택 모두 앞으로만 가므로 뒤로 가기 버튼은 없다.
export function AlarmPromptScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void getPatientName().then((n) => { if (alive) setName(n?.trim() || null); });
    return () => { alive = false; };
  }, []);

  const setupAlarm = () => nav.reset({ index: 1, routes: [{ name: "Tabs" }, { name: "VoiceGuide" }] });
  const later = () => nav.reset({ index: 0, routes: [{ name: "Tabs" }] });

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.body}>
        <View style={styles.logo}>
          <Logo size={LOGO_SIZE} />
        </View>
        <Text style={styles.title}>{name ? `${name}님, 반가워요` : "반가워요"}</Text>
        <Text style={styles.question}>복용 알람을 설정할까요?</Text>
        <Text style={styles.sub}>약 드실 시간마다 알려드릴게요.</Text>
      </View>

      <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>
        <BigButton label="알람 설정하기" onPress={setupAlarm} showArrow />
        <BigButton label="나중에 할게요" variant="secondary" onPress={later} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  logo: {
    width: LOGO_CARD, height: LOGO_CARD, borderRadius: radii.hero, backgroundColor: colors.surfaceRaised,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.xl,
    ...shadows.card,
  },
  title: { fontSize: fontSizes.title, fontWeight: "800", color: colors.primaryNavy, textAlign: "center", marginBottom: spacing.md },
  question: { fontSize: fontSizes.hero, lineHeight: 50, fontWeight: "800", color: colors.primaryNavy, textAlign: "center", marginBottom: spacing.md },
  sub: { fontSize: fontSizes.emphasis, lineHeight: 32, color: colors.textSecondary, textAlign: "center" },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
});

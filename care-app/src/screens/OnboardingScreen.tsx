import React, { useEffect } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BellRing, CheckCircle2, ShieldCheck } from "lucide-react-native";
import { BigButton } from "../components/BigButton";
import { setOnboarded } from "../lib/storage";
import { speak, stopSpeaking } from "../lib/tts";
import { colors, fontSizes, radii, shadows, spacing } from "../theme/tokens";

const GREETING = "만나서 반갑습니다. 큰 글씨와 친절한 음성으로 복약 관리를 도와드릴게요.";
const SENIORS_ART = require("../../assets/illustrations/onboarding-seniors.png");

const FEATURES = [
  { Icon: BellRing, color: colors.coral, bg: colors.coralSoft, title: "시간에 맞춰 알려드려요", body: "정해진 복약 시간을 큰 소리로 안내해요." },
  { Icon: CheckCircle2, color: colors.primaryBlue, bg: colors.primarySoft, title: "화면을 눌러 기록해요", body: "큰 버튼을 누르면 복약 기록이 바로 남아요." },
  { Icon: ShieldCheck, color: colors.successGreen, bg: colors.successSoft, title: "안전하게 살펴드려요", body: "함께 먹을 때 주의할 약도 확인할 수 있어요." },
];

export function OnboardingScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    void speak(GREETING);
    return () => { void stopSpeaking(); };
  }, []);

  async function start() {
    await setOnboarded();
    await stopSpeaking();
    nav.reset({ index: 0, routes: [{ name: "RoleSelect" }] });
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.kicker}><Text style={styles.kickerText}>처음 오셨나요?</Text></View>
        <Text style={styles.title}>복약 관리가{`\n`}한결 편안해져요</Text>
        <Text style={styles.subtitle}>복잡한 기능은 줄이고 꼭 필요한 안내를 크고 분명하게 담았습니다.</Text>

        <View style={styles.artCard}>
          <View style={styles.artBlob} />
          <Image source={SENIORS_ART} style={styles.art} resizeMode="contain" />
        </View>

        <View style={styles.featureList}>
          {FEATURES.map(({ Icon, color, bg, title, body }) => (
            <View key={title} style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: bg }]}><Icon size={28} strokeWidth={2.3} color={color} /></View>
              <View style={styles.featureCopy}>
                <Text style={styles.featureTitle}>{title}</Text>
                <Text style={styles.featureBody}>{body}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>
        <BigButton label="내 정보 등록하기" onPress={() => void start()} showArrow />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  kicker: { alignSelf: "flex-start", backgroundColor: colors.sunshineSoft, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 8 },
  kickerText: { color: colors.primaryNavy, fontSize: 16, fontWeight: "800" },
  title: { marginTop: spacing.md, color: colors.primaryNavy, fontSize: 34, lineHeight: 44, letterSpacing: -1, fontWeight: "800" },
  subtitle: { marginTop: spacing.md, color: colors.textSecondary, fontSize: fontSizes.body, lineHeight: 29 },
  artCard: { height: 260, marginTop: spacing.lg, borderRadius: radii.hero, backgroundColor: colors.primarySoft, overflow: "hidden", alignItems: "center", justifyContent: "flex-end", ...shadows.card },
  artBlob: { position: "absolute", width: 190, height: 190, borderRadius: 95, right: -50, top: -50, backgroundColor: colors.coralSoft },
  art: { width: "92%", height: "108%", marginBottom: -18 },
  featureList: { marginTop: spacing.lg, gap: 12 },
  featureCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceRaised, borderRadius: radii.card, padding: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadows.card },
  featureIcon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  featureCopy: { flex: 1 },
  featureTitle: { color: colors.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  featureBody: { marginTop: 4, color: colors.textSecondary, fontSize: 17, lineHeight: 25 },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, backgroundColor: colors.canvas },
});

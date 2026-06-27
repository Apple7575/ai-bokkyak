import React, { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BigButton } from "../components/BigButton";
import { setOnboarded } from "../lib/storage";
import { speak, stopSpeaking } from "../lib/tts";
import { colors, fontSizes, spacing, radii } from "../theme/tokens";

const GREETING =
  "만나서 반갑습니다. 저는 깜빡하기 쉬운 복약을 음성 AI로 챙겨주는 모두의 복약입니다. " +
  "간단한 회원가입 후, 건강에 중요한 복약을 저와 함께 관리해보실까요?";

export function OnboardingScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();

  // 데모처럼 텍스트와 함께 음성 안내도 재생. 화면을 떠나면 멈춘다.
  // 네트워크 TTS가 이탈 후 늦게 시작돼 다음 화면에서 들리지 않게 취소 가드.
  useEffect(() => {
    let cancelled = false;
    speak(GREETING).then((ok) => { if (ok && cancelled) stopSpeaking(); });
    return () => { cancelled = true; stopSpeaking(); };
  }, []);

  async function start() {
    await setOnboarded(); // 다시 보지 않게 표시
    await stopSpeaking();
    nav.reset({ index: 0, routes: [{ name: "RoleSelect" }] });
  }

  return (
    <View style={s.screen}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.xl, paddingBottom: spacing.xl }]}
      >
        {/* 말풍선 느낌의 인사 카드 */}
        <View style={s.bubble}>
          <Text style={s.hi}>만나서 반갑습니다~</Text>
          <Text style={s.line}>
            저는 깜빡하기 쉬운 복약을{"\n"}음성 AI로 챙겨주는{"\n"}
            <Text style={s.brand}>모두의 복약</Text>입니다.
          </Text>
          <Text style={s.line2}>
            간단한 회원가입 후,{"\n"}건강에 중요한 복약을{"\n"}저와 함께 관리해보실까요?
          </Text>
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: spacing.lg + insets.bottom }]}>
        <BigButton label="회원가입하기" onPress={start} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.lightBlueBg },
  content: { paddingHorizontal: spacing.lg, flexGrow: 1, justifyContent: "center", alignItems: "center" },
  bubble: {
    backgroundColor: colors.cardBg, borderRadius: radii.card, padding: spacing.xl,
    width: "100%", alignItems: "center",
    shadowColor: colors.primaryNavy, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 14, elevation: 3,
  },
  hi: { fontSize: fontSizes.emphasis, fontWeight: "800", color: colors.primaryNavy, textAlign: "center", marginBottom: spacing.md },
  line: { fontSize: fontSizes.emphasis, color: colors.text, textAlign: "center", lineHeight: 34 },
  brand: { color: colors.primaryBlue, fontWeight: "800" },
  line2: { fontSize: fontSizes.body, color: colors.textSecondary, textAlign: "center", lineHeight: 30, marginTop: spacing.lg },
  footer: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
    backgroundColor: colors.lightBlueBg,
  },
});

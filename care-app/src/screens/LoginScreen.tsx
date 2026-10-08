import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Platform, ActivityIndicator } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import { ChevronLeft, MessageCircle } from "lucide-react-native";
import { Logo } from "../components/Logo";
import { signInWithKakao, signInWithApple } from "../lib/auth";
import { adoptPatient, findMyPatient } from "../lib/account";
import { continueAfterLogin } from "../navigation/afterLogin";
import type { LoginPurpose } from "../navigation/types";
import { colors, fontSizes, spacing, radii, minTouch, shadows } from "../theme/tokens";

const LOGO_CARD = 104;
const LOGO_SIZE = 80;
const IOS = Platform.OS === "ios";

// 간편 로그인 — 회의 2026-10-08. 비밀번호·이메일·전화번호는 없다.
// 안드로이드는 카카오만, iOS는 카카오 + Apple(App Store 가이드라인 4.8: 다른 회사 로그인을 두면 Apple도 둔다).
// 1분 점검은 로그인 없이 되고, 결과를 저장하거나 알람을 맞출 때·점검을 건너뛸 때 여기로 온다.
// 로그인 뒤: 이미 쓰던 계정이면 그 환자를 이 기기에 앉히고 바로 이어 가고(afterLogin),
// 처음이면 동의 화면에서 이름과 동의를 받는다.

const COPY: Record<LoginPurpose, { title: string; sub: string }> = {
  save: {
    // 짧게, 줄은 직접 나눈다 — 한글은 글자 단위로 줄이 바뀌어 길면 「로/그인」처럼 단어가 쪼개진다.
    // 알람 이야기는 아래 설명 줄이 맡는다.
    title: "결과를 저장하려면\n로그인해 주세요",
    sub: "로그인하면 휴대폰을 바꿔도 점검 결과와 알람이 그대로 남아요.",
  },
  skip: {
    title: IOS ? "카카오나 Apple로 간편하게 시작해요" : "카카오로 간편하게 시작해요",
    sub: "로그인하면 약 알람과 복약 기록을 모아 둘 수 있어요.",
  },
  returning: {
    title: "쓰던 계정으로 로그인해요",
    sub: "전에 쓰던 계정으로 로그인하면 약과 기록을 그대로 불러와요.",
  },
};

export function LoginScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const purpose: LoginPurpose = route.params?.purpose ?? "skip";
  const medicines: string[] | undefined = route.params?.medicines;
  const copy = COPY[purpose];

  // 두 번 눌러 로그인 창이 두 번 뜨지 않게 — ref는 동기 가드, state는 버튼 문구·비활성용.
  const busyRef = useRef(false);
  const [busy, setBusy] = useState<null | "kakao" | "apple">(null);
  // 로그인 중에 화면을 떠났으면 늦게 끝난 실패 안내가 다른 화면 위에 뜨지 않게.
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  function goBack() {
    if (busyRef.current) return;
    if (nav.canGoBack()) nav.goBack();
    else nav.reset({ index: 0, routes: [{ name: "Intro", params: { slide: "cta" } }] });
  }

  // 로그인 성공 뒤 — 이 계정의 환자가 있으면 이어 가고, 없으면 동의 화면으로.
  // 조회 실패는 "처음 가입"으로 넘기지 않는다(쓰던 사람에게 환자를 하나 더 만들게 된다).
  async function afterSignIn(appleFullName: string | null): Promise<void> {
    let mine;
    try {
      mine = await findMyPatient();
    } catch (e) {
      console.warn("Login: 내 정보 조회 실패", (e as Error)?.message ?? e);
      if (mounted.current) Alert.alert("로그인하지 못했어요", "인터넷 연결을 확인하고 다시 시도해 주세요.");
      return;
    }
    if (mine) {
      await adoptPatient(mine);
      await continueAfterLogin(nav, { purpose, medicines, isNew: false });
      return;
    }
    nav.navigate("Consent", { purpose, medicines, appleFullName });
  }

  async function run(kind: "kakao" | "apple"): Promise<void> {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(kind);
    try {
      if (kind === "kakao") {
        const r = await signInWithKakao();
        if (!r.ok) { if (!r.canceled && mounted.current) Alert.alert("카카오 로그인", r.message); return; }
        await afterSignIn(null);
      } else {
        const r = await signInWithApple();
        if (!r.ok) { if (!r.canceled && mounted.current) Alert.alert("Apple 로그인", r.message); return; }
        await afterSignIn(r.appleFullName);
      }
    } catch (e) {
      console.warn("Login: 로그인 후 처리 실패", (e as Error)?.message ?? e);
      if (mounted.current) Alert.alert("로그인하지 못했어요", "잠시 후 다시 시도해 주세요.");
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={goBack} disabled={busy !== null} hitSlop={12} style={styles.backBtn}
          accessibilityRole="button" accessibilityLabel="뒤로">
          <ChevronLeft size={26} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.logo}><Logo size={LOGO_SIZE} /></View>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.sub}>{copy.sub}</Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>
        {/* 카카오 공식 버튼 규격: 노랑 바탕, 검정 말풍선 심볼, 검정 85% 글자 */}
        <Pressable
          onPress={() => { void run("kakao"); }}
          disabled={busy !== null}
          accessibilityRole="button"
          accessibilityLabel="카카오로 계속하기"
          accessibilityState={{ disabled: busy !== null, busy: busy === "kakao" }}
          style={({ pressed }) => [styles.kakaoBtn, pressed && styles.pressed, busy !== null && busy !== "kakao" && styles.dimmed]}
        >
          {busy === "kakao" ? (
            <ActivityIndicator color={colors.kakaoSymbol} />
          ) : (
            <MessageCircle size={24} color={colors.kakaoSymbol} fill={colors.kakaoSymbol} />
          )}
          <Text style={styles.kakaoText}>{busy === "kakao" ? "로그인 중…" : "카카오로 계속하기"}</Text>
        </Pressable>

        {/* Apple 공식 버튼 — 글자·모양은 Apple이 그린다. 로그인 중에는 눌리지 않게 감싼다. */}
        {IOS ? (
          <View pointerEvents={busy !== null ? "none" : "auto"} style={[styles.appleWrap, busy !== null && styles.dimmed]}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={radii.small}
              style={styles.appleBtn}
              onPress={() => { void run("apple"); }}
            />
          </View>
        ) : null}

        <Text style={styles.note}>
          {IOS ? "비밀번호 없이 카카오·Apple 계정으로 로그인해요." : "비밀번호 없이 카카오 계정으로 로그인해요."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: { height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm },
  backBtn: { width: minTouch, height: minTouch, alignItems: "center", justifyContent: "center" },
  body: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  logo: {
    width: LOGO_CARD, height: LOGO_CARD, borderRadius: radii.hero, backgroundColor: colors.surfaceRaised,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.xl,
    ...shadows.card,
  },
  title: { fontSize: 28, lineHeight: 39, fontWeight: "800", color: colors.primaryNavy, textAlign: "center", letterSpacing: -0.6 },
  sub: { marginTop: spacing.md, fontSize: fontSizes.body, lineHeight: 27, color: colors.textSecondary, textAlign: "center" },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  kakaoBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    minHeight: minTouch, borderRadius: radii.small, backgroundColor: colors.kakao, paddingHorizontal: spacing.md,
  },
  kakaoText: { fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.kakaoLabel },
  appleWrap: { width: "100%" },
  appleBtn: { width: "100%", height: minTouch },
  pressed: { opacity: 0.85 },
  dimmed: { opacity: 0.5 },
  note: { marginTop: spacing.xs, fontSize: fontSizes.body, lineHeight: 26, color: colors.textSecondary, textAlign: "center" },
});

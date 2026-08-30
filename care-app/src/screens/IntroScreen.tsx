import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo, Animated, BackHandler, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ClipboardList, Leaf, Link2, Package, Pill } from "lucide-react-native";
import { Logo } from "../components/Logo";
import { INTRO_SLIDES, SKIP_TARGET_INDEX, dotState, nextIndex, prevIndex } from "../lib/introSlides";
import { setOnboarded } from "../lib/storage";
import { speak, stopSpeaking } from "../lib/tts";
import { colors, fontSizes, minTouch, radii, shadows, spacing } from "../theme/tokens";

// 인트로 — 시안 V8 화면 1~7 (브랜드 2장 → 온보딩 4장 → 시작 CTA)을 한 화면에서 넘긴다.
// 옛 Splash + Onboarding 화면을 대체한다. 슬라이드 순서·자동 진행 시간은 lib/introSlides.ts.

const GREETING = "만나서 반갑습니다. 큰 글씨와 친절한 음성으로 복약 관리를 도와드릴게요.";
const FADE_MS = 220;

export function IntroScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const reduceMotion = useRef(false);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaving = useRef(false);

  // 인사 TTS — 느린 네트워크에서 화면 이탈 후 도착하면 다음 화면 위에서 재생되므로 취소 플래그로 가드.
  useEffect(() => {
    let cancelled = false;
    speak(GREETING).then((ok) => { if (ok && cancelled) void stopSpeaking(); });
    return () => { cancelled = true; void stopSpeaking(); };
  }, []);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (alive) reduceMotion.current = v; })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const clearAuto = useCallback(() => {
    if (autoTimer.current) { clearTimeout(autoTimer.current); autoTimer.current = null; }
  }, []);

  // 슬라이드 전환 — 페이드 아웃 → 인덱스 교체 → 페이드 인. 움직임 줄이기 설정이면 바로 교체.
  const goTo = useCallback((next: number) => {
    clearAuto();
    if (next === indexRef.current) return;
    const swap = () => { indexRef.current = next; setIndex(next); };
    if (reduceMotion.current) { swap(); return; }
    Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return;
      swap();
      Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
    });
  }, [clearAuto, opacity]);

  // 자동 진행(브랜드 슬라이드). 슬라이드가 바뀔 때마다 다시 건다; 화면을 떠나면 모두 지운다.
  useEffect(() => {
    const ms = INTRO_SLIDES[index].autoAdvanceMs;
    if (ms === null) return;
    autoTimer.current = setTimeout(() => goTo(nextIndex(index)), ms);
    return clearAuto;
  }, [index, goTo, clearAuto]);

  useEffect(() => () => { clearAuto(); opacity.stopAnimation(); }, [clearAuto, opacity]);

  // 하드웨어 뒤로가기 — 이전 슬라이드. 첫 슬라이드에서는 기본 동작.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      const prev = prevIndex(indexRef.current);
      if (prev === null) return false;
      goTo(prev);
      return true;
    });
    return () => sub.remove();
  }, [goTo]);

  const tapNext = () => goTo(nextIndex(indexRef.current));
  const skip = () => goTo(SKIP_TARGET_INDEX);

  // 두 번 눌러 reset이 두 번 나가지 않게 (입력을 잠그는 게 아니라 재진입만 막는다).
  async function leave(routes: { name: string }[]) {
    if (leaving.current) return;
    leaving.current = true;
    clearAuto();
    try {
      await setOnboarded();
      await stopSpeaking();
      nav.reset({ index: routes.length - 1, routes });
    } finally {
      leaving.current = false;
    }
  }
  const startQuickCheck = () => void leave([{ name: "RoleSelect" }, { name: "QuickCheckInput" }]);
  const startAlarm = () => void leave([{ name: "RoleSelect" }]);

  const slide = INTRO_SLIDES[index];
  const dots = dotState(index);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* 상단 바 — 온보딩 슬라이드(3~6)에서만: 점 4개 + 건너뛰기 */}
      {slide.showBar ? (
        <View style={styles.bar}>
          <View style={styles.barSpacer} />
          <View style={styles.dots} accessibilityLabel={`${dots.active + 1}쪽, 전체 ${dots.count}쪽`}>
            {Array.from({ length: dots.count }).map((_, i) => (
              <View key={i} style={[styles.dot, i === dots.active && styles.dotOn]} />
            ))}
          </View>
          <Pressable onPress={skip} hitSlop={8} style={styles.skipBtn} accessibilityRole="button" accessibilityLabel="건너뛰기">
            <Text style={styles.skipText}>건너뛰기</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.bar} />
      )}

      <Animated.View style={[styles.body, { opacity }]}>
        {index === 0 ? <Brand1 onTap={tapNext} /> : null}
        {index === 1 ? <Brand2 onTap={tapNext} /> : null}
        {index === 2 ? <Onboarding1 onNext={tapNext} /> : null}
        {index === 3 ? <Onboarding2 onNext={tapNext} /> : null}
        {index === 4 ? <Onboarding3 onNext={tapNext} /> : null}
        {index === 5 ? <Onboarding4 onNext={tapNext} /> : null}
        {index === 6 ? <Cta onPrimary={startQuickCheck} onSecondary={startAlarm} /> : null}
      </Animated.View>
    </View>
  );
}

// ── 1. 브랜드 인트로 ────────────────────────────────────────────────────────
function Brand1({ onTap }: { onTap: () => void }) {
  return (
    <Pressable onPress={onTap} style={styles.brand1} accessibilityRole="button" accessibilityLabel="탭하여 계속">
      <Text style={styles.brand1Big}>진짜 건강은</Text>
      <Text style={styles.brand1Sub}>더 많이 먹는 것이 아니라,</Text>
      <Text style={styles.brand1Line}>
        <Text style={styles.bandGreen}>제대로 먹는 것</Text>에서{"\n"}시작됩니다.
      </Text>
      <Text style={styles.tapHint}>탭하여 계속</Text>
    </Pressable>
  );
}

// ── 2. 브랜드 로고 ──────────────────────────────────────────────────────────
function Brand2({ onTap }: { onTap: () => void }) {
  return (
    <Pressable onPress={onTap} style={styles.brand2} accessibilityRole="button" accessibilityLabel="탭하여 계속">
      <View style={styles.logoRing}><Logo size={104} /></View>
      <Text style={styles.brand2Title}>나에게 필요한 것만,{"\n"}<Text style={styles.accentBlue}>올바르게</Text></Text>
      <Text style={styles.brand2Word}>모두의 복약</Text>
      <Text style={styles.tapHint}>탭하여 계속</Text>
    </Pressable>
  );
}

// ── 3. 하나의 복용 조합 ─────────────────────────────────────────────────────
const TILES = [
  { Icon: Pill, label: "처방약", bg: colors.primarySoft, color: colors.primaryBlue },
  { Icon: Package, label: "일반의약품", bg: colors.lightBlueBg, color: colors.secondaryBlue },
  { Icon: Leaf, label: "건강기능식품", bg: colors.successSoft, color: colors.successGreen },
];

function Onboarding1({ onNext }: { onNext: () => void }) {
  return (
    <View style={styles.onb}>
      <ScrollView contentContainerStyle={styles.onbCenter} showsVerticalScrollIndicator={false}>
        <Text style={styles.onb1Title}>
          <Text style={styles.accentBlue}>영양제부터 처방약까지,</Text>{"\n"}
          몸에서는 <Text style={styles.bandGreen}>하나의 복용 조합</Text>입니다.
        </Text>
        <View style={styles.tiles}>
          {TILES.map(({ Icon, label, bg, color }) => (
            <View key={label} style={styles.tile}>
              <View style={[styles.tileIcon, { backgroundColor: bg }]}><Icon size={30} strokeWidth={2.2} color={color} /></View>
              <Text style={styles.tileLabel}>{label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.joinLines}>
          <View style={styles.joinLine} /><View style={styles.joinLine} /><View style={styles.joinLine} />
        </View>
        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Link2 size={18} color={colors.primaryBlue} />
            <Text style={styles.pillText}>내 몸속 하나의 복용 조합</Text>
          </View>
        </View>
        <Text style={styles.onb1Body}>
          효과 있는 복용은 결국{"\n"}
          <Text style={styles.onb1BodyAccent}>나에게 필요한 것만 올바르게</Text>{"\n"}
          먹는 것에서 시작됩니다.
        </Text>
      </ScrollView>
      <NextButton onPress={onNext} />
    </View>
  );
}

// ── 4. 낭비와 위험 ──────────────────────────────────────────────────────────
function Onboarding2({ onNext }: { onNext: () => void }) {
  return (
    <View style={styles.onb}>
      <ScrollView contentContainerStyle={styles.onbCenterLeft} showsVerticalScrollIndicator={false}>
        <Text style={styles.onb2Lead}>건강을 위해 챙겨 먹는 약과 영양제.</Text>
        <Text style={styles.onb2Title}>
          <Text style={styles.bandOrange}>불필요한 영양제</Text>는{"\n"}
          <Text style={styles.accentOrange}>낭비</Text>가 되고,{"\n"}
          잘못된 복용 조합은{"\n"}
          <Text style={styles.accentRed}>건강을 해칠 수 있습니다.</Text>
        </Text>
      </ScrollView>
      <NextButton onPress={onNext} />
    </View>
  );
}

// ── 5. 1분 복용 점검 ────────────────────────────────────────────────────────
function Onboarding3({ onNext }: { onNext: () => void }) {
  return (
    <View style={styles.onb}>
      <ScrollView contentContainerStyle={styles.onbTop} showsVerticalScrollIndicator={false}>
        <Text style={styles.onb3Title}>
          그래서,{"\n"}
          <Text style={styles.onb3Big}>1분 복용 점검</Text>으로{"\n"}
          불필요한 소비와{"\n"}
          위험한 복용 조합을{"\n"}
          한 번에 확인하세요.
        </Text>
        <View style={styles.exampleCard}>
          <View style={styles.exampleHead}>
            <Text style={styles.exampleHeadText}>내 복용 정보 분석</Text>
            <View style={styles.checkDot}><Check size={13} strokeWidth={3} color={colors.white} /></View>
          </View>
          <View style={styles.exampleBarTrack}><View style={styles.exampleBarFill} /></View>
          <View style={styles.exampleDivider} />
          <View style={styles.exampleRow}>
            <View style={styles.exampleIcon}><Link2 size={18} color={colors.primaryBlue} /></View>
            <Text style={styles.exampleRowLabel}>함께 복용 시 주의</Text>
            <View style={styles.exampleRowRight}>
              <View style={styles.redDot} />
              <Text style={styles.exampleRowStatus}>확인 필요</Text>
            </View>
          </View>
          <View style={styles.exampleDivider} />
          <View style={styles.exampleFoot}>
            <Text style={styles.exampleFootCount}>확인 필요 2건</Text>
            <View style={styles.blueTag}><Text style={styles.blueTagText}>약사 확인 권장</Text></View>
          </View>
        </View>
      </ScrollView>
      <NextButton onPress={onNext} />
    </View>
  );
}

// ── 6. 병용금기 기준 점검 (약사 연결·공유 동의는 회의 결정으로 제거, 문구 교체) ──
function Onboarding4({ onNext }: { onNext: () => void }) {
  return (
    <View style={styles.onb}>
      <ScrollView contentContainerStyle={styles.onbTop} showsVerticalScrollIndicator={false}>
        <Text style={styles.onb4Title}>
          식약처 <Text style={styles.bandGreen}>병용금기 기준</Text>으로{"\n"}
          점검하고, 확인이 필요한{"\n"}
          조합은 <Text style={styles.accentGreen}>약사 확인</Text>을{"\n"}
          권해드립니다.
        </Text>
        <View style={styles.compactCard}>
          <View style={styles.compactIcon}><ClipboardList size={20} color={colors.primaryBlue} /></View>
          <View style={styles.compactCopy}>
            <Text style={styles.compactTitle}>복용 점검 결과</Text>
            <Text style={styles.compactSub}>함께 복용 시 주의</Text>
          </View>
          <View style={styles.redTag}><Text style={styles.redTagText}>확인 필요 2건</Text></View>
        </View>
      </ScrollView>
      <NextButton onPress={onNext} />
    </View>
  );
}

// ── 7. 시작 CTA ─────────────────────────────────────────────────────────────
const CHECKS = ["회원가입 없이 바로", "영양제·약 한 번에 분석", "사진·이름 일부로도 가능"];

function Cta({ onPrimary, onSecondary }: { onPrimary: () => void; onSecondary: () => void }) {
  return (
    <View style={styles.onb}>
      <ScrollView contentContainerStyle={styles.ctaCenter} showsVerticalScrollIndicator={false}>
        <View style={styles.logoRingSmall}><Logo size={56} /></View>
        <Text style={styles.ctaLead}>불필요한 소비를 줄이고,</Text>
        <Text style={styles.ctaTitle}>
          <Text style={styles.bandGreen}>건강해지는 복용</Text>의{"\n"}첫걸음, 지금 시작해보세요.
        </Text>
        <Text style={styles.ctaSub}>1분이면 충분합니다.</Text>
        <View style={styles.checkList}>
          {CHECKS.map((t) => (
            <View key={t} style={styles.checkRow}>
              <View style={styles.checkDot}><Check size={13} strokeWidth={3} color={colors.white} /></View>
              <Text style={styles.checkText}>{t}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <Pressable onPress={onPrimary} accessibilityRole="button" accessibilityLabel="내 복용 1분 점검하기"
        style={({ pressed }) => [styles.ctaPrimary, pressed && styles.pressed]}>
        <Text style={styles.ctaPrimaryText}>내 복용 1분 점검하기</Text>
      </Pressable>
      <Pressable onPress={onSecondary} accessibilityRole="button" accessibilityLabel="복용 알람부터 시작하기"
        style={({ pressed }) => [styles.ctaSecondary, pressed && { opacity: 0.7 }]}>
        <Text style={styles.ctaSecondaryText}>복용 알람부터 시작하기</Text>
      </Pressable>
    </View>
  );
}

function NextButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="다음"
      style={({ pressed }) => [styles.nextBtn, pressed && styles.pressed]}>
      <Text style={styles.nextText}>다음</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  body: { flex: 1 },

  // 상단 바 (시안 52px)
  bar: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10 },
  barSpacer: { width: 84 },
  dots: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  dotOn: { width: 22, backgroundColor: colors.primaryBlue },
  skipBtn: { width: 84, height: 48, alignItems: "flex-end", justifyContent: "center", paddingHorizontal: 12 },
  skipText: { fontSize: 16, fontWeight: "600", color: colors.textSecondary },

  // 공통 서식
  accentBlue: { color: colors.primaryBlue },
  accentGreen: { color: colors.successGreen },
  accentOrange: { color: colors.warningOrange },
  accentRed: { color: colors.dangerRed },
  bandGreen: { backgroundColor: colors.successSoft },
  bandOrange: { backgroundColor: colors.warningSoft },
  tapHint: { position: "absolute", bottom: spacing.lg, alignSelf: "center", fontSize: 15, fontWeight: "600", color: colors.textSecondary },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },

  // 1
  brand1: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.xl, paddingBottom: 48 },
  brand1Big: { fontSize: fontSizes.hero, fontWeight: "800", color: colors.primaryNavy, letterSpacing: -1 },
  brand1Sub: { marginTop: spacing.md, fontSize: fontSizes.title, fontWeight: "500", color: colors.textSecondary, letterSpacing: -0.5 },
  brand1Line: { marginTop: 14, fontSize: 34, lineHeight: 48, fontWeight: "800", color: colors.primaryNavy, letterSpacing: -1 },

  // 2
  brand2: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, paddingBottom: 56 },
  logoRing: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  brand2Title: { marginTop: 20, textAlign: "center", fontSize: 30, lineHeight: 41, fontWeight: "800", color: colors.primaryNavy, letterSpacing: -0.8 },
  brand2Word: { marginTop: 14, fontSize: fontSizes.body, fontWeight: "700", color: colors.textSecondary, letterSpacing: 5, paddingLeft: 5 },

  // 온보딩 공통 (시안 padding 6px 24px 24px)
  onb: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: 6, paddingBottom: spacing.lg },
  onbCenter: { flexGrow: 1, justifyContent: "center", paddingBottom: spacing.md },
  onbCenterLeft: { flexGrow: 1, justifyContent: "center", paddingBottom: spacing.md },
  onbTop: { flexGrow: 1, paddingTop: 4, paddingBottom: 14 },
  nextBtn: { height: minTouch, borderRadius: radii.pill, backgroundColor: colors.primaryBlue, alignItems: "center", justifyContent: "center" },
  nextText: { color: colors.white, fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },

  // 3
  onb1Title: { textAlign: "center", fontSize: 26, lineHeight: 38, fontWeight: "800", color: colors.primaryNavy, letterSpacing: -0.7 },
  tiles: { flexDirection: "row", marginTop: 30 },
  tile: { flex: 1, alignItems: "center", gap: 6 },
  tileIcon: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  tileLabel: { fontSize: 14, fontWeight: "700", color: colors.textSecondary },
  joinLines: { flexDirection: "row", justifyContent: "space-evenly", height: 34, paddingHorizontal: spacing.xl },
  joinLine: { width: 1.5, height: "100%", backgroundColor: colors.border },
  pillRow: { alignItems: "center" },
  pill: { height: 44, paddingHorizontal: 17, borderRadius: 22, backgroundColor: colors.primarySoft, borderWidth: 1.5, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 8 },
  pillText: { fontSize: 16.5, fontWeight: "800", color: colors.primaryBlue, letterSpacing: -0.3 },
  onb1Body: { marginTop: 28, textAlign: "center", fontSize: fontSizes.emphasis, lineHeight: 33, fontWeight: "700", color: colors.text, letterSpacing: -0.5 },
  onb1BodyAccent: { color: colors.primaryBlue, fontWeight: "800" },

  // 4
  onb2Lead: { fontSize: fontSizes.emphasis, fontWeight: "600", color: colors.textSecondary, letterSpacing: -0.5 },
  onb2Title: { marginTop: spacing.md, fontSize: 28, lineHeight: 42, fontWeight: "800", color: colors.primaryNavy, letterSpacing: -0.8 },

  // 5
  onb3Title: { fontSize: 25, lineHeight: 36, fontWeight: "800", color: colors.primaryNavy, letterSpacing: -0.6 },
  onb3Big: { fontSize: 36, color: colors.primaryBlue, letterSpacing: -1.2 },
  exampleCard: { marginTop: 18, backgroundColor: colors.white, borderRadius: 18, paddingVertical: spacing.md, paddingHorizontal: 18, ...shadows.card },
  exampleHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  exampleHeadText: { fontSize: 15, fontWeight: "700", color: colors.textSecondary },
  checkDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.successGreen, alignItems: "center", justifyContent: "center" },
  exampleBarTrack: { marginTop: 10, height: 8, borderRadius: 4, backgroundColor: colors.canvasMuted, overflow: "hidden" },
  exampleBarFill: { height: 8, borderRadius: 4, backgroundColor: colors.primaryBlue },
  exampleDivider: { height: 1, backgroundColor: colors.canvasMuted, marginTop: spacing.md },
  exampleRow: { height: 52, flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  exampleIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  exampleRowLabel: { fontSize: fontSizes.body, fontWeight: "700", color: colors.primaryNavy },
  exampleRowRight: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 6 },
  redDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.dangerRed },
  exampleRowStatus: { fontSize: 15.5, fontWeight: "700", color: colors.dangerRed },
  exampleFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  exampleFootCount: { fontSize: 17, fontWeight: "800", color: colors.dangerRed },
  blueTag: { height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  blueTagText: { fontSize: 14, fontWeight: "700", color: colors.primaryBlue },

  // 6
  onb4Title: { fontSize: 27, lineHeight: 40, fontWeight: "800", color: colors.primaryNavy, letterSpacing: -0.6 },
  compactCard: { marginTop: spacing.lg, backgroundColor: colors.white, borderRadius: 16, paddingVertical: 14, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: 12, ...shadows.card },
  compactIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  compactCopy: { flex: 1 },
  compactTitle: { fontSize: 17, fontWeight: "700", color: colors.primaryNavy },
  compactSub: { marginTop: 1, fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  redTag: { height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: colors.dangerSoft, alignItems: "center", justifyContent: "center" },
  redTagText: { fontSize: 14, fontWeight: "700", color: colors.dangerRed },

  // 7
  ctaCenter: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingBottom: spacing.md },
  logoRingSmall: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  ctaLead: { marginTop: spacing.lg, textAlign: "center", fontSize: 20, fontWeight: "600", color: colors.textSecondary, letterSpacing: -0.4 },
  ctaTitle: { marginTop: 10, textAlign: "center", fontSize: 30, lineHeight: 43, fontWeight: "800", color: colors.primaryNavy, letterSpacing: -0.9 },
  ctaSub: { marginTop: 12, textAlign: "center", fontSize: fontSizes.body, fontWeight: "600", color: colors.textSecondary, letterSpacing: -0.3 },
  checkList: { marginTop: 20, gap: 9, alignSelf: "stretch" },
  checkRow: { height: 48, paddingHorizontal: 20, borderRadius: 24, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.successSoft, flexDirection: "row", alignItems: "center", gap: 9 },
  checkText: { fontSize: 17.5, fontWeight: "700", color: colors.primaryNavy, letterSpacing: -0.3 },
  ctaPrimary: { height: 62, borderRadius: 31, backgroundColor: colors.primaryBlue, alignItems: "center", justifyContent: "center", ...shadows.floating },
  ctaPrimaryText: { color: colors.white, fontSize: 21, fontWeight: "800", letterSpacing: -0.3 },
  ctaSecondary: { height: 50, marginTop: spacing.sm, alignItems: "center", justifyContent: "center" },
  ctaSecondaryText: { color: colors.textSecondary, fontSize: 16.5, fontWeight: "600" },
});

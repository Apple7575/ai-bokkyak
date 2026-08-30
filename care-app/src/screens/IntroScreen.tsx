import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo, Animated, BackHandler, Easing, Pressable, ScrollView, StyleSheet, Text, View, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ClipboardList, Gauge, Info, Layers, Leaf, Link2, Package, Pill, Plus } from "lucide-react-native";
import { Logo } from "../components/Logo";
import { INTRO_SLIDES, SKIP_TARGET_INDEX, dotState, nextIndex, prevIndex } from "../lib/introSlides";
import { setOnboarded } from "../lib/storage";
import { speak, stopSpeaking } from "../lib/tts";
import { colors, fontSizes, minTouch, radii, shadows, spacing } from "../theme/tokens";

// 인트로 — 시안 V8 화면 1~7 (브랜드 2장 → 온보딩 4장 → 시작 CTA)을 한 화면에서 넘긴다.
// 옛 Splash + Onboarding 화면을 대체한다. 슬라이드 순서·자동 진행 시간은 lib/introSlides.ts.

const GREETING = "만나서 반갑습니다. 큰 글씨와 친절한 음성으로 복약 관리를 도와드릴게요.";
const FADE_MS = 220;

// 움직임 줄이기 설정 — 모듈 단위로 한 번 읽어 Reveal이 공유한다(슬라이드마다 다시 묻지 않게).
let reduceMotionGlobal = false;
AccessibilityInfo.isReduceMotionEnabled().then((v) => { reduceMotionGlobal = v; }).catch(() => {});

type RevealKind = "up" | "pop" | "fade" | "scale" | "line" | "bar";

// 시안 V8의 요소별 등장 애니메이션(@keyframes bUp/bPop/bFade/bScale/bLine/bBar)을 그대로 옮긴 것.
//  up   : 아래 16px에서 올라오며 나타남      pop  : 0.5배에서 1.12배로 튀었다가 제자리
//  fade : 투명→불투명                        scale: 0.92배에서 커지며 나타남
//  line : 세로로 그려짐(scaleY 0→1)         bar  : 진행 막대(width 5%→100%, 네이티브 드라이버 불가)
// 지연·길이는 ms. 슬라이드가 바뀌면 컴포넌트가 새로 마운트되므로 매번 처음부터 재생된다.
function Reveal({ delay = 0, duration = 500, kind = "up", style, children }: {
  delay?: number; duration?: number; kind?: RevealKind; style?: any; children?: React.ReactNode;
}) {
  const t = useRef(new Animated.Value(reduceMotionGlobal ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotionGlobal) { t.setValue(1); return; }
    const anim = Animated.timing(t, {
      toValue: 1, duration, delay,
      easing: kind === "pop" ? Easing.out(Easing.back(1.6)) : Easing.out(Easing.ease),
      useNativeDriver: kind !== "bar",
    });
    anim.start();
    return () => anim.stop();
  }, [t, delay, duration, kind]);

  if (kind === "bar") {
    return <Animated.View style={[style, { width: t.interpolate({ inputRange: [0, 1], outputRange: ["5%", "100%"] }) }]}>{children}</Animated.View>;
  }
  const opacity = kind === "line" ? 1 : t.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] });
  const transform =
    kind === "up" ? [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }]
    : kind === "pop" ? [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }]
    : kind === "scale" ? [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }]
    : kind === "line" ? [{ scaleY: t }]
    : [];
  return <Animated.View style={[style, { opacity, transform }]}>{children}</Animated.View>;
}

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
    } catch {
      // 온보딩 완료 표시는 다음 실행에 인트로를 다시 보일지만 정한다 — 진행은 막지 않되 알린다.
      Alert.alert("설정을 저장하지 못했어요", "다음에 앱을 열면 소개 화면이 한 번 더 보일 수 있어요.");
    }
    try {
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
      <Reveal delay={150} duration={600}><Text style={styles.brand1Big}>진짜 건강은</Text></Reveal>
      <Reveal delay={1000} duration={600}><Text style={styles.brand1Sub}>더 많이 먹는 것이 아니라,</Text></Reveal>
      <Reveal delay={1800} duration={650}>
        <Text style={styles.brand1Line}>
          <Text style={styles.bandGreen}>제대로 먹는 것</Text>에서{"\n"}시작됩니다.
        </Text>
      </Reveal>
      <Reveal delay={2600} kind="fade" style={styles.tapHintWrap}><Text style={styles.tapHint}>탭하여 계속</Text></Reveal>
    </Pressable>
  );
}

// ── 2. 브랜드 로고 ──────────────────────────────────────────────────────────
function Brand2({ onTap }: { onTap: () => void }) {
  return (
    <Pressable onPress={onTap} style={styles.brand2} accessibilityRole="button" accessibilityLabel="탭하여 계속">
      <Reveal delay={150} duration={550} kind="scale"><View style={styles.logoRing}><Logo size={104} /></View></Reveal>
      <Reveal delay={550} duration={600}><Text style={styles.brand2Title}>나에게 필요한 것만,{"\n"}<Text style={styles.accentBlue}>올바르게</Text></Text></Reveal>
      <Reveal delay={1100} duration={600}><Text style={styles.brand2Word}>모두의 복약</Text></Reveal>
      <Reveal delay={1800} kind="fade" style={styles.tapHintWrap}><Text style={styles.tapHint}>탭하여 계속</Text></Reveal>
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
        <Reveal delay={50}>
          <Text style={styles.onb1Title}>
            <Text style={styles.accentBlue}>영양제부터 처방약까지,</Text>{"\n"}
            몸에서는 <Text style={styles.bandGreen}>하나의 복용 조합</Text>입니다.
          </Text>
        </Reveal>
        <View style={styles.tiles}>
          {TILES.map(({ Icon, label, bg, color }, i) => (
            <Reveal key={label} delay={300 + i * 200} duration={400} style={styles.tile}>
              <View style={[styles.tileIcon, { backgroundColor: bg }]}><Icon size={30} strokeWidth={2.2} color={color} /></View>
              <Text style={styles.tileLabel}>{label}</Text>
            </Reveal>
          ))}
        </View>
        <Reveal delay={1000} duration={450} kind="fade" style={styles.joinLines}>
          <View style={styles.joinLine} /><View style={styles.joinLine} /><View style={styles.joinLine} />
        </Reveal>
        <View style={styles.pillRow}>
          <Reveal delay={1300} duration={450} kind="pop">
            <View style={styles.pill}>
              <Link2 size={18} color={colors.primaryBlue} />
              <Text style={styles.pillText}>내 몸속 하나의 복용 조합</Text>
            </View>
          </Reveal>
        </View>
        <Reveal delay={1900} duration={550}>
          <Text style={styles.onb1Body}>
            효과 있는 복용은 결국{"\n"}
            <Text style={styles.onb1BodyAccent}>나에게 필요한 것만 올바르게</Text>{"\n"}
            먹는 것에서 시작됩니다.
          </Text>
        </Reveal>
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
        <Reveal delay={150} duration={550}><Text style={styles.onb2Lead}>건강을 위해 챙겨 먹는 약과 영양제.</Text></Reveal>
        <Reveal delay={550} duration={600}>
        <Text style={styles.onb2Title}>
          <Text style={styles.bandOrange}>불필요한 영양제</Text>는{"\n"}
          <Text style={styles.accentOrange}>낭비</Text>가 되고,{"\n"}
          잘못된 복용 조합은{"\n"}
          <Text style={styles.accentRed}>건강을 해칠 수 있습니다.</Text>
        </Text>
        </Reveal>
      </ScrollView>
      <NextButton onPress={onNext} />
    </View>
  );
}

// ── 5. 1분 복용 점검 ────────────────────────────────────────────────────────
// 예시 카드의 4행 — 시안 V8 그대로(문구·색·등장 지연 2.25s/2.5s/2.75s/3.0s).
const EXAMPLE_ROWS: { Icon: typeof Link2; label: string; status: string; tone: "danger" | "ok" | "muted"; delay: number }[] = [
  { Icon: Link2, label: "상호작용", status: "함께 복용 시 주의", tone: "danger", delay: 2250 },
  { Icon: Layers, label: "중복 성분", status: "중복 성분 확인", tone: "danger", delay: 2500 },
  { Icon: Gauge, label: "과다 복용", status: "이상 없음", tone: "ok", delay: 2750 },
  { Icon: Info, label: "주의사항", status: "복용 방법 확인 필요", tone: "muted", delay: 3000 },
];

function Onboarding3({ onNext }: { onNext: () => void }) {
  return (
    <View style={styles.onb}>
      <ScrollView contentContainerStyle={styles.onbTop} showsVerticalScrollIndicator={false}>
        <Reveal delay={50}>
          <Text style={styles.onb3Title}>
            그래서,{"\n"}
            <Text style={styles.onb3Big}>1분 복용 점검</Text>으로{"\n"}
            불필요한 소비와{"\n"}
            위험한 복용 조합을{"\n"}
            한 번에 확인하세요.
          </Text>
        </Reveal>
        <Reveal delay={900} duration={550} style={styles.exampleCard}>
          <View style={styles.exampleHead}>
            <Text style={styles.exampleHeadText}>내 복용 정보 분석</Text>
            <Reveal delay={2100} duration={400} kind="pop"><View style={styles.checkDot}><Check size={13} strokeWidth={3} color={colors.white} /></View></Reveal>
          </View>
          <View style={styles.exampleBarTrack}><Reveal delay={1000} duration={1050} kind="bar" style={styles.exampleBarFill} /></View>
          <View style={styles.exampleDivider} />
          <View style={styles.exampleRows}>
            {EXAMPLE_ROWS.map(({ Icon, label, status, tone, delay }) => (
              <Reveal key={label} delay={delay} duration={450} style={styles.exampleRow}>
                <View style={styles.exampleIcon}><Icon size={18} color={colors.primaryBlue} /></View>
                <Text style={styles.exampleRowLabel}>{label}</Text>
                <View style={styles.exampleRowRight}>
                  {tone === "danger" ? <View style={styles.redDot} /> : null}
                  {tone === "ok" ? <Check size={16} strokeWidth={3} color={colors.successGreen} /> : null}
                  <Text style={[styles.exampleRowStatus, tone === "danger" && styles.statusDanger, tone === "ok" && styles.statusOk]}>{status}</Text>
                </View>
              </Reveal>
            ))}
          </View>
          <View style={styles.exampleDividerTight} />
          <View style={styles.exampleFoot}>
            <Reveal delay={3400} duration={450}><Text style={styles.exampleFootCount}>확인 필요 2건</Text></Reveal>
            <Reveal delay={3600} duration={400} kind="pop"><View style={styles.blueTag}><Text style={styles.blueTagText}>약사 확인 권장</Text></View></Reveal>
          </View>
        </Reveal>
      </ScrollView>
      <NextButton onPress={onNext} />
    </View>
  );
}

// ── 6. 약사 연결 (시안 V8 그대로 — 곧 만들 지역 약사 연결 기능의 예시 그림. 알약 태그는 눌리지 않는다) ──
function Onboarding4({ onNext }: { onNext: () => void }) {
  return (
    <View style={styles.onb}>
      <ScrollView contentContainerStyle={styles.onbTop} showsVerticalScrollIndicator={false}>
        <Reveal delay={100} duration={550}>
          <Text style={styles.onb4Title}>
            <Text style={styles.bandGreen}>약사가 설계한 기준</Text>으로{"\n"}
            점검하고, 필요한 순간에는{"\n"}
            <Text style={styles.accentGreen}>지역 약사</Text>와 연결됩니다.
          </Text>
        </Reveal>
        <View style={styles.flow}>
          <Reveal delay={800} duration={500} style={styles.compactCard}>
            <View style={styles.compactIcon}><ClipboardList size={20} color={colors.primaryBlue} /></View>
            <View style={styles.compactCopy}>
              <Text style={styles.compactTitle}>복용 점검 결과</Text>
              <Text style={styles.compactSub}>상호작용 · 중복 성분</Text>
            </View>
            <View style={styles.redTag}><Text style={styles.redTagText}>확인 필요 2건</Text></View>
          </Reveal>
          <Reveal delay={1350} duration={350} kind="line" style={styles.connector} />
          <Reveal delay={1550} duration={450} style={styles.consentRow}>
            <View style={styles.consentRing}>
              <Reveal delay={2000} duration={450} kind="pop" style={styles.consentCheck}><Check size={14} strokeWidth={3} color={colors.white} /></Reveal>
            </View>
            <Text style={styles.consentText}>내 복용 정보 공유 동의</Text>
          </Reveal>
          <Reveal delay={2350} duration={350} kind="line" style={styles.connector} />
          <Reveal delay={2600} duration={500} style={styles.pharmacyCard}>
            <View style={styles.pharmacyIcon}><Plus size={22} strokeWidth={4} color={colors.successGreen} /></View>
            <View style={styles.compactCopy}>
              <Text style={styles.compactTitle}>봄뜰약국 · 이수진 약사</Text>
              <Text style={styles.compactSub}>우리동네 지역 약국</Text>
            </View>
            <Reveal delay={3000} duration={400} kind="pop"><View style={styles.greenTag}><Text style={styles.greenTagText}>상담 연결</Text></View></Reveal>
          </Reveal>
          <Reveal delay={3300} duration={500}><Text style={styles.flowCaption}>복용 정보는 사용자 동의 후 공유됩니다.</Text></Reveal>
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
        <Reveal delay={150} duration={550} kind="scale"><View style={styles.logoRingSmall}><Logo size={56} /></View></Reveal>
        <Reveal delay={750} duration={600}>
          <Text style={styles.ctaLead}>불필요한 소비를 줄이고,</Text>
          <Text style={styles.ctaTitle}>
            <Text style={styles.bandGreen}>건강해지는 복용</Text>의{"\n"}첫걸음, 지금 시작해보세요.
          </Text>
        </Reveal>
        <Reveal delay={1000} duration={550}><Text style={styles.ctaSub}>1분이면 충분합니다.</Text></Reveal>
        <View style={styles.checkList}>
          {CHECKS.map((t, i) => (
            <Reveal key={t} delay={1300 + i * 200} duration={500} style={styles.checkRow}>
              <View style={styles.checkDot}><Check size={13} strokeWidth={3} color={colors.white} /></View>
              <Text style={styles.checkText}>{t}</Text>
            </Reveal>
          ))}
        </View>
      </ScrollView>
      <Reveal delay={1600} duration={550}>
        <Pressable onPress={onPrimary} accessibilityRole="button" accessibilityLabel="내 복용 1분 점검하기"
          style={({ pressed }) => [styles.ctaPrimary, pressed && styles.pressed]}>
          <Text style={styles.ctaPrimaryText}>내 복용 1분 점검하기</Text>
        </Pressable>
      </Reveal>
      <Reveal delay={1750} duration={550}>
        <Pressable onPress={onSecondary} accessibilityRole="button" accessibilityLabel="복용 알람부터 시작하기"
          style={({ pressed }) => [styles.ctaSecondary, pressed && { opacity: 0.7 }]}>
          <Text style={styles.ctaSecondaryText}>복용 알람부터 시작하기</Text>
        </Pressable>
      </Reveal>
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
  skipBtn: { minWidth: 84, minHeight: minTouch, alignItems: "flex-end", justifyContent: "center", paddingHorizontal: 12 },
  skipText: { fontSize: fontSizes.body, fontWeight: "600", color: colors.textSecondary },

  // 공통 서식
  accentBlue: { color: colors.primaryBlue },
  accentGreen: { color: colors.successGreen },
  accentOrange: { color: colors.warningOrange },
  accentRed: { color: colors.dangerRed },
  bandGreen: { backgroundColor: colors.successSoft },
  bandOrange: { backgroundColor: colors.warningSoft },
  tapHintWrap: { position: "absolute", bottom: spacing.lg, alignSelf: "center" },
  tapHint: { fontSize: fontSizes.body, fontWeight: "600", color: colors.textSecondary },
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
  tileLabel: { fontSize: 18, fontWeight: "700", color: colors.textSecondary },
  joinLines: { flexDirection: "row", justifyContent: "space-evenly", height: 34, paddingHorizontal: spacing.xl },
  joinLine: { width: 1.5, height: "100%", backgroundColor: colors.border },
  pillRow: { alignItems: "center" },
  pill: { height: 44, paddingHorizontal: 17, borderRadius: 22, backgroundColor: colors.primarySoft, borderWidth: 1.5, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 8 },
  pillText: { fontSize: 18, fontWeight: "800", color: colors.primaryBlue, letterSpacing: -0.3 },
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
  exampleHeadText: { fontSize: 18, fontWeight: "700", color: colors.textSecondary },
  checkDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.successGreen, alignItems: "center", justifyContent: "center" },
  exampleBarTrack: { marginTop: 10, height: 8, borderRadius: 4, backgroundColor: colors.canvasMuted, overflow: "hidden" },
  exampleBarFill: { height: 8, borderRadius: 4, backgroundColor: colors.primaryBlue },
  exampleDivider: { height: 1, backgroundColor: colors.canvasMuted, marginTop: spacing.md },
  exampleRows: { marginTop: 4 },
  exampleRow: { height: 52, flexDirection: "row", alignItems: "center", gap: 12 },
  exampleIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  exampleRowLabel: { fontSize: fontSizes.body, fontWeight: "700", color: colors.primaryNavy },
  exampleRowRight: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 6 },
  redDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.dangerRed },
  exampleRowStatus: { fontSize: 18, fontWeight: "700", color: colors.textSecondary },
  statusDanger: { color: colors.dangerRed },
  statusOk: { color: colors.successGreen },
  exampleDividerTight: { height: 1, backgroundColor: colors.canvasMuted, marginTop: 4 },
  exampleFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  exampleFootCount: { fontSize: 18, fontWeight: "800", color: colors.dangerRed },
  blueTag: { height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  blueTagText: { fontSize: 18, fontWeight: "700", color: colors.primaryBlue },

  // 6
  onb4Title: { fontSize: 27, lineHeight: 40, fontWeight: "800", color: colors.primaryNavy, letterSpacing: -0.6 },
  flow: { marginTop: spacing.lg },
  compactCard: { backgroundColor: colors.white, borderRadius: 16, paddingVertical: 14, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: 12, ...shadows.card },
  compactIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  compactCopy: { flex: 1 },
  compactTitle: { fontSize: 18, fontWeight: "700", color: colors.primaryNavy },
  compactSub: { marginTop: 1, fontSize: 18, fontWeight: "600", color: colors.textSecondary },
  redTag: { height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: colors.dangerSoft, alignItems: "center", justifyContent: "center" },
  redTagText: { fontSize: 18, fontWeight: "700", color: colors.dangerRed },
  connector: { width: 2, height: 20, backgroundColor: colors.border, alignSelf: "center", marginVertical: 4 },
  consentRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  consentRing: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.canvasMuted },
  consentCheck: { position: "absolute", top: 0, left: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.successGreen, alignItems: "center", justifyContent: "center" },
  consentText: { fontSize: 18, fontWeight: "700", color: colors.primaryNavy },
  pharmacyCard: { backgroundColor: colors.white, borderRadius: 16, paddingVertical: 14, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderColor: colors.successSoft },
  pharmacyIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.successSoft, alignItems: "center", justifyContent: "center" },
  greenTag: { height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: colors.successSoft, alignItems: "center", justifyContent: "center" },
  greenTagText: { fontSize: 18, fontWeight: "700", color: colors.successGreen },
  flowCaption: { marginTop: spacing.md, textAlign: "center", fontSize: 18, fontWeight: "600", color: colors.textSecondary },

  // 7
  ctaCenter: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingBottom: spacing.md },
  logoRingSmall: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  ctaLead: { marginTop: spacing.lg, textAlign: "center", fontSize: 20, fontWeight: "600", color: colors.textSecondary, letterSpacing: -0.4 },
  ctaTitle: { marginTop: 10, textAlign: "center", fontSize: 30, lineHeight: 43, fontWeight: "800", color: colors.primaryNavy, letterSpacing: -0.9 },
  ctaSub: { marginTop: 12, textAlign: "center", fontSize: fontSizes.body, fontWeight: "600", color: colors.textSecondary, letterSpacing: -0.3 },
  checkList: { marginTop: 20, gap: 9, alignSelf: "stretch" },
  checkRow: { minHeight: minTouch, paddingHorizontal: 20, borderRadius: 24, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.successSoft, flexDirection: "row", alignItems: "center", gap: 9 },
  checkText: { fontSize: fontSizes.body, fontWeight: "700", color: colors.primaryNavy, letterSpacing: -0.3 },
  ctaPrimary: { height: 62, borderRadius: 31, backgroundColor: colors.primaryBlue, alignItems: "center", justifyContent: "center", ...shadows.floating },
  ctaPrimaryText: { color: colors.white, fontSize: 21, fontWeight: "800", letterSpacing: -0.3 },
  ctaSecondary: { minHeight: minTouch, marginTop: spacing.sm, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.primarySoft },
  ctaSecondaryText: { color: colors.primaryNavy, fontSize: fontSizes.emphasis, fontWeight: "700" },
});

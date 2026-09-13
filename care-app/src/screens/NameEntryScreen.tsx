import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert, ScrollView, Pressable, KeyboardAvoidingView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Eye, MessageCircle, ClipboardCheck } from "lucide-react-native";
import { Logo } from "../components/Logo";
import { BigButton } from "../components/BigButton";
import { setPatient, setPatientName } from "../lib/storage";
import { supabase } from "../lib/supabase";
import { enterDemo } from "../lib/demo";
import { restoreWithKakao } from "../lib/kakaoAccount";
import { loadDraft } from "../lib/quickCheckDraft";
import { colors, fontSizes, spacing, radii, minTouch, shadows } from "../theme/tokens";

// 로고 이미지는 여백이 거의 없는 정사각형이라 카드 안쪽에 패딩을 준다.
const LOGO_CARD = 104;
const LOGO_SIZE = 80;

// 이름 한 칸 — 점검 없이 건너뛴 사용자(Case C·D)가 여기서 시작한다.
// 회의 2026-09-10(B안): 별도 가입 화면은 없다. 이름만 받고 그 자리에서 환자 레코드를
// 만든 뒤 바로 홈으로 간다. 성별·생년월일은 받지 않는다(결정 8).
// 카카오는 "가입"이 아니라 "예전 정보 불러오기"(기기 이전) 링크로만 있다.
export function NameEntryScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [hasUnfinishedDraft, setHasUnfinishedDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [kakaoBusy, setKakaoBusy] = useState(false);

  // 점검을 고르다 말고 앱이 꺼진 경우 — 되돌아갈 길을 준다.
  useEffect(() => {
    let alive = true;
    void loadDraft().then((d) => { if (alive) setHasUnfinishedDraft(!!d && d.findings === null); });
    return () => { alive = false; };
  }, []);

  const canStart = name.trim().length > 0;

  async function start() {
    if (saving || !canStart) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from("patients")
        .insert({ name: name.trim() }).select("id").single();
      if (error || !data) {
        Alert.alert("시작하지 못했어요", error?.message ?? "인터넷 연결을 확인하고 다시 시도해 주세요.");
        setSaving(false);
        return;
      }
      await setPatient(data.id);
      await setPatientName(name.trim());
      nav.reset({ index: 0, routes: [{ name: "Tabs" }] });
    } catch (e) {
      Alert.alert("시작하지 못했어요", (e as Error)?.message ?? "인터넷 연결을 확인하고 다시 시도해 주세요.");
      setSaving(false);
    }
  }

  // 휴대폰을 바꿨을 때 — 예전에 카카오와 연결해 둔 정보를 되찾는다. 새로 만들지는 않는다.
  async function restore() {
    if (kakaoBusy) return;
    setKakaoBusy(true);
    try {
      const r = await restoreWithKakao();
      if (r.ok) { nav.reset({ index: 0, routes: [{ name: "Tabs" }] }); return; }
      if (!r.canceled) Alert.alert("카카오로 불러오기", r.message);
    } catch {
      Alert.alert("카카오로 불러오기", "인터넷 연결을 확인하고 다시 시도해 주세요.");
    }
    setKakaoBusy(false);
  }

  async function startDemo() {
    if (demoLoading) return;
    setDemoLoading(true);
    try {
      await enterDemo();
      nav.reset({ index: 0, routes: [{ name: "Tabs" }] });
    } catch {
      Alert.alert("데모를 불러오지 못했어요", "인터넷 연결을 확인해 주세요.");
      setDemoLoading(false);
    }
  }

  return (
    // 상단 인셋은 ScrollView 바깥에. contentContainerStyle에 주면 스크롤할 때
    // 내용이 상태바 밑으로 올라와 겹친다.
    // Expo 54는 Android도 edge-to-edge라 키보드가 떠도 창이 안 줄어든다 — 두 플랫폼 모두 padding으로 밀어 올린다.
    <KeyboardAvoidingView style={[styles.screen, { paddingTop: insets.top }]} behavior="padding">
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.c, { paddingTop: spacing.xl }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {hasUnfinishedDraft ? (
        <Pressable onPress={() => nav.navigate("QuickCheckInput")} style={({ pressed }) => [styles.draftBanner, pressed && { opacity: 0.85 }]} accessibilityRole="button">
          <ClipboardCheck size={22} color={colors.primaryNavy} />
          <Text style={styles.draftText}>고르다 만 1분 점검이 있어요 · 이어서 하기</Text>
        </Pressable>
      ) : null}

      {/* Brand — 스플래시와 같은 로고 이미지를 쓴다(아이콘 대체) */}
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Logo size={LOGO_SIZE} />
        </View>
        <Text style={styles.title}>모두의 복약</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>어떻게 불러드릴까요?</Text>
        <Text style={styles.sub}>결과를 알려드릴 때 사용해요</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="홍길동"
          placeholderTextColor={colors.textSecondary}
          maxLength={20}
          returnKeyType="done"
          onSubmitEditing={() => void start()}
          accessibilityLabel="이름"
        />
        <Text style={styles.hint}>비밀번호도 이메일도 없어요. 이름만 있으면 바로 시작할 수 있어요.</Text>
      </View>

      <BigButton label={saving ? "시작하는 중…" : "시작하기"} onPress={() => void start()} disabled={!canStart || saving} showArrow />

      {/* 보조 링크 — 기기 이전(카카오 복구)과 데모. 주 버튼보다 조용하게. */}
      <Pressable
        onPress={() => void restore()}
        disabled={kakaoBusy}
        accessibilityRole="button"
        style={({ pressed }) => [styles.linkBtn, (pressed || kakaoBusy) && { opacity: 0.6 }]}
      >
        <MessageCircle size={20} color={colors.kakaoInk} fill={colors.kakao} />
        <Text style={styles.linkText}>{kakaoBusy ? "불러오는 중…" : "이미 쓰던 계정이 있어요 · 카카오로 불러오기"}</Text>
      </Pressable>
      <Pressable
        onPress={() => void startDemo()}
        disabled={demoLoading}
        accessibilityRole="button"
        style={({ pressed }) => [styles.linkBtn, (pressed || demoLoading) && { opacity: 0.6 }]}
      >
        <Eye size={18} color={colors.textSecondary} />
        <Text style={styles.linkText}>{demoLoading ? "데모 불러오는 중…" : "둘러보기 (데모)"}</Text>
      </Pressable>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flex: 1 },
  c: { padding: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1, justifyContent: "center" },
  draftBanner: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.sunshineSoft, borderRadius: radii.card, padding: spacing.md, marginBottom: spacing.lg,
  },
  draftText: { flex: 1, fontSize: fontSizes.body, lineHeight: 26, fontWeight: "700", color: colors.primaryNavy },
  brand: { alignItems: "center", marginBottom: spacing.xl },
  logo: {
    width: LOGO_CARD, height: LOGO_CARD, borderRadius: radii.hero, backgroundColor: colors.surfaceRaised,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.md,
    ...shadows.card,
  },
  title: { fontSize: 40, fontWeight: "800", color: colors.primaryNavy, textAlign: "center" },
  card: {
    backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.lg, marginBottom: spacing.lg, ...shadows.card,
  },
  heading: { fontSize: fontSizes.title, fontWeight: "800", color: colors.primaryNavy, marginBottom: spacing.xs },
  sub: { fontSize: fontSizes.body, color: colors.textSecondary, marginBottom: spacing.md },
  input: {
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1.5,
    borderRadius: radii.button, fontSize: fontSizes.emphasis, padding: 14, minHeight: minTouch, color: colors.text,
  },
  hint: { fontSize: fontSizes.body, lineHeight: 26, color: colors.textSecondary, marginTop: spacing.md },
  linkBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    minHeight: minTouch, paddingHorizontal: spacing.md,
  },
  linkText: { fontSize: fontSizes.body, color: colors.textSecondary, fontWeight: "600", flexShrink: 1, textAlign: "center" },
});

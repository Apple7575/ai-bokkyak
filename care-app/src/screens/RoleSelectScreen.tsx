import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert, ScrollView, Pressable, Keyboard } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { User, Eye, MessageCircle, ClipboardCheck } from "lucide-react-native";
import { Logo } from "../components/Logo";
import { setPatient } from "../lib/storage";
import { supabase } from "../lib/supabase";
import { enterDemo } from "../lib/demo";
import { signInWithKakao } from "../lib/kakaoAuth";
import { sanitizeBirthPart, birthError, buildBirthDate } from "../lib/birthInput";
import { loadDraft, commitQuickCheckDraft } from "../lib/quickCheckDraft";
import { checkedCount } from "../lib/quickCheck";
import { colors, fontSizes, spacing, radii, minTouch, shadows } from "../theme/tokens";

// 로고 이미지는 여백이 거의 없는 정사각형이라 카드 안쪽에 패딩을 준다.
const LOGO_CARD = 104;
const LOGO_SIZE = 80;

// 가입 화면 — 이름·성별·생년월일만 받는다.
// 복약 정보는 가입 직후 음성 안내(VoiceGuide)에서 화면 터치로 받는다.
export function RoleSelectScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  // "1분 복용 점검"을 마치고 온 경우 — 가입하면 초안이 서버로 옮겨지고 결과 전체가 열린다.
  const [draftState, setDraftState] = useState<"none" | "unfinished" | "ready">("none");
  const hasDraft = draftState === "ready";
  const kakaoAutoStarted = useRef<number | null>(null);
  // 생년월일 자동 이동 (피드백 2026-09-03): 년 4자리를 채우면 월로, 월이 확정되면 일로.
  const birthMRef = useRef<TextInput>(null);
  const birthDRef = useRef<TextInput>(null);
  const [gender, setGender] = useState<"남" | "여" | null>(null);
  const [saving, setSaving] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [kakaoBusy, setKakaoBusy] = useState(false);
  // 생년월일은 직접 입력으로 받는다(디자인 시안 결정).
  const [birthY, setBirthY] = useState("");
  const [birthM, setBirthM] = useState("");
  const [birthD, setBirthD] = useState("");

  // 화면에 바로 보여줄 생년월일 오류(없으면 null).
  const birthMsg = birthError(birthY, birthM, birthD);

  useEffect(() => {
    let alive = true;
    void loadDraft().then((d) => { if (alive) setDraftState(!d ? "none" : d.findings ? "ready" : "unfinished"); });
    return () => { alive = false; };
  }, []);

  // 결과 화면의 "카카오로 계속하기"에서 왔으면 카카오 로그인을 바로 연다.
  // 이 화면은 결과 화면 아래에 이미 있어서 navigate 시 리마운트되지 않고 params만 바뀐다 —
  // 그래서 params(kakaoAt)에 반응하고, 같은 요청을 두 번 열지 않게 시각으로 구분한다.
  const kakaoAt: number | undefined = route.params?.kakaoAt;
  useEffect(() => {
    if (route.params?.from === "quickCheck" && route.params?.kakao && kakaoAt && kakaoAutoStarted.current !== kakaoAt) {
      kakaoAutoStarted.current = kakaoAt;
      void startWithKakao();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kakaoAt]);

  // 가입/로그인이 끝난 뒤 — 점검 초안이 있으면 서버에 옮기고 결과 전체를 보여 준다.
  // 없으면 평소대로. 저장 실패는 알리되 흐름을 막지 않는다(초안은 남아 다음에 다시 시도).
  async function finish(patientId: string, fallback: { name: string }[]) {
    try {
      const committed = await commitQuickCheckDraft(patientId);
      if (committed?.findings) {
        nav.reset({ index: 1, routes: [
          { name: "Tabs" },
          { name: "QuickCheckResult", params: { unlocked: true, findings: committed.findings, unmatched: committed.unmatched, checked: checkedCount(committed), durUnavailable: committed.durUnavailable === true } },
        ] });
        return;
      }
    } catch {
      // 초안은 기기에 남는다. 홈 화면이 뜰 때마다 다시 저장을 시도한다(HomeScreen).
      Alert.alert("점검 결과를 저장하지 못했어요", "홈 화면에서 자동으로 다시 시도해요.");
    }
    nav.reset({ index: fallback.length - 1, routes: fallback });
  }

  // 입력한 생년월일을 검증해 "YYYY-MM-DD"로. 비어 있으면 null(선택 입력).
  // 적었는데 형식이 틀리면 undefined를 돌려 저장을 막는다 — 조용히 버리면
  // 어르신은 입력했다고 생각하는데 저장이 안 된 상태가 된다.
  function resolveBirth(): string | null | undefined {
    const y = birthY.trim(), m = birthM.trim(), d = birthD.trim();
    if (!y && !m && !d) return null;
    const built = buildBirthDate(Number(y), Number(m), Number(d));
    return built ?? undefined;
  }

  async function startAsPatient() {
    if (saving) return;
    if (!name.trim()) { Alert.alert("이름을 입력해 주세요"); return; }
    const birth = resolveBirth();
    if (birth === undefined) {
      Alert.alert("생년월일을 확인해 주세요", birthMsg ?? "예: 1954년 3월 1일");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.from("patients")
        .insert({
          name: name.trim(),
          gender: gender ?? null,
          birth_date: birth,
        }).select().single();
      if (error || !data) { Alert.alert("등록 실패", error?.message ?? ""); setSaving(false); return; }
      await setPatient(data.id);
      // 가입 직후 음성 가이드로 복용 알람을 설정한다(사전 녹음 인출 + 화면 터치).
      await finish(data.id, [{ name: "Tabs" }, { name: "VoiceGuide" }]);
    } catch {
      Alert.alert("등록 실패", "인터넷 연결을 확인해 주세요.");
      setSaving(false);
    }
  }
  // 카카오로 시작하기 — 기존 방식을 대체하지 않고 나란히 둔다.
  // 이미 이 계정으로 만든 약장이 있으면 그대로 되살리고(기기 교체 대응),
  // 처음이면 카카오 닉네임을 이름 기본값으로 채워 가입시킨다.
  async function startWithKakao() {
    if (kakaoBusy || saving) return;
    setKakaoBusy(true);
    try {
      const r = await signInWithKakao();
      if (!r.ok) {
        if (!r.canceled) Alert.alert("카카오 로그인", r.message);
        setKakaoBusy(false);
        return;
      }

      // 이 계정으로 만든 환자 정보가 이미 있나?
      const { data: found, error: findErr } = await supabase
        .from("patients").select("*").eq("kakao_id", r.kakaoId).maybeSingle();
      if (findErr) throw findErr;

      if (found) {
        // 기기를 바꿔도 약과 기록이 따라온다.
        await setPatient(found.id);
        await finish(found.id, [{ name: "Tabs" }]);
        return;
      }

      // 처음이면 새로 만든다. 이름은 화면에 적으신 값 > 카카오 닉네임 순으로 쓴다.
      const finalName = name.trim() || r.nickname || "";
      if (!finalName) {
        Alert.alert("이름을 입력해 주세요", "카카오에서 이름을 받지 못했어요. 직접 적어 주세요.");
        setKakaoBusy(false);
        return;
      }
      const birth = resolveBirth();
      if (birth === undefined) {
        Alert.alert("생년월일을 확인해 주세요", "예: 1954년 3월 1일");
        setKakaoBusy(false);
        return;
      }
      const { data, error } = await supabase.from("patients")
        .insert({
          name: finalName,
          gender: gender ?? null, kakao_id: r.kakaoId, birth_date: birth,
        }).select().single();
      if (error || !data) throw error ?? new Error("insert 실패");
      await setPatient(data.id);
      await finish(data.id, [{ name: "Tabs" }, { name: "VoiceGuide" }]);
    } catch {
      Alert.alert("가입에 실패했어요", "인터넷 연결을 확인하고 다시 시도해 주세요.");
      setKakaoBusy(false);
    }
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
    <View style={[styles.screen, { paddingTop: insets.top }]}>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.c, { paddingTop: spacing.xl }]}
    >
      {/* 점검 결과 대기 배너 — 가입하면 바로 열린다는 걸 알린다 */}
      {hasDraft ? (
        <View style={styles.draftBanner}>
          <ClipboardCheck size={22} color={colors.primaryNavy} />
          <Text style={styles.draftText}>점검 결과가 저장을 기다리고 있어요 · 가입하면 바로 볼 수 있어요</Text>
        </View>
      ) : null}
      {/* 점검을 고르다 말고 앱이 꺼진 경우 — 되돌아갈 길을 준다 */}
      {draftState === "unfinished" ? (
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

      {/* Profile input card */}
      <View style={styles.card}>
        <Text style={styles.label}>이름</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="예: 김복약" placeholderTextColor={colors.textSecondary} />

        <Text style={[styles.label, { marginTop: spacing.lg }]}>성별 (선택)</Text>
        <View style={styles.genderRow}>
          <Pressable
            onPress={() => setGender(gender === "남" ? null : "남")}
            style={[styles.genderChip, gender === "남" && styles.genderChipOn]}
          >
            <Text style={[styles.genderText, gender === "남" && styles.genderTextOn]}>남</Text>
          </Pressable>
          <Pressable
            onPress={() => setGender(gender === "여" ? null : "여")}
            style={[styles.genderChip, gender === "여" && styles.genderChipOn]}
          >
            <Text style={[styles.genderText, gender === "여" && styles.genderTextOn]}>여</Text>
          </Pressable>
        </View>

        <Text style={[styles.label, { marginTop: spacing.lg }]}>생년월일</Text>
        <View style={styles.birthRow}>
          <TextInput
            style={[styles.input, styles.birthInput, { flex: 1.5 }, birthMsg && styles.inputBad]}
            value={birthY}
            onChangeText={(t) => {
              const v = sanitizeBirthPart(t, "year", birthY);
              setBirthY(v);
              if (v.length === 4) birthMRef.current?.focus();
            }}
            placeholder="1954" placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad" maxLength={4}
          />
          <Text style={styles.birthUnit}>년</Text>
          <TextInput
            ref={birthMRef}
            style={[styles.input, styles.birthInput, birthMsg && styles.inputBad]}
            value={birthM}
            onChangeText={(t) => {
              const v = sanitizeBirthPart(t, "month", birthM);
              setBirthM(v);
              // 2~9는 한 자리로 월이 확정된다 (10·11·12만 두 자리)
              if (v.length === 2 || (v.length === 1 && Number(v) >= 2)) birthDRef.current?.focus();
            }}
            placeholder="3" placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad" maxLength={2}
          />
          <Text style={styles.birthUnit}>월</Text>
          <TextInput
            ref={birthDRef}
            style={[styles.input, styles.birthInput, birthMsg && styles.inputBad]}
            value={birthD}
            onChangeText={(t) => {
              const v = sanitizeBirthPart(t, "day", birthD);
              setBirthD(v);
              // 4~9는 한 자리로 일이 확정된다 — 키보드를 내려 가입 버튼이 보이게
              if (v.length === 2 || (v.length === 1 && Number(v) >= 4)) Keyboard.dismiss();
            }}
            placeholder="1" placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad" maxLength={2}
          />
          <Text style={styles.birthUnit}>일</Text>
        </View>
        {/* 다 적고 [가입]을 누른 뒤에야 알려주면 어디가 틀렸는지 알기 어렵다.
            13월처럼 칸 하나로 판정되는 값은 애초에 입력이 안 되고(sanitizeBirthPart),
            2월 30일처럼 합쳐 봐야 아는 값은 여기서 바로 이유를 보여준다. */}
        {birthMsg ? <Text style={styles.birthError}>{birthMsg}</Text> : null}
      </View>

      {/* 카카오로 시작하기 — 기기를 바꿔도 약이 따라오는 유일한 경로라 위에 둔다 */}
      <Pressable
        onPress={startWithKakao}
        disabled={kakaoBusy}
        style={({ pressed }) => [styles.kakaoBtn, (pressed || kakaoBusy) && { opacity: 0.85 }]}
      >
        <View style={styles.kakaoIcon}>
          <MessageCircle size={22} color={colors.kakaoInk} fill={colors.kakaoInk} />
        </View>
        <Text style={styles.kakaoText}>
          {kakaoBusy ? "카카오 로그인 중…" : "카카오로 시작하기"}
        </Text>
      </Pressable>

      {/* Sign up */}
      <Pressable
        onPress={startAsPatient}
        disabled={saving}
        style={({ pressed }) => [styles.choice, styles.choicePrimary, (pressed || saving) && { opacity: 0.9 }]}
      >
        <View style={[styles.choiceIcon, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
          <User size={24} color="#fff" />
        </View>
        <Text style={[styles.choiceText, { color: "#fff" }]}>{saving ? "가입 중…" : "가입하고 시작하기"}</Text>
      </Pressable>

      {/* Demo entry — 보조적으로, 실사용자가 헷갈리지 않게 */}
      <Pressable
        onPress={startDemo}
        disabled={demoLoading}
        style={({ pressed }) => [styles.demoBtn, (pressed || demoLoading) && { opacity: 0.6 }]}
      >
        <Eye size={18} color={colors.textSecondary} />
        <Text style={styles.demoText}>{demoLoading ? "데모 불러오는 중…" : "둘러보기 (데모)"}</Text>
      </Pressable>
    </ScrollView>
    </View>
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
  label: { fontSize: fontSizes.body, color: colors.text, fontWeight: "700", marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1.5,
    borderRadius: radii.button, fontSize: fontSizes.body, padding: 14,
  },
  genderRow: { flexDirection: "row", gap: spacing.md },
  birthRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  birthInput: { flex: 1, minWidth: 0, textAlign: "center", paddingHorizontal: 0 },
  birthUnit: { fontSize: fontSizes.body, fontWeight: "600", color: colors.textSecondary },
  inputBad: { borderColor: colors.dangerRed, borderWidth: 2 },
  birthError: { fontSize: fontSizes.body, color: colors.dangerRed, marginTop: spacing.sm, lineHeight: 25 },
  genderChip: {
    flex: 1, minHeight: minTouch, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1.5,
    borderRadius: radii.pill,
  },
  genderChipOn: { backgroundColor: colors.primaryBlue, borderColor: colors.primaryBlue },
  genderText: { fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.text },
  genderTextOn: { color: colors.white },
  choice: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    minHeight: 64, borderRadius: radii.pill,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, marginVertical: 6,
  },
  choicePrimary: {
    backgroundColor: colors.primaryBlue,
    ...shadows.floating,
  },
  choiceIcon: { width: 44, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  choiceText: { fontSize: fontSizes.emphasis, fontWeight: "700", flexShrink: 1 },
  demoBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    marginTop: spacing.md, paddingVertical: spacing.sm,
  },
  demoText: { fontSize: fontSizes.body, color: colors.textSecondary, fontWeight: "600" },
  kakaoBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    minHeight: minTouch, borderRadius: radii.pill, backgroundColor: colors.kakao,
    // 아래 설명 문구를 뺐으므로(QA 2026-08-20) 다음 버튼과의 간격을 여기서 준다.
    marginBottom: spacing.md,
    shadowColor: colors.kakaoShadow, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 10, elevation: 3,
  },
  kakaoIcon: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  kakaoText: { fontSize: fontSizes.emphasis, fontWeight: "800", color: colors.kakaoInk },
});

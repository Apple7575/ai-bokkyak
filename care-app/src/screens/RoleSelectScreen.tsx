import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert, ScrollView, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pill, User, Eye } from "lucide-react-native";
import { setRole, setPatient } from "../lib/storage";
import { supabase } from "../lib/supabase";
import { enterDemo } from "../lib/demo";
import { colors, fontSizes, spacing, radii, minTouch } from "../theme/tokens";

function makeCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = ""; for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

// 가입 화면 — 이름·성별만 받는다. 생년월일·복약 정보 등 나머지는 가입 직후
// AI 건강전화(음성)로 여쭤보고 받는다(어르신이 직접 입력하기 어렵기 때문).
export function RoleSelectScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"남" | "여" | null>(null);
  const [saving, setSaving] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  async function startAsPatient() {
    if (saving) return;
    if (!name.trim()) { Alert.alert("이름을 입력해 주세요"); return; }
    setSaving(true);
    try {
      const code = makeCode();
      const { data, error } = await supabase.from("patients")
        .insert({
          name: name.trim(),
          patient_code: code,
          gender: gender ?? null,
        }).select().single();
      if (error || !data) { Alert.alert("등록 실패", error?.message ?? ""); setSaving(false); return; }
      await setPatient(data.id, data.patient_code);
      await setRole("patient");
      // 가입 직후 AI 건강전화로 생년월일·복약 정보를 음성으로 받는다(setup 모드).
      nav.reset({ index: 0, routes: [{ name: "Tabs" }, { name: "Call", params: { setup: true } }] });
    } catch {
      Alert.alert("등록 실패", "인터넷 연결을 확인해 주세요.");
      setSaving(false);
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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.c, { paddingTop: insets.top + spacing.xl }]}
    >
      {/* Brand */}
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Pill size={40} color={colors.primaryBlue} strokeWidth={1.8} />
        </View>
        <Text style={styles.title}>모두의 복약</Text>
        <Text style={styles.sub}>이름과 성별만 알려주세요</Text>
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

        <Text style={styles.hint}>
          생년월일과 드시는 약은 가입 후 AI 건강전화로 편하게 말씀해 주시면 돼요.
        </Text>
      </View>

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
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.lightBlueBg },
  c: { padding: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1, justifyContent: "center" },
  brand: { alignItems: "center", marginBottom: spacing.xl },
  logo: {
    width: 88, height: 88, borderRadius: 26, backgroundColor: colors.cardBg,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.md,
    shadowColor: colors.primaryNavy, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 2,
  },
  title: { fontSize: 40, fontWeight: "800", color: colors.primaryNavy, textAlign: "center" },
  sub: { fontSize: fontSizes.emphasis, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm },
  card: {
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.lg, marginBottom: spacing.lg,
  },
  label: { fontSize: fontSizes.body, color: colors.text, fontWeight: "700", marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.lightBlueBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.button, fontSize: fontSizes.body, padding: 14,
  },
  genderRow: { flexDirection: "row", gap: spacing.md },
  genderChip: {
    flex: 1, minHeight: minTouch, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.lightBlueBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.button,
  },
  genderChipOn: { backgroundColor: colors.primaryBlue, borderColor: colors.primaryBlue },
  genderText: { fontSize: fontSizes.emphasis, fontWeight: "700", color: colors.text },
  genderTextOn: { color: "#fff" },
  hint: {
    fontSize: fontSizes.body, color: colors.textSecondary, lineHeight: 24,
    marginTop: spacing.lg,
  },
  choice: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    minHeight: minTouch, borderRadius: radii.button,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, marginVertical: 6,
  },
  choicePrimary: {
    backgroundColor: colors.primaryBlue,
    shadowColor: colors.primaryBlue, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 14, elevation: 4,
  },
  choiceIcon: { width: 44, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  choiceText: { fontSize: fontSizes.emphasis, fontWeight: "700", flexShrink: 1 },
  demoBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    marginTop: spacing.md, paddingVertical: spacing.sm,
  },
  demoText: { fontSize: fontSizes.body, color: colors.textSecondary, fontWeight: "600" },
});

import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert, ScrollView, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pill, User, Users } from "lucide-react-native";
import { setRole, setPatient } from "../lib/storage";
import { supabase } from "../lib/supabase";
import { colors, fontSizes, spacing, radii, minTouch } from "../theme/tokens";

function makeCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = ""; for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

export function RoleSelectScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"남" | "여" | null>(null);
  const [birthDate, setBirthDate] = useState("");
  const [region, setRegion] = useState("");

  async function startAsPatient() {
    if (!name.trim()) { Alert.alert("이름을 입력해 주세요"); return; }
    const code = makeCode();
    const { data, error } = await supabase.from("patients")
      .insert({
        name: name.trim(),
        patient_code: code,
        gender: gender ?? null,
        birth_date: birthDate.trim() || null,
        region: region.trim() || null,
      }).select().single();
    if (error || !data) { Alert.alert("등록 실패", error?.message ?? ""); return; }
    await setPatient(data.id, data.patient_code);
    await setRole("patient");
    nav.reset({ index: 0, routes: [{ name: "Tabs" }] });
  }
  async function startAsGuardian() {
    nav.navigate("GuardianLink");
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
        <Text style={styles.title}>케어</Text>
        <Text style={styles.sub}>어떻게 사용하시나요?</Text>
      </View>

      {/* Profile input card */}
      <View style={styles.card}>
        <Text style={styles.label}>이름</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="예: 안석찬" />

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

        <Text style={[styles.label, { marginTop: spacing.lg }]}>생년월일 (선택)</Text>
        <TextInput
          style={styles.input}
          value={birthDate}
          onChangeText={setBirthDate}
          placeholder="예: 1948-03-05"
          keyboardType="numbers-and-punctuation"
        />

        <Text style={[styles.label, { marginTop: spacing.lg }]}>거주지역 (선택)</Text>
        <TextInput
          style={styles.input}
          value={region}
          onChangeText={setRegion}
          placeholder="예: 전라북도 전주시"
        />
      </View>

      {/* Role choices */}
      <Pressable
        onPress={startAsPatient}
        style={({ pressed }) => [styles.choice, styles.choicePrimary, pressed && { opacity: 0.9 }]}
      >
        <View style={[styles.choiceIcon, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
          <User size={24} color="#fff" />
        </View>
        <Text style={[styles.choiceText, { color: "#fff" }]}>본인이 복약해요</Text>
      </Pressable>
      <Pressable
        onPress={startAsGuardian}
        style={({ pressed }) => [styles.choice, styles.choiceSecondary, pressed && { opacity: 0.9 }]}
      >
        <View style={[styles.choiceIcon, { backgroundColor: colors.lightBlueBg }]}>
          <Users size={24} color={colors.primaryBlue} />
        </View>
        <Text style={[styles.choiceText, { color: colors.primaryBlue }]}>가족을 확인해요 (보호자)</Text>
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
  choiceSecondary: {
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    shadowColor: colors.primaryNavy, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 1,
  },
  choiceIcon: { width: 44, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  choiceText: { fontSize: fontSizes.emphasis, fontWeight: "700", flexShrink: 1 },
});

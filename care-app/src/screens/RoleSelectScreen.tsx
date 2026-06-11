import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { BigButton } from "../components/BigButton";
import { setRole, setPatient } from "../lib/storage";
import { supabase } from "../lib/supabase";
import { colors, fontSizes, spacing } from "../theme/tokens";

function makeCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = ""; for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

export function RoleSelectScreen() {
  const nav = useNavigation<any>();
  const [name, setName] = useState("");

  async function startAsPatient() {
    if (!name.trim()) { Alert.alert("이름을 입력해 주세요"); return; }
    const code = makeCode();
    const { data, error } = await supabase.from("patients")
      .insert({ name: name.trim(), patient_code: code }).select().single();
    if (error || !data) { Alert.alert("등록 실패", error?.message ?? ""); return; }
    await setPatient(data.id, data.patient_code);
    await setRole("patient");
    nav.reset({ index: 0, routes: [{ name: "Tabs" }] });
  }
  async function startAsGuardian() {
    nav.navigate("GuardianLink");
  }

  return (
    <View style={styles.c}>
      <Text style={styles.title}>케어</Text>
      <Text style={styles.sub}>어떻게 사용하시나요?</Text>
      <Text style={styles.label}>이름</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="예: 안석찬" />
      <BigButton label="본인이 복약해요" onPress={startAsPatient} />
      <BigButton label="가족을 확인해요 (보호자)" variant="secondary" onPress={startAsGuardian} />
    </View>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, padding: spacing.lg, justifyContent: "center", backgroundColor: colors.lightBlueBg },
  title: { fontSize: 40, fontWeight: "800", color: colors.primaryNavy, textAlign: "center" },
  sub: { fontSize: fontSizes.emphasis, color: colors.text, textAlign: "center", marginVertical: spacing.lg },
  label: { fontSize: fontSizes.body, color: colors.text, marginBottom: spacing.sm },
  input: { backgroundColor: "#fff", borderColor: colors.border, borderWidth: 1, borderRadius: 12,
    fontSize: fontSizes.body, padding: 14, marginBottom: spacing.lg },
});

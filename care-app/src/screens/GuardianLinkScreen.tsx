import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { BigButton } from "../components/BigButton";
import { supabase } from "../lib/supabase";
import { setPatient } from "../lib/storage";
import { colors, fontSizes, spacing } from "../theme/tokens";

export function GuardianLinkScreen() {
  const nav = useNavigation<any>();
  const [code, setCode] = useState("");
  async function link() {
    const { data, error } = await supabase.from("patients").select("*")
      .eq("patient_code", code.trim().toUpperCase()).single();
    if (error || !data) { Alert.alert("연결 실패", "코드를 다시 확인해 주세요."); return; }
    await setPatient(data.id, data.patient_code);
    nav.reset({ index: 0, routes: [{ name: "GuardianHome" }] });
  }
  return (
    <View style={styles.c}>
      <Text style={styles.title}>보호자 연결</Text>
      <Text style={styles.sub}>가족의 6자리 코드를 입력해 주세요.</Text>
      <TextInput style={styles.input} value={code} onChangeText={setCode}
        autoCapitalize="characters" placeholder="예: K7Q2MX" maxLength={6} />
      <BigButton label="연결하기" onPress={link} />
    </View>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, padding: spacing.lg, justifyContent: "center" },
  title: { fontSize: fontSizes.title, fontWeight: "800", color: colors.text, textAlign: "center" },
  sub: { fontSize: fontSizes.body, color: colors.textSecondary, textAlign: "center", marginVertical: spacing.md },
  input: { backgroundColor: "#fff", borderColor: colors.border, borderWidth: 1, borderRadius: 12,
    fontSize: 28, letterSpacing: 6, textAlign: "center", padding: 16, marginBottom: spacing.lg },
});

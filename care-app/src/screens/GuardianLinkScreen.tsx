import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { KeyRound } from "lucide-react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { BigButton } from "../components/BigButton";
import { supabase } from "../lib/supabase";
import { setPatient, setRole } from "../lib/storage";
import { colors, fontSizes, spacing, radii } from "../theme/tokens";

export function GuardianLinkScreen() {
  const nav = useNavigation<any>();
  const [code, setCode] = useState("");
  async function link() {
    const { data, error } = await supabase.from("patients").select("*")
      .eq("patient_code", code.trim().toUpperCase()).single();
    if (error || !data) { Alert.alert("연결 실패", "코드를 다시 확인해 주세요."); return; }
    await setPatient(data.id, data.patient_code);
    await setRole("guardian");
    nav.reset({ index: 0, routes: [{ name: "GuardianHome" }] });
  }
  return (
    <View style={styles.screen}>
      <ScreenHeader title="보호자 연결" />
      <ScrollView contentContainerStyle={styles.c}>
        <View style={styles.iconWrap}>
          <KeyRound size={40} color={colors.primaryBlue} strokeWidth={1.8} />
        </View>
        <Text style={styles.sub}>가족의 6자리 코드를 입력해 주세요.</Text>
        <View style={styles.card}>
          <TextInput style={styles.input} value={code} onChangeText={setCode}
            autoCapitalize="characters" placeholder="예: K7Q2MX" maxLength={6} />
        </View>
        <BigButton label="연결하기" onPress={link} />
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.lightBlueBg },
  c: { padding: spacing.lg, paddingTop: spacing.xl, flexGrow: 1, justifyContent: "center" },
  iconWrap: {
    width: 88, height: 88, borderRadius: 26, backgroundColor: colors.cardBg,
    alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: spacing.lg,
    shadowColor: colors.primaryNavy, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 2,
  },
  sub: { fontSize: fontSizes.emphasis, color: colors.text, textAlign: "center", marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md, marginBottom: spacing.lg,
  },
  input: {
    backgroundColor: colors.lightBlueBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.button, fontSize: 32, fontWeight: "800", color: colors.primaryNavy,
    letterSpacing: 10, textAlign: "center", padding: 16,
  },
});

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme/tokens";
export function SplashScreen() {
  return (<View style={s.c}><Text style={s.t}>케어</Text><Text style={s.sub}>말로 쉽게 기록하는 복약 관리</Text></View>);
}
const s = StyleSheet.create({
  c: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  t: { fontSize: 48, fontWeight: "800", color: colors.primaryNavy },
  sub: { fontSize: 18, color: colors.textSecondary, marginTop: 12 },
});

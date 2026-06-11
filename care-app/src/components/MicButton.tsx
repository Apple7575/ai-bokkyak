import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { colors } from "../theme/tokens";

type Props = { recording: boolean; onPress: () => void };
export function MicButton({ recording, onPress }: Props) {
  return (
    <Pressable onPress={onPress}
      style={[styles.mic, { backgroundColor: recording ? colors.dangerRed : colors.primaryBlue }]}>
      <Text style={styles.icon}>🎙</Text>
      <Text style={styles.label}>{recording ? "듣는 중..." : "말하기"}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  mic: { width: 160, height: 160, borderRadius: 80, alignItems: "center",
    justifyContent: "center", alignSelf: "center" },
  icon: { fontSize: 48 },
  label: { color: "#fff", fontSize: 20, fontWeight: "700", marginTop: 8 },
});

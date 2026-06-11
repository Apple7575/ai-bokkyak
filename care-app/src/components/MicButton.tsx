import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { Mic } from "lucide-react-native";
import { colors } from "../theme/tokens";

type Props = { recording: boolean; onPress: () => void };
export function MicButton({ recording, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.mic,
        {
          backgroundColor: recording ? colors.dangerRed : colors.primaryBlue,
          borderWidth: recording ? 8 : 0,
          borderColor: recording ? "rgba(226,83,83,0.25)" : "transparent",
          shadowColor: recording ? colors.dangerRed : colors.primaryBlue,
        },
        pressed && { opacity: 0.92 },
      ]}
    >
      <Mic size={48} color="#fff" />
      <Text style={styles.label}>{recording ? "듣는 중..." : "말하기"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mic: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 6,
  },
  label: { color: "#fff", fontSize: 20, fontWeight: "700", marginTop: 8 },
});

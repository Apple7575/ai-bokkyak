import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Bell, BellOff } from "lucide-react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { colors, fontSizes, radii, spacing } from "../theme/tokens";

const alarms = [
  { id: 1, name: "아침 약", time: "오전 8:30", enabled: true, days: "매일" },
  { id: 2, name: "점심 약", time: "오후 12:30", enabled: true, days: "매일" },
  { id: 3, name: "저녁 약", time: "오후 6:30", enabled: true, days: "매일" },
  { id: 4, name: "취침 약", time: "오후 9:30", enabled: false, days: "매일" },
];

export function AlarmListScreen() {
  return (
    <View style={styles.screen}>
      <ScreenHeader title="알림" />
      <ScrollView contentContainerStyle={styles.content}>
        {alarms.map(({ id, name, time, enabled, days }) => (
          <View key={id} style={styles.card}>
            <View style={styles.left}>
              <View style={[styles.iconBox, { backgroundColor: enabled ? colors.lightBlueBg : "#F7FAFF" }]}>
                {enabled
                  ? <Bell size={22} color={colors.primaryBlue} />
                  : <BellOff size={22} color={colors.textSecondary} />}
              </View>
              <View>
                <Text style={[styles.name, { color: enabled ? colors.text : colors.textSecondary }]}>{name}</Text>
                <Text style={styles.meta}>{time} · {days}</Text>
              </View>
            </View>
            <View style={[styles.track, { backgroundColor: enabled ? colors.primaryBlue : colors.border }]}>
              <View style={[styles.knob, { left: enabled ? 24 : 4 }]} />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7FAFF" },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  card: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md,
  },
  left: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 },
  iconBox: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  name: { fontSize: fontSizes.body, fontWeight: "700" },
  meta: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: 2 },
  track: { width: 48, height: 28, borderRadius: radii.pill, justifyContent: "center" },
  knob: { position: "absolute", top: 4, width: 20, height: 20, borderRadius: radii.pill, backgroundColor: "#fff" },
});

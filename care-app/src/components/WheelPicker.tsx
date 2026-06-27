import React, { useRef } from "react";
import { ScrollView, View, Text, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { colors, fontSizes } from "../theme/tokens";

const ITEM_H = 48;
type Props = { values: number[]; value: number; onChange: (v: number) => void; suffix?: string };

export function WheelPicker({ values, value, onChange, suffix }: Props) {
  const ref = useRef<ScrollView>(null);
  const idx = Math.max(0, values.indexOf(value));
  function onEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const v = values[Math.min(values.length - 1, Math.max(0, i))];
    if (v !== value) onChange(v);
  }
  return (
    <View style={styles.wrap}>
      <View style={styles.selBar} pointerEvents="none" />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: idx * ITEM_H }}
        contentContainerStyle={{ paddingVertical: ITEM_H }}
        onMomentumScrollEnd={onEnd}
      >
        {values.map((v) => (
          <View key={v} style={styles.item}>
            <Text style={[styles.txt, v === value && styles.txtOn]}>{v}{suffix ?? ""}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { height: ITEM_H * 3, width: 120, justifyContent: "center" },
  selBar: { position: "absolute", top: ITEM_H, left: 0, right: 0, height: ITEM_H,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  item: { height: ITEM_H, alignItems: "center", justifyContent: "center" },
  txt: { fontSize: fontSizes.emphasis, color: colors.textSecondary },
  txtOn: { color: colors.primaryNavy, fontWeight: "800" },
});

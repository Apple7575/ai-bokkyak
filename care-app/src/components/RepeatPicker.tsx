import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { TimeChip } from "./TimeChip";
import { normalizeRepeatDays } from "../lib/schedule";
import {
  RepeatPreset, DAY_FULL, presetOf, daysForPreset, repeatSummaryFor,
} from "../lib/repeatDays";
import { colors, fontSizes, spacing } from "../theme/tokens";

// 반복 요일 선택 — 모든 등록 화면(직접 입력·사진·복용시점)이 함께 쓴다.
//
// QA 2026-10-03: "매일" 옆에 한 글자 요일 칩("일 월 화 …")을 늘어놓자 "일"이 매일로 읽혀
// 고혈압약이 일요일에만 울리게 저장됐다. Medisafe·iOS 알람·토스처럼
//   ① 빈도를 문장으로 먼저 묻고(매일/평일만/주말만/직접 고르기),
//   ② 요일 칩은 "직접 고르기"를 눌렀을 때만 전체 이름("일요일")으로 보여주고,
//   ③ 고른 결과를 항상 한 문장으로 되읽어 준다.
//
// value는 항상 정규화된 int[] — 빈 배열 = 매일 (설계 결정 #1).
// custom은 부모가 가진다: "직접 고르기"를 눌렀는데 요일이 아직 없는 상태(value=[])는
// 값만으로는 매일과 구분이 안 되므로, 부모가 이 플래그로 저장을 막고 요약을 바꾼다.

type Props = {
  value: number[];
  custom: boolean;
  onChange: (days: number[], custom: boolean) => void;
};

const PRESETS: { key: RepeatPreset; label: string }[] = [
  { key: "daily", label: "매일" },
  { key: "weekdays", label: "평일만" },
  { key: "weekend", label: "주말만" },
  { key: "custom", label: "요일 직접 고르기" },
];

export function RepeatPicker({ value, custom, onChange }: Props) {
  const days = normalizeRepeatDays(value);
  // 직접 고르기 중에는 고른 요일이 우연히 평일·주말과 같아져도 요일 칩이 사라지지 않는다.
  const highlighted: RepeatPreset = custom ? "custom" : presetOf(days);

  function pickPreset(p: RepeatPreset) {
    if (p === "custom") {
      // 이미 직접 고른 요일이면 유지, 아니면 빈 상태에서 시작해 칩만 펼친다.
      onChange(presetOf(days) === "custom" ? days : [], true);
      return;
    }
    onChange(daysForPreset(p, days), false);
  }

  function toggleDay(d: number) {
    const next = normalizeRepeatDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d]);
    // 일곱 요일을 모두 고르면 그냥 매일이다 — 빈 배열로 접는다 (설계 결정 #1).
    if (next.length === 7) onChange([], false);
    else onChange(next, true);
  }

  return (
    <View>
      <Text style={styles.label}>얼마나 자주 드세요?</Text>
      <View style={styles.row}>
        {PRESETS.map((p) => (
          <TimeChip
            key={p.key}
            label={p.label}
            selected={highlighted === p.key}
            onPress={() => pickPreset(p.key)}
          />
        ))}
      </View>
      {custom ? (
        <View style={styles.row}>
          {DAY_FULL.map((name, i) => (
            <TimeChip
              key={name}
              label={name}
              selected={days.includes(i)}
              onPress={() => toggleDay(i)}
            />
          ))}
        </View>
      ) : null}
      <Text style={styles.summary}>{repeatSummaryFor(days, custom)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: fontSizes.body, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  row: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 },
  summary: { fontSize: fontSizes.body, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 26 },
});

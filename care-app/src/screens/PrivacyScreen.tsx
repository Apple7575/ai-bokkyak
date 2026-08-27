import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import notifee from "@notifee/react-native";
import { Trash2 } from "lucide-react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { IllustrationBanner } from "../components/IllustrationBanner";
import { supabase } from "../lib/supabase";
import { getPatientId, clearAll } from "../lib/storage";
import { colors, fontSizes, radii, spacing, minTouch } from "../theme/tokens";

const PRIVACY_ART = require("../../assets/illustrations/privacy-lock.png");

type Section = { title: string; body: string[] };

// 실제 수집·이용 범위를 그대로 적는다. 앱이 하지 않는 일(제3자 제공, 광고 등)은
// 하지 않는다고 명시한다.
const SECTIONS: Section[] = [
  {
    title: "1. 수집하는 정보",
    body: [
      "· 이름, 성별, 생년월일",
      "· 복약 일정(약 이름, 시간대, 복용 시각, 반복 요일)",
      "· 복약 기록(복용 완료 · 미루기 · 건너뜀과 그 시각)",
      "· 약봉투 사진으로 등록할 때 촬영한 사진",
    ],
  },
  {
    title: "2. 이용 목적",
    body: [
      "수집한 정보는 복약 알람을 정확한 시각에 보내 드리고, 복약 현황과 이행률을",
      "보여 드리는 데에만 사용합니다. 광고나 마케팅에는 사용하지 않습니다.",
    ],
  },
  {
    title: "3. 마이크와 사진의 처리",
    body: [
      "이 앱은 마이크를 쓰지 않습니다. 목소리를 녹음하거나 전송하지 않습니다.",
      "안내 음성은 앱이 읽어 드리기만 하고, 대답은 화면 버튼으로 받습니다.",
      "",
      "약봉투 사진으로 등록하실 때에만, 사진의 글자를 읽기 위해 그 사진이 OpenAI의",
      "이미지 인식 서비스로 전송됩니다. 전송된 사진은 이 앱의 서버에 따로 저장하지",
      "않으며, 읽어낸 결과로 만들어진 복약 일정만 저장됩니다.",
      "",
      "안내 음성을 만들 때에는 읽어 드릴 문장(예: \"아침 약 드실 시간이에요\")이",
      "OpenAI의 음성 합성 서비스로 전송됩니다.",
    ],
  },
  {
    title: "4. 보관과 파기",
    body: [
      "정보는 서비스를 이용하시는 동안 보관합니다.",
      "아래 '모든 데이터 삭제'를 누르시면 등록하신 정보와 기록이 즉시 삭제되며,",
      "삭제된 정보는 복구할 수 없습니다.",
    ],
  },
  {
    title: "5. 제3자 제공",
    body: [
      "위 3항의 음성·이미지 인식을 위한 처리를 제외하고, 어떤 정보도 제3자에게",
      "제공하거나 판매하지 않습니다.",
    ],
  },
  {
    title: "6. 알림 권한",
    body: [
      "복약 알람을 정확한 시각에 보내기 위해 알림 권한과 '알람 및 리마인더' 권한을",
      "사용합니다. 이 권한은 알람 외의 용도로 사용하지 않습니다.",
    ],
  },
  {
    title: "7. 시험 서비스 안내",
    body: [
      "이 앱은 시험(알파 테스트) 단계의 서비스입니다. 의료기기가 아니며 진단·처방을",
      "대신하지 않습니다. 약에 대한 상담은 의사나 약사와 상의해 주세요.",
    ],
  },
];

export function PrivacyScreen() {
  const nav = useNavigation<any>();
  const [deleting, setDeleting] = useState(false);

  async function deleteEverything(): Promise<void> {
    setDeleting(true);
    try {
      // 예약된 알람부터 정리 — 데이터가 사라진 뒤 알람이 울리는 일이 없게.
      await notifee.cancelAllNotifications().catch(() => {});
      const pid = await getPatientId();
      if (pid) {
        // 일정·기록·알람 로그는 patients FK의 on delete cascade로 함께 지워진다.
        const { error } = await supabase.from("patients").delete().eq("id", pid);
        if (error) throw error;
      }
      await clearAll();
      nav.reset({ index: 0, routes: [{ name: "RoleSelect" }] });
    } catch {
      setDeleting(false);
      Alert.alert(
        "삭제하지 못했어요",
        "인터넷 연결을 확인하고 다시 시도해 주세요."
      );
    }
  }

  function confirmDelete(): void {
    Alert.alert(
      "모든 데이터를 삭제할까요?",
      "등록하신 약과 복약 기록이 모두 지워지고 처음 화면으로 돌아가요. 되돌릴 수 없습니다.",
      [
        { text: "취소", style: "cancel" },
        { text: "삭제", style: "destructive", onPress: () => { void deleteEverything(); } },
      ]
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="개인정보 설정" />
      <ScrollView contentContainerStyle={styles.content}>
        <IllustrationBanner source={PRIVACY_ART} tone="cream" height={170} />
        <View style={styles.card}>
          <Text style={styles.docTitle}>개인정보처리방침</Text>
          <Text style={styles.intro}>
            모두의 복약은 복약 관리를 위해 꼭 필요한 정보만 모으고, 안전하게 보관합니다.
          </Text>
          {SECTIONS.map((s) => (
            <View key={s.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{s.title}</Text>
              {s.body.map((line, i) => (
                <Text key={i} style={styles.sectionBody}>{line}</Text>
              ))}
            </View>
          ))}
        </View>

        <Pressable
          onPress={confirmDelete}
          disabled={deleting}
          style={({ pressed }) => [styles.deleteBtn, (pressed || deleting) && { opacity: 0.8 }]}
        >
          <Trash2 size={20} color="#fff" />
          <Text style={styles.deleteBtnText}>
            {deleting ? "삭제 중…" : "모든 데이터 삭제"}
          </Text>
        </Pressable>
        <Text style={styles.deleteNote}>
          이 기기에서 앱 데이터가 삭제되고 처음 화면으로 돌아가요.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.card, padding: spacing.md,
  },
  docTitle: { fontSize: fontSizes.emphasis, fontWeight: "800", color: colors.primaryNavy },
  intro: {
    fontSize: fontSizes.body, color: colors.textSecondary,
    marginTop: spacing.sm, lineHeight: 26,
  },
  section: { marginTop: spacing.lg },
  sectionTitle: {
    fontSize: fontSizes.body, fontWeight: "800", color: colors.primaryNavy,
    marginBottom: spacing.xs,
  },
  sectionBody: { fontSize: fontSizes.body, color: colors.text, lineHeight: 28 },
  deleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    minHeight: minTouch, borderRadius: radii.button, marginTop: spacing.lg,
    backgroundColor: colors.dangerRed,
  },
  deleteBtnText: { fontSize: fontSizes.emphasis, fontWeight: "700", color: "#fff" },
  deleteNote: {
    fontSize: fontSizes.body, color: colors.textSecondary,
    textAlign: "center", marginTop: spacing.sm,
  },
});

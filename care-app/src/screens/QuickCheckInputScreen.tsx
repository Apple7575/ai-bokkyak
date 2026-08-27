import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Search, Pencil, Check, Plus, X } from "lucide-react-native";
import { BigButton } from "../components/BigButton";
import { searchProducts, ProductHit } from "../lib/drugData";
import {
  SUPPLEMENT_PRESETS, MEDICINE_PRESETS, NONE_SUPPLEMENT, NONE_MEDICINE,
  toggleItem, addItem, checkItems, EMPTY_DRAFT,
} from "../lib/quickCheck";
import { loadDraft, saveDraft } from "../lib/quickCheckDraft";
import { colors, fontSizes, spacing, radii, minTouch, shadows } from "../theme/tokens";

// "1분 복용 점검" 입력 — 1/2 영양제, 2/2 복용약.
// 가입 전이라 서버에는 아무것도 쓰지 않는다. 고른 것은 기기 초안(quickCheckDraft)에만 남긴다.

type Step = "supplements" | "medicines";
type Panel = "none" | "search" | "manual";

const STEP_META: Record<Step, {
  n: number; title: string; sub: string; presets: readonly string[]; none: string;
}> = {
  supplements: {
    n: 1, title: "드시고 있는 영양제가 있나요?", sub: "해당하는 것을 모두 눌러 주세요.",
    presets: SUPPLEMENT_PRESETS, none: NONE_SUPPLEMENT,
  },
  medicines: {
    n: 2, title: "지금 드시는 약이 있나요?", sub: "해당하는 것을 모두 눌러 주세요.",
    presets: MEDICINE_PRESETS, none: NONE_MEDICINE,
  },
};

export function QuickCheckInputScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("supplements");
  const [supplements, setSupplements] = useState<string[]>([]);
  const [medicines, setMedicines] = useState<string[]>([]);
  const [panel, setPanel] = useState<Panel>("none");

  // 앞서 고르다 만 초안이 있으면 되살린다(앱을 껐다 켜도 처음부터 다시 고르지 않게).
  useEffect(() => {
    let alive = true;
    void loadDraft().then((d) => {
      if (!alive || !d) return;
      setSupplements(d.supplements);
      setMedicines(d.medicines);
    });
    return () => { alive = false; };
  }, []);

  const meta = STEP_META[step];
  const list = step === "supplements" ? supplements : medicines;
  const setList = step === "supplements" ? setSupplements : setMedicines;
  const customs = list.filter((x) => x !== meta.none && !meta.presets.includes(x));
  const canNext = list.length > 0;

  function onChip(label: string) { setList(toggleItem(list, label, meta.none)); }
  function onAdd(label: string) { setList(addItem(list, label, meta.none)); setPanel("none"); }
  function onRemove(label: string) { setList(list.filter((x) => x !== label)); }

  function goBack() {
    if (step === "medicines") { setStep("supplements"); setPanel("none"); return; }
    if (nav.canGoBack()) nav.goBack();
    else nav.reset({ index: 0, routes: [{ name: "RoleSelect" }] });
  }
  // 건너뛰기 = 점검 없이 바로 가입으로.
  function skip() { nav.reset({ index: 0, routes: [{ name: "RoleSelect" }] }); }

  async function next() {
    if (!canNext) return;
    if (step === "supplements") { setStep("medicines"); setPanel("none"); return; }
    const draft = { ...EMPTY_DRAFT, supplements, medicines };
    if (checkItems(draft).length === 0) {
      Alert.alert("확인할 약이나 영양제를 하나 이상 골라 주세요");
      return;
    }
    try {
      await saveDraft(draft);
    } catch {
      Alert.alert("저장하지 못했어요", "기기 저장 공간을 확인하고 다시 시도해 주세요.");
      return;
    }
    nav.navigate("QuickCheckAnalyzing");
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* 상단 바 — 뒤로 · 진행(2칸) · 건너뛰기 (VoiceGuide와 같은 꼴) */}
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={12} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="뒤로">
          <ChevronLeft size={26} color={colors.textSecondary} />
        </Pressable>
        <View style={styles.progressWrap} accessibilityLabel={`${meta.n}단계, 전체 2단계`}>
          <View style={styles.segRow}>
            {[0, 1].map((i) => <View key={i} style={[styles.seg, i < meta.n && styles.segOn]} />)}
          </View>
          <Text style={styles.progressText}>{meta.n}/2 {step === "supplements" ? "영양제" : "복용약"}</Text>
        </View>
        <Pressable onPress={skip} hitSlop={10} style={styles.skipBtn} accessibilityRole="button" accessibilityLabel="건너뛰기">
          <Text style={styles.skipText}>건너뛰기</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.c, { paddingBottom: spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{meta.title}</Text>
        <Text style={styles.sub}>{meta.sub}</Text>

        <View style={styles.grid}>
          {meta.presets.map((label) => {
            const on = list.includes(label);
            return (
              <Pressable key={label} onPress={() => onChip(label)} accessibilityRole="button" accessibilityState={{ selected: on }}
                style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.85 }]}>
                {on ? <Check size={20} strokeWidth={3} color={colors.white} /> : null}
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
          {customs.map((label) => (
            <Pressable key={label} onPress={() => onRemove(label)} accessibilityRole="button" accessibilityLabel={`${label} 빼기`}
              style={({ pressed }) => [styles.chip, styles.chipOn, pressed && { opacity: 0.85 }]}>
              <Text style={[styles.chipText, styles.chipTextOn]}>{label}</Text>
              <X size={20} strokeWidth={3} color={colors.white} />
            </Pressable>
          ))}
        </View>

        <Pressable onPress={() => onChip(meta.none)} accessibilityRole="button"
          accessibilityState={{ selected: list.includes(meta.none) }}
          style={({ pressed }) => [styles.noneChip, list.includes(meta.none) && styles.noneChipOn, pressed && { opacity: 0.85 }]}>
          {list.includes(meta.none) ? <Check size={20} strokeWidth={3} color={colors.primaryNavy} /> : null}
          <Text style={styles.noneText}>{meta.none}</Text>
        </Pressable>

        {/* 목록에 없는 것 — 이름 검색 / 직접 입력 */}
        <View style={styles.addRow}>
          <Pressable onPress={() => setPanel(panel === "search" ? "none" : "search")}
            style={({ pressed }) => [styles.addBtn, panel === "search" && styles.addBtnOn, pressed && { opacity: 0.9 }]}>
            <Search size={20} color={colors.primaryBlue} />
            <Text style={styles.addText}>이름 검색</Text>
          </Pressable>
          <Pressable onPress={() => setPanel(panel === "manual" ? "none" : "manual")}
            style={({ pressed }) => [styles.addBtn, panel === "manual" && styles.addBtnOn, pressed && { opacity: 0.9 }]}>
            <Pencil size={20} color={colors.primaryBlue} />
            <Text style={styles.addText}>직접 입력</Text>
          </Pressable>
        </View>

        {panel === "search" ? <SearchPanel onPick={onAdd} onClose={() => setPanel("none")} /> : null}
        {panel === "manual" ? <ManualPanel onAdd={onAdd} onClose={() => setPanel("none")} /> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
        <BigButton label={step === "supplements" ? "다음" : "점검 시작하기"} onPress={() => void next()} disabled={!canNext} showArrow />
      </View>
    </KeyboardAvoidingView>
  );
}

// 이름 검색 패널 — 공공데이터 제품명 부분검색(MedicineSearchScreen과 같은 방식).
function SearchPanel({ onPick, onClose }: { onPick: (name: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ProductHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const text = q.trim();
    if (text.length < 2) { setHits(null); setLoading(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const mine = ++seq.current;
      const r = await searchProducts(text, 12);
      if (mine !== seq.current) return;
      if (!r.ready) { setUnavailable(true); setHits([]); }
      else { setUnavailable(false); setHits(r.data); }
      setLoading(false);
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>이름으로 찾기</Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기" style={styles.panelClose}>
          <X size={22} color={colors.textSecondary} />
        </Pressable>
      </View>
      <View style={styles.searchWrap}>
        <Search size={20} color={colors.textSecondary} />
        <TextInput style={styles.searchInput} value={q} onChangeText={setQ} placeholder="예: 오메가"
          placeholderTextColor={colors.textSecondary} autoFocus returnKeyType="search" />
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primaryBlue} /><Text style={styles.guide}>찾는 중…</Text></View>
      ) : null}
      {!loading && q.trim().length < 2 ? <Text style={styles.guide}>두 글자 이상 입력해 주세요.</Text> : null}
      {!loading && hits !== null && unavailable ? (
        <Text style={styles.guide}>약 목록을 불러오지 못했어요. 인터넷 연결을 확인하거나 직접 입력해 주세요.</Text>
      ) : null}
      {!loading && hits !== null && !unavailable && hits.length === 0 ? <Text style={styles.guide}>찾는 약이 없어요. 직접 입력해 주세요.</Text> : null}
      {(hits ?? []).map((h) => (
        <Pressable key={h.product_code} onPress={() => onPick(h.product_name)}
          style={({ pressed }) => [styles.hit, pressed && { opacity: 0.9 }]}>
          <View style={styles.hitInfo}>
            <Text style={styles.hitName} numberOfLines={2}>{h.product_name}</Text>
            {h.company ? <Text style={styles.hitCompany}>{h.company}</Text> : null}
          </View>
          <Plus size={22} color={colors.primaryBlue} />
        </Pressable>
      ))}
    </View>
  );
}

function ManualPanel({ onAdd, onClose }: { onAdd: (name: string) => void; onClose: () => void }) {
  const [text, setText] = useState("");
  const ok = text.trim().length > 0;
  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>직접 입력</Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기" style={styles.panelClose}>
          <X size={22} color={colors.textSecondary} />
        </Pressable>
      </View>
      <TextInput style={styles.manualInput} value={text} onChangeText={setText} placeholder="약이나 영양제 이름"
        placeholderTextColor={colors.textSecondary} autoFocus returnKeyType="done"
        onSubmitEditing={() => { if (ok) onAdd(text); }} />
      <BigButton label="추가하기" variant="secondary" disabled={!ok} onPress={() => onAdd(text)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  backBtn: { width: 72, height: 44, justifyContent: "center" },
  skipBtn: { width: 72, height: 44, alignItems: "flex-end", justifyContent: "center" },
  skipText: { fontSize: fontSizes.body, color: colors.textSecondary, fontWeight: "600" },
  progressWrap: { flex: 1, alignItems: "center" },
  segRow: { flexDirection: "row", gap: 6 },
  seg: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border },
  segOn: { backgroundColor: colors.primaryBlue },
  progressText: { marginTop: 6, fontSize: 14, fontWeight: "700", color: colors.textSecondary },
  c: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  title: { color: colors.primaryNavy, fontSize: 28, lineHeight: 38, fontWeight: "800", letterSpacing: -0.6 },
  sub: { marginTop: spacing.sm, color: colors.textSecondary, fontSize: fontSizes.body, lineHeight: 27 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: spacing.lg },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    minHeight: minTouch, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised, borderWidth: 1.5, borderColor: colors.border, ...shadows.card,
  },
  chipOn: { backgroundColor: colors.primaryBlue, borderColor: colors.primaryBlue },
  chipText: { fontSize: fontSizes.body, fontWeight: "700", color: colors.text },
  chipTextOn: { color: colors.white },
  noneChip: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: spacing.md, minHeight: minTouch, borderRadius: radii.pill,
    backgroundColor: colors.canvasMuted, borderWidth: 1.5, borderColor: colors.border,
  },
  noneChipOn: { backgroundColor: colors.sunshineSoft, borderColor: colors.sunshine },
  noneText: { fontSize: fontSizes.body, fontWeight: "700", color: colors.primaryNavy },
  addRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  addBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    minHeight: minTouch, borderRadius: radii.button,
    backgroundColor: colors.cardBg, borderColor: colors.primaryBlue, borderWidth: 1,
  },
  addBtnOn: { backgroundColor: colors.primarySoft, borderWidth: 2 },
  addText: { fontSize: fontSizes.body, fontWeight: "700", color: colors.primaryBlue },
  panel: {
    marginTop: spacing.md, padding: spacing.md, gap: spacing.sm,
    backgroundColor: colors.surfaceRaised, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, ...shadows.card,
  },
  panelHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  panelTitle: { fontSize: 20, fontWeight: "800", color: colors.primaryNavy },
  panelClose: { width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md,
    minHeight: minTouch, borderRadius: radii.pill, backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 20, color: colors.text },
  center: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  guide: { fontSize: fontSizes.body, color: colors.textSecondary, lineHeight: 26 },
  hit: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: minTouch,
    padding: spacing.sm, borderRadius: radii.button, backgroundColor: colors.lightBlueBg,
  },
  hitInfo: { flex: 1 },
  hitName: { fontSize: fontSizes.body, fontWeight: "700", color: colors.text },
  hitCompany: { fontSize: 16, color: colors.textSecondary, marginTop: 2 },
  manualInput: {
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1.5,
    borderRadius: radii.button, fontSize: fontSizes.body, padding: 14, minHeight: minTouch, color: colors.text,
  },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, backgroundColor: colors.canvas },
});

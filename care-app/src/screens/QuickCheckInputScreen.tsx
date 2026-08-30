import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { ChevronLeft, ChevronDown, Search, Pencil, Camera, Image as ImageIcon, Check, Plus, X } from "lucide-react-native";
import { BigButton } from "../components/BigButton";
import { searchProducts, ProductHit } from "../lib/drugData";
import { gptOcrPrescription } from "../lib/ocr";
import {
  SUPPLEMENT_PRESETS, SUPPLEMENT_MORE, MEDICINE_PRESETS, AGES, CONDS,
  NONE_SUPPLEMENT, NONE_MEDICINE, NONE_CONDITION,
  toggleItem, addItem, checkItems, EMPTY_DRAFT,
} from "../lib/quickCheck";
import { loadDraft, saveDraft } from "../lib/quickCheckDraft";
import { colors, fontSizes, spacing, radii, minTouch, shadows } from "../theme/tokens";

// "1분 복용 점검" 입력 — 1/3 영양제, 2/3 복용약, 3/3 기본 정보 (시안 V8 화면 8~10).
// 가입 전이라 서버에는 아무것도 쓰지 않는다. 고른 것은 기기 초안(quickCheckDraft)에만 남긴다.
// 사진 추가(OCR)도 이름만 읽어 칩으로 넣을 뿐, 일정 저장은 하지 않는다.

type Step = "supplements" | "medicines" | "profile";
type Panel = "none" | "search" | "manual" | "photo";

const STEP_ORDER: Step[] = ["supplements", "medicines", "profile"];
const STEP_LABEL: Record<Step, string> = { supplements: "1/3 영양제", medicines: "2/3 복용약", profile: "3/3 기본 정보" };

const LIST_META: Record<"supplements" | "medicines", {
  title: string; sub: string; presets: readonly string[]; none: string; searchLabel: string; photoLabel: string;
}> = {
  supplements: {
    title: "현재 먹고 있는 영양제나\n건강기능식품이 있나요?",
    sub: "약과 함께 먹었을 때 확인이 필요한\n조합이 있는지 살펴볼게요.",
    presets: SUPPLEMENT_PRESETS, none: NONE_SUPPLEMENT, searchLabel: "이름 검색", photoLabel: "사진 추가",
  },
  medicines: {
    title: "현재 복용 중인\n약이 있나요?",
    sub: "정확한 이름을 몰라도 검색이나\n약봉투 사진으로 추가할 수 있어요.",
    presets: MEDICINE_PRESETS, none: NONE_MEDICINE, searchLabel: "약 이름 검색", photoLabel: "약봉투 사진",
  },
};

export function QuickCheckInputScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("supplements");
  const [supplements, setSupplements] = useState<string[]>([]);
  const [medicines, setMedicines] = useState<string[]>([]);
  const [age, setAge] = useState<string | null>(null);
  const [conditions, setConditions] = useState<string[]>([]);
  const [more, setMore] = useState(false); // 영양제 "더 보기" 펼침
  const [panel, setPanel] = useState<Panel>("none");
  // 저장 중 두 번 눌러 점검 화면이 두 번 열리지 않게(입력을 잠그는 게 아니라 재진입만 막는다).
  const nextBusy = useRef(false);

  // 앞서 고르다 만 초안이 있으면 되살린다(앱을 껐다 켜도 처음부터 다시 고르지 않게).
  useEffect(() => {
    let alive = true;
    void loadDraft().then((d) => {
      if (!alive || !d) return;
      setSupplements(d.supplements);
      setMedicines(d.medicines);
      setAge(d.profile.age);
      setConditions(d.profile.conditions);
      if (d.supplements.some((x) => (SUPPLEMENT_MORE as readonly string[]).includes(x))) setMore(true);
    });
    return () => { alive = false; };
  }, []);

  const stepIndex = STEP_ORDER.indexOf(step);
  const listStep = step === "profile" ? null : step;
  const meta = listStep ? LIST_META[listStep] : null;
  const list = step === "supplements" ? supplements : medicines;
  const setList = step === "supplements" ? setSupplements : setMedicines;
  const presets: readonly string[] = step === "supplements" && more ? [...SUPPLEMENT_PRESETS, ...SUPPLEMENT_MORE] : (meta?.presets ?? []);
  const noneLabel = meta?.none ?? "";
  const customs = list.filter((x) => x !== noneLabel && !presets.includes(x));
  const canNext = step === "profile" ? age !== null : list.length > 0;

  function onChip(label: string) { setList(toggleItem(list, label, noneLabel)); }
  function onAdd(label: string) { setList(addItem(list, label, noneLabel)); setPanel("none"); }
  // 사진에서 읽은 이름 여러 개를 한 번에.
  function onAddMany(labels: string[]) {
    let next = list;
    for (const l of labels) next = addItem(next, l, noneLabel);
    setList(next);
    setPanel("none");
  }
  function onRemove(label: string) { setList(list.filter((x) => x !== label)); }
  function onCondition(label: string) { setConditions(toggleItem(conditions, label, NONE_CONDITION)); }

  function goBack() {
    if (stepIndex > 0) { setStep(STEP_ORDER[stepIndex - 1]); setPanel("none"); return; }
    if (nav.canGoBack()) nav.goBack();
    else nav.reset({ index: 0, routes: [{ name: "RoleSelect" }] });
  }
  // 건너뛰기 = 점검 없이 바로 가입으로.
  function skip() { nav.reset({ index: 0, routes: [{ name: "RoleSelect" }] }); }

  async function next() {
    if (!canNext || nextBusy.current) return;
    if (step !== "profile") { setStep(STEP_ORDER[stepIndex + 1]); setPanel("none"); return; }
    const draft = { ...EMPTY_DRAFT, supplements, medicines, profile: { age, conditions } };
    // 영양제·약 둘 다 "없음"이면 대조할 것이 없다.
    if (checkItems(draft).length === 0) {
      Alert.alert("확인할 것이 없어요", "약이나 영양제를 하나 이상 골라야 복용 조합을 점검할 수 있어요.");
      return;
    }
    nextBusy.current = true;
    try {
      await saveDraft(draft);
    } catch {
      Alert.alert("저장하지 못했어요", "기기 저장 공간을 확인하고 다시 시도해 주세요.");
      return;
    } finally {
      nextBusy.current = false;
    }
    nav.navigate("QuickCheckAnalyzing");
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* 상단 바 — 뒤로 · 진행(3칸) · 건너뛰기 (시안 V8 segs) */}
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={12} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="뒤로">
          <ChevronLeft size={26} color={colors.textSecondary} />
        </Pressable>
        <View style={styles.progressWrap} accessibilityLabel={`${stepIndex + 1}단계, 전체 ${STEP_ORDER.length}단계`}>
          <View style={styles.segRow}>
            {STEP_ORDER.map((s, i) => <View key={s} style={[styles.seg, i <= stepIndex && styles.segOn]} />)}
          </View>
          <Text style={styles.progressText}>{STEP_LABEL[step]}</Text>
        </View>
        <Pressable onPress={skip} hitSlop={10} style={styles.skipBtn} accessibilityRole="button" accessibilityLabel="건너뛰기">
          <Text style={styles.skipText}>건너뛰기</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.c, { paddingBottom: spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        {meta && listStep ? (
          <>
            <Text style={styles.title}>{meta.title}</Text>
            <Text style={styles.sub}>{meta.sub}</Text>

            <View style={styles.grid}>
              {presets.map((label) => {
                const on = list.includes(label);
                return (
                  <Pressable key={label} onPress={() => onChip(label)} accessibilityRole="button" accessibilityState={{ selected: on }}
                    style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.85 }]}>
                    {on ? <Check size={18} strokeWidth={3.2} color={colors.primaryBlue} /> : null}
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
                  </Pressable>
                );
              })}
              {customs.map((label) => (
                <Pressable key={label} onPress={() => onRemove(label)} accessibilityRole="button" accessibilityLabel={`${label} 빼기`}
                  style={({ pressed }) => [styles.chip, styles.chipOn, pressed && { opacity: 0.85 }]}>
                  <Text style={[styles.chipText, styles.chipTextOn]}>{label}</Text>
                  <X size={18} strokeWidth={3} color={colors.primaryBlue} />
                </Pressable>
              ))}
              {step === "supplements" && !more ? (
                <Pressable onPress={() => setMore(true)} accessibilityRole="button" accessibilityLabel="영양제 더 보기"
                  style={({ pressed }) => [styles.moreChip, pressed && { opacity: 0.85 }]}>
                  <Text style={styles.moreText}>더 보기</Text>
                  <ChevronDown size={16} strokeWidth={2.6} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </View>

            <Pressable onPress={() => onChip(meta.none)} accessibilityRole="button"
              accessibilityState={{ selected: list.includes(meta.none) }}
              style={({ pressed }) => [styles.noneChip, list.includes(meta.none) && styles.noneChipOn, pressed && { opacity: 0.85 }]}>
              {list.includes(meta.none) ? <Check size={20} strokeWidth={3} color={colors.primaryNavy} /> : null}
              <Text style={styles.noneText}>{meta.none}</Text>
            </Pressable>

            {/* 목록에 없는 것 — 이름 검색 / 사진 추가 / 직접 입력 */}
            <View style={styles.addRow}>
              <Pressable onPress={() => setPanel(panel === "search" ? "none" : "search")} accessibilityRole="button"
                style={({ pressed }) => [styles.addBtn, panel === "search" && styles.addBtnOn, pressed && { opacity: 0.9 }]}>
                <Search size={20} color={colors.primaryBlue} />
                <Text style={styles.addText}>{meta.searchLabel}</Text>
              </Pressable>
              <Pressable onPress={() => setPanel(panel === "photo" ? "none" : "photo")} accessibilityRole="button"
                style={({ pressed }) => [styles.addBtn, panel === "photo" && styles.addBtnOn, pressed && { opacity: 0.9 }]}>
                <Camera size={20} color={colors.primaryBlue} />
                <Text style={styles.addText}>{meta.photoLabel}</Text>
              </Pressable>
              <Pressable onPress={() => setPanel(panel === "manual" ? "none" : "manual")} accessibilityRole="button"
                style={({ pressed }) => [styles.addBtn, panel === "manual" && styles.addBtnOn, pressed && { opacity: 0.9 }]}>
                <Pencil size={20} color={colors.primaryBlue} />
                <Text style={styles.addText}>직접 입력</Text>
              </Pressable>
            </View>

            {panel === "search" ? <SearchPanel onPick={onAdd} onClose={() => setPanel("none")} /> : null}
            {panel === "manual" ? <ManualPanel onAdd={onAdd} onClose={() => setPanel("none")} /> : null}
            {panel === "photo" ? <PhotoPanel key={listStep} onAdd={onAddMany} onClose={() => setPanel("none")} /> : null}
          </>
        ) : (
          <>
            <Text style={styles.title}>분석에 필요한 정보만{"\n"}간단하게 확인할게요.</Text>

            <Text style={styles.question}>연령대가 어떻게 되세요?</Text>
            <View style={styles.gridTight}>
              {AGES.map((label) => {
                const on = age === label;
                return (
                  <Pressable key={label} onPress={() => setAge(label)} accessibilityRole="button" accessibilityState={{ selected: on }}
                    style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.85 }]}>
                    {on ? <Check size={18} strokeWidth={3.2} color={colors.primaryBlue} /> : null}
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.question}>해당되는 항목이 있나요?</Text>
            <View style={styles.gridTight}>
              {CONDS.map((label) => {
                const on = conditions.includes(label);
                return (
                  <Pressable key={label} onPress={() => onCondition(label)} accessibilityRole="button" accessibilityState={{ selected: on }}
                    style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.85 }]}>
                    {on ? <Check size={18} strokeWidth={3.2} color={colors.primaryBlue} /> : null}
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.helper}>복용 조합을 확인하기 위한 최소 정보입니다.</Text>
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
        <BigButton label={step === "profile" ? "내 복용 분석하기" : "다음"} onPress={() => void next()} disabled={!canNext} showArrow />
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

// 사진 추가 패널 — 약봉투·제품 사진에서 이름만 읽어 칩으로 넣는다 (OcrRegisterScreen과 같은 촬영 경로).
// 여기서는 일정을 저장하거나 서버를 부르지 않는다. 인식 중에도 화면 나머지는 그대로 쓸 수 있다.
type PhotoState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "found"; names: string[]; checked: boolean[] };

function PhotoPanel({ onAdd, onClose }: { onAdd: (names: string[]) => void; onClose: () => void }) {
  const [state, setState] = useState<PhotoState>({ kind: "idle" });
  const alive = useRef(true);
  const seq = useRef(0);
  useEffect(() => () => { alive.current = false; }, []);

  async function capture(source: "camera" | "library") {
    const mine = ++seq.current;
    try {
      const perm = source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("권한이 필요해요", source === "camera" ? "카메라 권한을 허용해 주세요." : "사진 보관함 권한을 허용해 주세요.");
        return;
      }
      const opts: ImagePicker.ImagePickerOptions = {
        base64: true, quality: 0.5, mediaTypes: ImagePicker.MediaTypeOptions.Images,
      };
      const res = source === "camera"
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.[0]?.base64) return;
      if (!alive.current || mine !== seq.current) return;
      setState({ kind: "loading" });
      const meds = await gptOcrPrescription(res.assets[0].base64);
      if (!alive.current || mine !== seq.current) return;
      const names = Array.from(new Set(meds.map((m) => m.medicine_name.trim()).filter(Boolean)));
      setState(names.length === 0 ? { kind: "empty" } : { kind: "found", names, checked: names.map(() => true) });
    } catch {
      if (!alive.current || mine !== seq.current) return;
      setState({ kind: "idle" });
      Alert.alert("인식에 실패했어요", "인터넷 연결을 확인하고 다시 시도해 주세요.");
    }
  }

  function toggle(i: number) {
    if (state.kind !== "found") return;
    setState({ ...state, checked: state.checked.map((c, idx) => (idx === i ? !c : c)) });
  }
  const picked = state.kind === "found" ? state.names.filter((_, i) => state.checked[i]) : [];

  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>사진으로 추가하기</Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기" style={styles.panelClose}>
          <X size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      {state.kind === "loading" ? (
        <View style={styles.center}><ActivityIndicator color={colors.primaryBlue} /><Text style={styles.guide}>사진에서 약 이름을 읽고 있어요…</Text></View>
      ) : null}

      {state.kind === "idle" ? <Text style={styles.guide}>약봉투나 제품 사진을 찍어 주세요. 이름이 잘 보이게 찍을수록 정확해요.</Text> : null}
      {state.kind === "empty" ? (
        <Text style={styles.guide}>사진에서 약 이름을 찾지 못했어요. 약 이름이 잘 보이게 다시 찍어 주세요.</Text>
      ) : null}

      {state.kind === "found" ? (
        <>
          <Text style={styles.guide}>읽은 이름이에요. 추가할 것만 남겨 주세요.</Text>
          {state.names.map((n, i) => (
            <Pressable key={n} onPress={() => toggle(i)} accessibilityRole="checkbox" accessibilityState={{ checked: state.checked[i] }}
              style={({ pressed }) => [styles.hit, !state.checked[i] && styles.hitOff, pressed && { opacity: 0.9 }]}>
              <View style={[styles.checkBox, state.checked[i] && styles.checkBoxOn]}>
                {state.checked[i] ? <Check size={16} strokeWidth={3} color={colors.white} /> : null}
              </View>
              <Text style={[styles.hitName, styles.hitInfo]} numberOfLines={2}>{n}</Text>
            </Pressable>
          ))}
          <BigButton label={picked.length > 0 ? `${picked.length}개 추가하기` : "추가하기"} disabled={picked.length === 0} onPress={() => onAdd(picked)} />
        </>
      ) : null}

      {state.kind !== "loading" ? (
        <View style={styles.photoRow}>
          <Pressable onPress={() => void capture("camera")} accessibilityRole="button" accessibilityLabel="사진 찍기"
            style={({ pressed }) => [styles.photoBtn, pressed && { opacity: 0.9 }]}>
            <Camera size={22} color={colors.primaryBlue} />
            <Text style={styles.photoBtnText}>{state.kind === "idle" ? "사진 찍기" : "다시 찍기"}</Text>
          </Pressable>
          <Pressable onPress={() => void capture("library")} accessibilityRole="button" accessibilityLabel="앨범에서 고르기"
            style={({ pressed }) => [styles.photoBtn, pressed && { opacity: 0.9 }]}>
            <ImageIcon size={22} color={colors.primaryBlue} />
            <Text style={styles.photoBtnText}>앨범에서 고르기</Text>
          </Pressable>
        </View>
      ) : null}
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
  seg: { width: 34, height: 5, borderRadius: 3, backgroundColor: colors.border },
  segOn: { backgroundColor: colors.primaryBlue },
  progressText: { marginTop: 6, fontSize: 14, fontWeight: "700", color: colors.primaryBlue },
  c: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  title: { color: colors.primaryNavy, fontSize: 25, lineHeight: 36, fontWeight: "800", letterSpacing: -0.7 },
  sub: { marginTop: 10, color: colors.textSecondary, fontSize: fontSizes.body, lineHeight: 27, fontWeight: "600", letterSpacing: -0.3 },
  question: { marginTop: 22, color: colors.primaryNavy, fontSize: fontSizes.body, fontWeight: "700" },
  helper: { marginTop: 18, color: colors.textSecondary, fontSize: 15, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 20 },
  gridTight: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  // 시안 chipStyle — 선택: 연파랑 배경 + 파랑 테두리·글자, 미선택: 흰 배경
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    minHeight: minTouch, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised, borderWidth: 1.5, borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primaryBlue },
  chipText: { fontSize: fontSizes.body, fontWeight: "700", color: colors.text, letterSpacing: -0.3 },
  chipTextOn: { color: colors.primaryBlue },
  moreChip: {
    flexDirection: "row", alignItems: "center", gap: 6, minHeight: minTouch, paddingHorizontal: 16,
    borderRadius: radii.pill, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.border,
  },
  moreText: { fontSize: fontSizes.body, fontWeight: "700", color: colors.textSecondary },
  noneChip: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: spacing.md, minHeight: minTouch, borderRadius: radii.pill,
    backgroundColor: colors.canvasMuted, borderWidth: 1.5, borderColor: colors.border,
  },
  noneChipOn: { backgroundColor: colors.sunshineSoft, borderColor: colors.sunshine },
  noneText: { fontSize: fontSizes.body, fontWeight: "700", color: colors.primaryNavy },
  // 시안: 3칸 그리드, 64px, 아이콘 위·글자 아래
  addRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  addBtn: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 4,
    minHeight: 64, borderRadius: 14,
    backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1.5,
  },
  addBtnOn: { backgroundColor: colors.primarySoft, borderColor: colors.primaryBlue },
  addText: { fontSize: 15, fontWeight: "700", color: colors.text },
  photoRow: { flexDirection: "row", gap: spacing.sm },
  photoBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    minHeight: minTouch, borderRadius: radii.button,
    backgroundColor: colors.cardBg, borderColor: colors.primaryBlue, borderWidth: 1.5,
  },
  photoBtnText: { fontSize: 17, fontWeight: "700", color: colors.primaryBlue },
  hitOff: { backgroundColor: colors.canvasMuted },
  checkBox: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.cardBg, alignItems: "center", justifyContent: "center" },
  checkBoxOn: { backgroundColor: colors.primaryBlue, borderColor: colors.primaryBlue },
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

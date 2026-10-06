import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Modal, ActivityIndicator, Share, Alert, Platform } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShieldCheck, Stethoscope, MessageCircle, X, SearchX, Lock } from "lucide-react-native";
import { BigButton } from "../components/BigButton";
import { getPatientId, getPatientName } from "../lib/storage";
import { isKakaoLinked, linkKakao } from "../lib/kakaoAccount";
import {
  checkedCount as countChecked, checkItems, checkedNamesLine, summarize, topFinding, lockedGroups, isResultLocked, groupByKind,
  unmatchedDescription, QuickFinding, RuleKind,
} from "../lib/quickCheck";
import { KIND_LABEL } from "../lib/quickCheckRules";
import { buildQuickCheckShareMessage } from "../lib/quickCheckShare";
import { loadDraft } from "../lib/quickCheckDraft";
import { DISCLAIMER } from "../lib/voiceScript";
import { colors, fontSizes, spacing, radii, minTouch, shadows } from "../theme/tokens";

// 점검 결과 — 회의 2026-09-10(B안, 목업 B-1): 종류별로 전부 보여 준다. 단 회의 2026-09-13(안 2)로 잠금이 돌아왔다 —
// 주의 2건 이상이면 카카오 연결 전에는 첫 건만(⑤). 푸는 조건은 옛 "가입"이 아니라 카카오 연결이다.
// 3/3에서 환자를 만들었고 점검 직후 서버에 저장했으므로 "결과 저장하고 …" 갈래는 없다.
// 다음 갈래는 둘뿐: 이 약들로 복용 알람 설정하기 / 나중에 할게요(홈).
// 결과 데이터: 앞 화면(Analyzing·Home 재시도)이 commit 후 params로 넘긴 것을 우선 쓰고,
// 없으면(저장 실패로 초안이 남은 경우) 기기 초안에서 읽는다.

type State =
  | { phase: "loading" }
  | { phase: "empty" }
  // names: 대조한 이름 전부(부제용). unmatched: 자료에서 못 찾아 대조에서 빠진 입력 이름.
  // checkedCount: 실제로 대조한 이름 수 = names − unmatched.
  | {
      phase: "ok"; findings: QuickFinding[]; names: string[]; unmatched: string[]; checkedCount: number;
      durUnavailable: boolean; unmappedIngredients: string[]; uncoveredConditions: string[];
      engine?: "server" | "local";
    };

// kind별 태그 색(우선=빨강, 시간=파랑, 중복=주황).
const KIND_COLOR: Record<RuleKind, { fg: string; bg: string }> = {
  priority: { fg: colors.dangerRed, bg: colors.dangerSoft },
  timing: { fg: colors.primaryBlue, bg: colors.primarySoft },
  overlap: { fg: colors.warningOrange, bg: colors.warningSoft },
  caution: { fg: colors.textSecondary, bg: colors.canvasMuted },
};

// 근거 수준(서버 판정에만 있음) → 표시 라벨. 없는 값(none_known 등)은 보여 주지 않는다.
const EVIDENCE_LABEL: Record<string, string> = {
  established: "연구로 확인됨",
  theoretical: "가능성 있음",
  limited: "가능성 있음",
  conflicting: "의견이 갈림",
};

// 카카오 연결 여부 조회를 기다리는 최대 시간 — 넘으면 조회 실패(null)로 보고 결과를 연다.
const LINK_LOOKUP_TIMEOUT_MS = 5000;

function FindingCard({ f }: { f: QuickFinding }) {
  const c = KIND_COLOR[f.kind];
  const evidence = f.evidenceLevel ? EVIDENCE_LABEL[f.evidenceLevel] : undefined;
  return (
    <View style={styles.card}>
      <View style={[styles.tag, { backgroundColor: c.bg }]}>
        <Text style={[styles.tagText, { color: c.fg }]}>{f.tag}</Text>
      </View>
      <Text style={styles.cardTitle}>{f.title}</Text>
      <Text style={styles.cardMsg}>{f.message}</Text>
      {typeof f.minSeparationHours === "number" ? (
        <Text style={styles.separation}>{`권장 간격: ${f.minSeparationHours}시간`}</Text>
      ) : null}
      {f.source === "dur" && f.notice_no ? <Text style={styles.source}>{`근거: 식약처 DUR 고시 ${f.notice_no}`}</Text> : null}
      <View style={styles.divider} />
      <View style={styles.pharmRow}>
        <View style={styles.pharmPill}><Text style={styles.pharmPillText}>약사 확인 권장</Text></View>
        {evidence ? <Text style={styles.evidenceText}>{evidence}</Text> : null}
        <Text style={styles.pharmNote}>복용 방법은 약사 또는 의료진과 확인해주세요.</Text>
      </View>
    </View>
  );
}

export function QuickCheckResultScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State>({ phase: "loading" });
  const [name, setName] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  // 카카오 연결 여부 — 결과를 잠글지 정한다. undefined=아직 조회 중(잠금 유지), null=조회 실패(연다). isResultLocked 참고.
  const [linked, setLinked] = useState<boolean | null | undefined>(undefined);
  // 연결 중 두 번 눌러 로그인 창이 두 번 뜨지 않게(다른 버튼을 잠그는 게 아니라 재진입만 막는다).
  // ref는 동기 가드, state는 버튼 문구·비활성용.
  const linkBusy = useRef(false);
  const [linking, setLinking] = useState(false);
  // 연결 중에 화면을 떠났으면 늦게 끝난 실패 안내가 다른 화면 위에 뜨지 않게.
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      let v: boolean | null;
      try {
        const pid = await getPatientId();
        // 응답 없이 멈춘 요청(타임아웃이 없다)도 실패로 친다 — 결과가 영영 잠겨 있지 않게.
        const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), LINK_LOOKUP_TIMEOUT_MS); });
        v = pid ? await Promise.race([isKakaoLinked(pid), timeout]) : null;
      } catch {
        v = null; // 조회 실패 — 영영 잠겨 있지 않게 연다(안전 정보를 가리지 않는다)
      } finally {
        if (timer) clearTimeout(timer);
      }
      // 연결에 성공한(true) 뒤에 늦게 도착한 조회 결과가 다시 잠그지 않게.
      if (alive) setLinked((cur) => (cur === true ? true : v));
    })();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const patientName = await getPatientName();
      const paramFindings = route.params?.findings as QuickFinding[] | undefined;
      let next: State;
      if (paramFindings) {
        // commit이 초안을 지웠으므로 전부 params에서 읽는다.
        const names = (route.params?.names as string[] | undefined) ?? [];
        const unmatched = (route.params?.unmatched as string[] | undefined) ?? [];
        next = {
          phase: "ok", findings: paramFindings, names, unmatched,
          checkedCount: Math.max(0, names.length - unmatched.length),
          durUnavailable: Boolean(route.params?.durUnavailable),
          unmappedIngredients: (route.params?.unmappedIngredients as string[] | undefined) ?? [],
          uncoveredConditions: (route.params?.uncoveredConditions as string[] | undefined) ?? [],
          engine: route.params?.engine as "server" | "local" | undefined,
        };
      } else {
        const d = await loadDraft();
        next = !d?.findings ? { phase: "empty" } : {
          phase: "ok", findings: d.findings, names: checkItems(d), unmatched: d.unmatched,
          checkedCount: countChecked(d),
          durUnavailable: d.durUnavailable === true,
          unmappedIngredients: d.unmappedIngredients ?? [],
          uncoveredConditions: d.uncoveredConditions ?? [],
          engine: d.engine,
        };
      }
      if (!alive) return;
      setName(patientName);
      setState(next);
    })();
    return () => { alive = false; };
  }, [route.params]);

  // 점검한 이름을 그대로 넘겨 약마다 시간대를 고르게 한다(회의 2026-09-06·09-12).
  // 쌓아서 연다 — 알람 설정에서 뒤로 가면 이 결과로 돌아온다(회의 2026-10-06).
  function toAlarm() {
    const medicines = state.phase === "ok" ? state.names : [];
    nav.navigate("VoiceGuide", { medicines });
  }
  function toHome() {
    nav.reset({ index: 0, routes: [{ name: "Tabs" }] });
  }
  function toPick() {
    nav.reset({ index: 0, routes: [{ name: "QuickCheckInput" }] });
  }
  // 잠긴 결과를 카카오 연결로 연다. 취소는 조용히, 실패만 Alert로 알린다.
  // 성공엔 안내 Alert를 두지 않는다 — 가려졌던 상세가 나타나는 것이 곧 확인이다.
  async function unlock() {
    if (linkBusy.current) return;
    linkBusy.current = true;
    setLinking(true);
    try {
      const pid = await getPatientId();
      if (!pid) {
        if (mounted.current) Alert.alert("카카오 연결", "내 정보를 찾지 못했어요. 앱을 다시 시작해 주세요.");
        return;
      }
      const r = await linkKakao(pid);
      if (r.ok) { setLinked(true); return; }
      if (r.canceled) return;
      // 앞선 조회가 실패해 몰랐을 뿐 이미 연결돼 있을 수 있다 — 한 번 더 확인해 맞으면 연다.
      if ((await isKakaoLinked(pid)) === true) { setLinked(true); return; }
      if (mounted.current) Alert.alert("카카오 연결", r.message);
    } catch {
      if (mounted.current) Alert.alert("카카오 연결", "인터넷 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      linkBusy.current = false;
      setLinking(false);
    }
  }
  // 시스템 공유 시트 — 카카오톡은 여기서 고른다(카카오 SDK 없음). 취소는 조용히, 실패만 알린다.
  async function share() {
    setShareOpen(false);
    try {
      await Share.share({ message: buildQuickCheckShareMessage(Platform.OS) });
    } catch (e) {
      Alert.alert("보내지 못했어요", e instanceof Error && e.message ? e.message : "잠시 후 다시 시도해 주세요.");
    }
  }

  const findings = state.phase === "ok" ? state.findings : [];
  const names = state.phase === "ok" ? state.names : [];
  const unmatched = state.phase === "ok" ? state.unmatched : [];
  const unmappedIngredients = state.phase === "ok" ? state.unmappedIngredients : [];
  // 서버가 아직 판정하지 못하는 기본 정보(신장질환, 간질환 — 연령대는 제외).
  // (판정은 서버 전용이다. engine="local" 은 내장 규칙이 있던 구버전 저장분에만 남아 있다.)
  const uncoveredConditions = state.phase === "ok" ? state.uncoveredConditions : [];
  // 대조한 이름이 2개 미만이면 조합 점검 자체가 성립하지 않는다 — "이상 없음"이라 하면 안 된다.
  const nothingChecked = state.phase === "ok" && state.checkedCount < 2;
  const summary = summarize(findings);
  const top = topFinding(findings);
  const lockedKinds = lockedGroups(findings);
  const locked = state.phase === "ok" && isResultLocked(summary.total, linked);
  const namesLine = checkedNamesLine(names);
  const title = summary.total > 0
    ? `${name ? `${name}님, ` : ""}확인 필요 ${summary.total}건`
    : nothingChecked ? "복용 조합 점검이 끝났어요." : "확인된 주의 조합이 없어요";

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.c, { paddingBottom: spacing.xl + insets.bottom }]}>
        {state.phase === "loading" ? (
          <View style={styles.center}><ActivityIndicator size="large" color={colors.primaryBlue} /></View>
        ) : null}

        {state.phase === "empty" ? (
          <View style={styles.safe}>
            <Text style={styles.safeDesc}>점검 결과가 없어요. 처음부터 다시 점검해 주세요.</Text>
            <BigButton label="다시 점검하기" variant="secondary" onPress={toPick} />
          </View>
        ) : null}

        {/* ① 제목 · ② 대조한 이름 */}
        {state.phase === "ok" ? (
          <>
            <Text style={styles.title}>{title}</Text>
            {namesLine ? <Text style={styles.subtitle}>{namesLine}</Text> : null}
          </>
        ) : null}

        {/* ③ 안내 노트 — 제품명 대조를 못 한 채 저장된 구버전 결과(지금 판정은 서버 전용이라 새로 생기지 않는다) */}
        {state.phase === "ok" && state.durUnavailable ? (
          <View style={styles.durNote}>
            <Text style={styles.note}>인터넷 연결 문제로 제품명 자료 대조는 하지 못했어요. 연결을 확인하고 다시 대조해 보세요.</Text>
            <BigButton label="제품명 다시 대조하기" variant="secondary" onPress={() => nav.replace("QuickCheckAnalyzing")} />
          </View>
        ) : null}

        {/* 자료에서 못 찾은 제품명 — 성분을 알 수 없어 점검에서 빠진다 */}
        {state.phase === "ok" && unmatched.length > 0 ? (
          <View style={styles.unmatched}>
            <View style={styles.unmatchedHead}>
              <SearchX size={24} color={colors.warningOrange} />
              <Text style={styles.unmatchedTitle}>점검하지 못한 항목 {unmatched.length}개</Text>
            </View>
            <Text style={styles.unmatchedNames}>{unmatched.join(" · ")}</Text>
            <Text style={styles.unmatchedDesc}>{unmatchedDescription(unmatched)}</Text>
          </View>
        ) : null}

        {/* 서버 조건 규칙이 없는 기본 정보 — 결과에 반영되지 않았음을 숨기지 않는다 */}
        {state.phase === "ok" && uncoveredConditions.length > 0 ? (
          <View style={styles.durNote}>
            <Text style={styles.note}>{`이번 점검에서 아직 확인하지 못한 정보: ${uncoveredConditions.join(" · ")}`}</Text>
            <Text style={styles.note}>약사에게 함께 말씀해 주세요.</Text>
          </View>
        ) : null}

        {/* 제품은 찾았지만 성분 매핑이 없던 원료 — 점검 단위(입력 이름)가 아니라 따로 알린다 */}
        {state.phase === "ok" && unmappedIngredients.length > 0 ? (
          <Text style={styles.note}>{`성분을 확인하지 못한 원료: ${unmappedIngredients.join(" · ")}`}</Text>
        ) : null}

        {/* ④ 0건 — 약사 문장은 하단 고지 한 곳으로 모은다 */}
        {state.phase === "ok" && summary.total === 0 && !nothingChecked ? (
          <View style={styles.safe}>
            <ShieldCheck size={44} color={colors.successGreen} />
            <Text style={styles.safeDesc}>고르신 약과 영양제 사이에 알려진 주의 조합은 없었어요.</Text>
          </View>
        ) : null}

        {/* ⑤ 종류별 전부 — 회의 2026-09-13(안 2): 주의 2건 이상이면 첫 건만 공개, 나머지는 카카오 연결로 연다.
            조회 실패(null)면 연다(네트워크 탓에 안전 정보를 가리지 않는다). */}
        {state.phase === "ok" && summary.total > 0 ? (
          locked ? (
            <>
              <Text style={styles.section}>가장 먼저 확인해보세요.</Text>
              {top ? <FindingCard f={top} /> : null}
              {lockedKinds.length > 0 ? (
                <>
                  <Text style={styles.section}>추가로 확인할 내용이 있어요.</Text>
                  <View style={styles.lockedBox}>
                    {lockedKinds.map((g, i) => (
                      <View key={g.kind} style={[styles.lockedRow, i === lockedKinds.length - 1 && styles.lockedRowLast]}>
                        <Text style={styles.lockedTitle}>{KIND_LABEL[g.kind]}</Text>
                        <Text style={styles.lockedCount}>{`${g.count}건`}</Text>
                        <Lock size={18} color={colors.textSecondary} />
                      </View>
                    ))}
                  </View>
                </>
              ) : null}
              <Pressable
                onPress={() => { void unlock(); }}
                disabled={linking}
                style={({ pressed }) => [styles.kakaoBtn, styles.unlockBtn, pressed && { opacity: 0.85 }, linking && styles.unlockBtnBusy]}
                accessibilityRole="button"
              >
                <MessageCircle size={22} color={colors.kakaoInk} fill={colors.kakaoInk} />
                <Text style={[styles.kakaoText, styles.unlockText]}>
                  {linking ? "연결 중…" : `카카오 연결하고 상세 ${summary.total - 1}건 보기`}
                </Text>
              </Pressable>
              <Text style={styles.unlockCaption}>휴대폰을 바꿔도 그대로 · 3초</Text>
            </>
          ) : (
            groupByKind(findings).map((g) => (
              <View key={g.kind} style={styles.group}>
                <Text style={styles.section}>{`${KIND_LABEL[g.kind]} ${g.items.length}건`}</Text>
                {g.items.map((f, i) => <FindingCard key={`${f.kind}|${f.a}|${f.b}|${i}`} f={f} />)}
              </View>
            ))
          )
        ) : null}

        {/* ⑥ 대조 2개 미만 — 조합 점검이 성립하지 않는다 */}
        {state.phase === "ok" && nothingChecked ? (
          <View style={styles.safe}>
            <Text style={styles.safeTitle}>점검할 조합이 부족해요</Text>
            <Text style={styles.safeDesc}>약과 영양제를 두 가지 이상 고르면 함께 먹어도 되는지 확인할 수 있어요.</Text>
          </View>
        ) : null}

        {/* ⑦ 버튼 — 알람 설정 / 나중에 */}
        {state.phase === "ok" ? (
          <View style={styles.actions}>
            {nothingChecked ? (
              <BigButton label="다시 고르기" onPress={toPick} showArrow />
            ) : (
              <BigButton label="복용 알람 시간 정하기" onPress={toAlarm} showArrow />
            )}
            <BigButton label="나중에 할게요" variant="secondary" onPress={toHome} />
          </View>
        ) : null}

        {/* ⑧ 공유 — 한 줄 링크 */}
        {state.phase === "ok" ? (
          <Pressable onPress={() => setShareOpen(true)} style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85 }]} accessibilityRole="button">
            <View style={styles.kakaoDot}><MessageCircle size={16} color={colors.kakaoInk} fill={colors.kakaoInk} /></View>
            <Text style={styles.shareBtnText}>가족·지인에게 1분 점검 보내기</Text>
          </Pressable>
        ) : null}

        {/* ⑨ 고지 — 약사 확인 한 번 + 면책 한 번 */}
        {state.phase === "ok" ? (
          <>
            <View style={styles.notice}>
              <Stethoscope size={22} color={colors.primaryNavy} />
              <Text style={styles.noticeText}>
                스스로 약을 끊거나 바꾸지 마시고,{" "}
                <Text style={styles.noticeStrong}>약사나 의사에게 꼭 확인하세요.</Text>
              </Text>
            </View>
            <Text style={styles.disclaimer}>{DISCLAIMER}</Text>
          </>
        ) : null}
      </ScrollView>

      {/* 공유 시트 */}
      <Modal visible={shareOpen} transparent animationType="slide" onRequestClose={() => setShareOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShareOpen(false)} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>가족과 지인도 함께 건강해지기</Text>
            <Pressable onPress={() => setShareOpen(false)} hitSlop={10} style={styles.sheetClose} accessibilityRole="button" accessibilityLabel="닫기">
              <X size={24} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.sheetSub}>약과 영양제를 함께 먹는 조합도 간단하게 확인해보세요.</Text>
          <Pressable onPress={() => { void share(); }} style={({ pressed }) => [styles.kakaoBtn, pressed && { opacity: 0.85 }]} accessibilityRole="button">
            <MessageCircle size={22} color={colors.kakaoInk} fill={colors.kakaoInk} />
            <Text style={styles.kakaoText}>카카오톡으로 1분 점검 보내기</Text>
          </Pressable>
          <Text style={styles.sheetCaption}>내 분석 결과는 공유되지 않아요.</Text>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  c: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
  title: { fontSize: 28, lineHeight: 38, fontWeight: "800", color: colors.primaryNavy, letterSpacing: -0.6 },
  subtitle: { fontSize: fontSizes.body, lineHeight: 26, fontWeight: "600", color: colors.textSecondary, marginTop: -spacing.sm },
  center: { alignItems: "center", marginTop: spacing.xl },
  section: { fontSize: 21, fontWeight: "800", color: colors.primaryNavy, letterSpacing: -0.4, marginTop: spacing.sm },
  divider: { height: 1, backgroundColor: colors.canvasMuted, marginVertical: spacing.sm },
  durNote: { gap: 4 },
  note: { fontSize: fontSizes.body, lineHeight: 26, color: colors.textSecondary },

  card: { backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1, borderRadius: radii.card, padding: spacing.md, ...shadows.card },
  tag: { alignSelf: "flex-start", borderRadius: radii.pill, paddingHorizontal: 12, minHeight: 32, justifyContent: "center" },
  tagText: { fontSize: 18, fontWeight: "700" },
  cardTitle: { fontSize: 23, fontWeight: "800", color: colors.primaryNavy, letterSpacing: -0.4, marginTop: spacing.sm + 4 },
  cardMsg: { fontSize: 19, lineHeight: 29, fontWeight: "600", color: colors.text, marginTop: spacing.sm },
  separation: { fontSize: 18, lineHeight: 26, fontWeight: "700", color: colors.primaryNavy, marginTop: spacing.sm },
  evidenceText: { fontSize: 18, fontWeight: "700", color: colors.textSecondary },
  source: { fontSize: 18, color: colors.textSecondary, marginTop: spacing.sm },
  pharmRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  pharmPill: { backgroundColor: colors.successSoft, borderRadius: radii.pill, paddingHorizontal: 12, minHeight: 32, justifyContent: "center" },
  pharmPillText: { fontSize: 18, fontWeight: "700", color: colors.successGreen },
  pharmNote: { flex: 1, fontSize: 18, lineHeight: 24, fontWeight: "600", color: colors.textSecondary, minWidth: 160 },

  // 잠긴 종류 목록 — 종류 이름과 건수만 보이고 내용은 가려진 상태(열렸을 때 section 제목과 같은 말)
  lockedBox: { backgroundColor: colors.cardBg, borderRadius: radii.card, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, ...shadows.card },
  lockedRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: minTouch, borderBottomWidth: 1, borderBottomColor: colors.canvasMuted },
  lockedRowLast: { borderBottomWidth: 0 },
  lockedTitle: { flex: 1, fontSize: fontSizes.body, fontWeight: "700", color: colors.text },
  lockedCount: { fontSize: fontSizes.body, fontWeight: "800", color: colors.textSecondary },
  // 잠금 해제 버튼 — 노란 kakaoBtn을 그대로 쓰되, 문구가 길어 좁은 폰·큰 글씨에서 두 줄이 되어도 안 깨지게 한다.
  unlockBtn: { paddingVertical: spacing.sm + 4, paddingHorizontal: spacing.md },
  unlockBtnBusy: { opacity: 0.45 },
  unlockText: { flexShrink: 1, textAlign: "center" },
  unlockCaption: { fontSize: fontSizes.body, fontWeight: "600", color: colors.textSecondary, textAlign: "center", marginTop: -spacing.sm },

  group: { gap: spacing.md },
  actions: { marginTop: spacing.sm, gap: spacing.sm },

  shareBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, minHeight: minTouch,
    borderRadius: radii.pill, backgroundColor: colors.surfaceRaised, borderWidth: 1.5, borderColor: colors.border,
  },
  kakaoDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.kakao, alignItems: "center", justifyContent: "center" },
  shareBtnText: { fontSize: fontSizes.body, fontWeight: "800", color: colors.primaryNavy },

  unmatched: { backgroundColor: colors.warningSoft, borderRadius: radii.card, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.warningOrange },
  unmatchedHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  unmatchedTitle: { fontSize: 20, fontWeight: "800", color: colors.primaryNavy },
  unmatchedNames: { fontSize: fontSizes.body, fontWeight: "700", color: colors.text, lineHeight: 26 },
  unmatchedDesc: { fontSize: fontSizes.body, color: colors.textSecondary, lineHeight: 27 },
  safe: { alignItems: "center", gap: spacing.sm, backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1, borderRadius: radii.card, padding: spacing.lg },
  safeTitle: { fontSize: 24, fontWeight: "800", color: colors.primaryNavy, textAlign: "center" },
  safeDesc: { fontSize: 19, color: colors.textSecondary, textAlign: "center", lineHeight: 28 },
  notice: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", backgroundColor: colors.lightBlueBg, borderRadius: radii.card, padding: spacing.md },
  noticeText: { flex: 1, fontSize: 19, color: colors.primaryNavy, lineHeight: 28 },
  noticeStrong: { fontWeight: "800" },
  disclaimer: { fontSize: 18, lineHeight: 22, color: colors.textSecondary, textAlign: "center" },

  backdrop: { flex: 1, backgroundColor: colors.overlayStrong },
  sheet: { backgroundColor: colors.surfaceRaised, borderTopLeftRadius: radii.hero, borderTopRightRadius: radii.hero, padding: spacing.lg, gap: spacing.md, ...shadows.floating },
  sheetHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  sheetTitle: { flex: 1, fontSize: 22, lineHeight: 32, fontWeight: "800", color: colors.primaryNavy, letterSpacing: -0.4 },
  sheetClose: { width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" },
  sheetSub: { fontSize: fontSizes.body, lineHeight: 26, color: colors.textSecondary, marginTop: -spacing.sm },
  sheetCaption: { fontSize: 18, fontWeight: "600", color: colors.textSecondary, textAlign: "center" },
  kakaoBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, minHeight: minTouch, borderRadius: radii.pill, backgroundColor: colors.kakao },
  kakaoText: { fontSize: fontSizes.emphasis, fontWeight: "800", color: colors.kakaoInk },
});

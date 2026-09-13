import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { QuickCheckDraft, EMPTY_DRAFT, checkItems } from "./quickCheck";
import { isQuickFinding } from "./quickCheckRules";

// 가입 전 "1분 복용 점검" 초안을 기기에 보관한다.
// 판정이 끝나면 commitQuickCheckDraft()가 서버(quick_check_results)에 옮기고, 초안에는 입력(영양제·약·
// 기본 정보)만 남긴다 — 결과 화면의 "다시 점검하기"가 같은 입력으로 다시 판정할 수 있게.

const KEY = "quickcheck.draft.v1";

export async function loadDraft(): Promise<QuickCheckDraft | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<QuickCheckDraft>;
    return {
      ...EMPTY_DRAFT,
      supplements: Array.isArray(p.supplements) ? p.supplements : [],
      medicines: Array.isArray(p.medicines) ? p.medicines : [],
      profile: {
        age: typeof p.profile?.age === "string" ? p.profile.age : null,
        conditions: Array.isArray(p.profile?.conditions) ? p.profile.conditions : [],
      },
      // 이전 빌드(DUR Finding[]: medA/medB, kind 없음)로 저장된 초안은 결과 화면에서 kind 조회가
      // 깨지므로 버린다 — 점검을 다시 하면 된다.
      findings: Array.isArray(p.findings) && p.findings.every(isQuickFinding) ? p.findings : null,
      unmatched: Array.isArray(p.unmatched) ? p.unmatched : [],
      // 서버 판정 전용 — 없거나 깨진 값이면 undefined(로컬 판정·구버전 초안).
      unmappedIngredients: Array.isArray(p.unmappedIngredients)
        ? p.unmappedIngredients.filter((s): s is string => typeof s === "string")
        : undefined,
      uncoveredConditions: Array.isArray(p.uncoveredConditions)
        ? p.uncoveredConditions.filter((s): s is string => typeof s === "string")
        : undefined,
      analyzedAt: typeof p.analyzedAt === "string" ? p.analyzedAt : null,
      durUnavailable: p.durUnavailable === true,
      // 판정 주체 — 모르는 값(구버전·깨진 값)은 버린다.
      engine: p.engine === "server" || p.engine === "local" ? p.engine : undefined,
      committedAt: typeof p.committedAt === "string" ? p.committedAt : null,
    };
  } catch {
    return null; // 깨진 값은 없는 것으로
  }
}

export async function saveDraft(draft: QuickCheckDraft): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(draft));
}

export async function clearDraft(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

// 판정 직후(QuickCheckAnalyzing)·홈 진입 시 호출. 점검을 마친 초안이 있으면 서버에 한 줄 남기고
// 초안에서 판정 결과만 비운다(입력은 보존). 저장한 초안(판정 결과 포함)을 돌려주고, 저장할 것이
// 없으면 null. insert 실패는 삼키지 않고 던진다 — 호출자가 Alert로 알리고 초안은 그대로 남겨
// 다음에 다시 시도할 수 있게.
export async function commitQuickCheckDraft(patientId: string): Promise<QuickCheckDraft | null> {
  const draft = await loadDraft();
  if (!draft || !draft.findings) return null;
  const { error } = await supabase.from("quick_check_results").insert({
    patient_id: patientId,
    // profile(연령대·해당 항목)은 기록용 — 분석에는 쓰지 않는다(quickCheck.ts 참고).
    items: {
      durUnavailable: draft.durUnavailable === true,   // 제품명 대조를 못 한 채 저장된 결과인지
      supplements: draft.supplements, medicines: draft.medicines, names: checkItems(draft),
      unmatched: draft.unmatched, profile: draft.profile,
      // 서버 판정 전용(성분 매핑 없던 원료명) — 로컬 판정이면 빈 배열.
      unmappedIngredients: draft.unmappedIngredients ?? [],
      // 서버가 판정하지 못한 기본 정보 라벨 — 저장된 행만 봐도 무엇이 빠졌는지 알 수 있게.
      uncoveredConditions: draft.uncoveredConditions ?? [],
      // 판정 주체(server|local). 구버전 초안이면 null.
      engine: draft.engine ?? null,
    },
    findings: draft.findings,
  });
  if (error) throw error;
  // 서버에 남았으니 판정 결과는 비우고 입력만 남긴다. 여기서 실패해도 insert는 이미 성공했으므로
  // 던지지 않는다 — 던지면 호출자가 "저장 실패"로 보고 다시 insert해 결과 행이 중복된다.
  try {
    await saveDraft({
      ...draft, findings: null, unmatched: [], analyzedAt: null, durUnavailable: false,
      unmappedIngredients: undefined, uncoveredConditions: undefined, engine: undefined,
      committedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("quickCheckDraft: 저장 후 초안 정리 실패", e);
  }
  return draft;
}

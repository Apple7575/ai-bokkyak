import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { QuickCheckDraft, EMPTY_DRAFT, checkItems } from "./quickCheck";
import { isQuickFinding } from "./quickCheckRules";

// 가입 전 "1분 복용 점검" 초안을 기기에 보관한다.
// 가입이 끝나면 commitQuickCheckDraft()가 서버(quick_check_results)에 옮기고 지운다.

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
      analyzedAt: typeof p.analyzedAt === "string" ? p.analyzedAt : null,
      durUnavailable: p.durUnavailable === true,
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

// 가입/로그인 직후 호출. 점검을 마친 초안이 있으면 서버에 한 줄 남기고 초안을 지운다.
// 저장한 초안을 돌려주고, 저장할 것이 없으면 null. 실패는 삼키지 않고 던진다 —
// 호출자가 Alert로 알리고 초안은 그대로 남겨 다음에 다시 시도할 수 있게.
export async function commitQuickCheckDraft(patientId: string): Promise<QuickCheckDraft | null> {
  const draft = await loadDraft();
  if (!draft || !draft.findings) return null;
  const { error } = await supabase.from("quick_check_results").insert({
    patient_id: patientId,
    // profile(연령대·해당 항목)은 기록용 — 분석에는 쓰지 않는다(quickCheck.ts 참고).
    items: {
      supplements: draft.supplements, medicines: draft.medicines, names: checkItems(draft),
      unmatched: draft.unmatched, profile: draft.profile,
    },
    findings: draft.findings,
  });
  if (error) throw error;
  await clearDraft();
  return draft;
}

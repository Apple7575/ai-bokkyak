import { supabase } from "./supabase";
import { signInWithKakao } from "./kakaoAuth";
import { setPatient, setPatientName, setOnboarded } from "./storage";

// 카카오 계정 — 회의 2026-09-10: 카카오는 "가입"이 아니라 "기기 이전용 연결"이다.
// 두 역할로 나뉜다.
//   복구(restoreWithKakao): 새 휴대폰에서 예전 정보를 불러온다(인트로·NameEntry).
//   연결(linkKakao, Task 3): 지금 쓰는 정보를 카카오 계정에 묶어 둔다(알람 완료·홈·더보기).
// 화면은 이 파일만 부른다. 브라우저·토큰 교환은 kakaoAuth.ts 뒤에 있다.
// RN import 없음 — storage·supabase·kakaoAuth만.

export type RestoreResult =
  | { ok: true; patientId: string; name: string }
  | { ok: false; canceled: boolean; message: string };

export const RESTORE_NOT_FOUND = "이 카카오 계정으로 저장된 정보가 없어요. 처음이시면 이름으로 시작해 주세요.";
const RESTORE_NETWORK = "인터넷 연결을 확인해 주세요.";

// 카카오 로그인 → kakao_id로 환자를 찾아 이 기기에 앉힌다.
// 없으면 새로 만들지 않는다 — 처음 쓰는 사람은 이름 한 칸으로 시작하게 안내한다.
// 실패는 throw 대신 {ok:false}로 돌려 화면이 Alert 한 번으로 끝내게 한다.
export async function restoreWithKakao(): Promise<RestoreResult> {
  const r = await signInWithKakao();
  if (!r.ok) return r;

  const { data, error } = await supabase
    .from("patients").select("id,name").eq("kakao_id", r.kakaoId).maybeSingle();
  if (error) return { ok: false, canceled: false, message: RESTORE_NETWORK };
  if (!data) return { ok: false, canceled: false, message: RESTORE_NOT_FOUND };

  const patientId = data.id as string;
  const name = typeof data.name === "string" ? data.name : "";
  await setPatient(patientId);
  await setPatientName(name);
  await setOnboarded();
  return { ok: true, patientId, name };
}

// ── 연결(linkKakao) ──────────────────────────────────────────────────────────
// 지금 이 기기의 환자를 카카오 계정에 묶어 둔다. 휴대폰을 바꾸면 위 restoreWithKakao로 되찾는다.
// RLS tier1이 anon의 patients update를 막으므로 서버 함수 link_kakao(supabase/migrate-kakao-link.sql)로
// 간다. 함수가 아직 없으면(SQL 미적용) rpc가 error를 돌려주고 "network" 문구로 끝난다 — 앱은 죽지 않는다.

export type LinkReason = "not_found" | "already_linked" | "taken" | "network";

export function linkResultMessage(reason: LinkReason): string {
  switch (reason) {
    case "not_found": return "내 정보를 찾지 못했어요. 앱을 다시 시작해 주세요.";
    case "already_linked": return "이미 다른 카카오 계정과 연결돼 있어요.";
    case "taken": return "이 카카오 계정은 다른 휴대폰의 정보와 이미 연결돼 있어요. 그 정보를 쓰시려면 '카카오로 불러오기'를 눌러 주세요.";
    case "network": return "인터넷 연결을 확인하고 다시 시도해 주세요.";
  }
}

export type LinkResult = { ok: true } | { ok: false; canceled: boolean; message: string };

const LINK_REASONS: readonly LinkReason[] = ["not_found", "already_linked", "taken", "network"];
type LinkRpcResult = { ok?: unknown; reason?: unknown };

export async function linkKakao(patientId: string): Promise<LinkResult> {
  const r = await signInWithKakao();
  if (!r.ok) return r;

  let res: LinkRpcResult | null = null;
  try {
    const { data, error } = await supabase.rpc("link_kakao", { p_patient_id: patientId, p_kakao_id: r.kakaoId });
    if (error) return { ok: false, canceled: false, message: linkResultMessage("network") };
    res = (data ?? null) as LinkRpcResult | null;
  } catch {
    return { ok: false, canceled: false, message: linkResultMessage("network") };
  }

  if (res && res.ok === true) return { ok: true };
  const reason = LINK_REASONS.find((k) => k === res?.reason) ?? "network";
  return { ok: false, canceled: false, message: linkResultMessage(reason) };
}

// 연결돼 있나. 조회에 실패하면 null — 화면은 "확인하지 못했어요"로 보여 주고 버튼은 남긴다.
export async function isKakaoLinked(patientId: string): Promise<boolean | null> {
  try {
    const { data, error } = await supabase
      .from("patients").select("kakao_id").eq("id", patientId).maybeSingle();
    if (error || !data) return null;
    return typeof data.kakao_id === "string" && data.kakao_id.length > 0;
  } catch {
    return null;
  }
}

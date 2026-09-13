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

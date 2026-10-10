import notifee from "@notifee/react-native";
import { supabase } from "./supabase";
import { signOut, hasStoredSession } from "./auth";
import { clearAll, clearPendingAlarm, getPatientId, setOnboarded, setPatient, setPatientName } from "./storage";
import { clearDraft } from "./quickCheckDraft";
import { clearLocalAlarmSchedules } from "./localAlarmSchedules";
import { clearIntakeOutbox } from "./intakeOutbox";
import { flushIntakeOutbox } from "./records";

// 내 계정(로그인) ↔ 내 환자 행(patients) — 회의 2026-10-08.
// 로그인 계정 하나에 환자 행 하나(patients.user_id unique). 환자 id는 지금처럼 기기에도 둔다 —
// 일정·기록·알람 화면이 전부 getPatientId()로 움직이므로, 로그인 후 adoptPatient()가 그 자리를
// 채워 주면 기존 화면은 손대지 않아도 된다.

// 처음 로그인 때 받은 동의. 문구를 고치면 version을 올려 누가 어느 문구에 동의했는지 남긴다.
export type Consent = {
  version: string;
  terms: true;      // [필수] 이용약관
  privacy: true;    // [필수] 개인정보 수집·이용
  sensitive: true;  // [필수] 민감정보(건강정보) 처리 — 개인정보 보호법 제23조, 따로 받는다
  agreedAt: string; // ISO 시각
};

export type MyPatient = { id: string; name: string; consent: Consent | null; created_at: string };

const COLUMNS = "id,name,consent,created_at";

async function myUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

function toMyPatient(row: Record<string, unknown>): MyPatient {
  return {
    id: String(row.id),
    name: typeof row.name === "string" ? row.name : "",
    consent: row.consent && typeof row.consent === "object" ? (row.consent as Consent) : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
  };
}

// 로그인한 계정의 환자 행. 없으면 null(처음 로그인 — 동의 화면으로).
// 조회 실패는 던진다 — "없음"과 "모름"을 섞으면 이미 쓰던 사람에게 동의를 다시 받고 환자를 또 만든다.
// user_id 조건을 직접 건다: 옛 빌드용 정책이 남아 있는 동안은 RLS만으로 내 행이 걸러지지 않는다.
export async function findMyPatient(): Promise<MyPatient | null> {
  const uid = await myUserId();
  if (!uid) return null;
  const { data, error } = await supabase.from("patients").select(COLUMNS).eq("user_id", uid).maybeSingle();
  if (error) throw error;
  return data ? toMyPatient(data) : null;
}

// 처음 로그인한 사람의 환자 행을 만든다. 동의 화면에서만 부른다.
// 두 번 눌렀거나 다른 기기에서 먼저 만들어져 user_id unique에 걸리면, 새로 만들지 않고 그 행을 쓴다.
export async function createMyPatient(name: string, consent: Consent): Promise<MyPatient> {
  const uid = await myUserId();
  if (!uid) throw new Error("로그인 세션이 없어요");
  const { data, error } = await supabase.from("patients")
    .insert({ name, user_id: uid, consent }).select(COLUMNS).single();
  if (error) {
    if (error.code === "23505") {
      const existing = await findMyPatient();
      if (existing) return existing.consent ? existing : recordMyConsent(existing.id, name, consent);
    }
    throw error;
  }
  return toMyPatient(data);
}

// 이미 있는 환자 행에 동의를 남긴다 — 옛 빌드에서 카카오를 연결해 둔 테스터는 서버가 계정에 묶어 주지만
// 동의 기록(consent)이 없다. 민감정보(건강) 동의는 따로 받아야 하므로(개인정보 보호법 제23조) 동의 화면을 거쳐 여기서 채운다.
export async function recordMyConsent(patientId: string, name: string, consent: Consent): Promise<MyPatient> {
  const uid = await myUserId();
  if (!uid) throw new Error("로그인 세션이 없어요");
  const { data, error } = await supabase.from("patients")
    .update({ name, consent }).eq("id", patientId).eq("user_id", uid).select(COLUMNS).single();
  if (error) throw error;
  return toMyPatient(data);
}

// 이 기기를 그 환자로 맞춘다 — 기존 화면들이 쓰는 환자 id·이름 자리를 채운다.
// 로그인까지 왔으면 소개 화면은 본 것이므로 다음 실행엔 다시 보이지 않게 표시한다.
export async function adoptPatient(row: Pick<MyPatient, "id" | "name">): Promise<void> {
  const previousPatientId = await getPatientId();
  if (previousPatientId && previousPatientId !== row.id) {
    // 세션이 다른 계정으로 바뀐 경우 이전 계정의 건강 데이터·알람·미전송 기록을 섞지 않는다.
    await notifee.cancelAllNotifications().catch(() => {});
    await Promise.all([
      clearLocalAlarmSchedules().catch(() => {}),
      clearIntakeOutbox().catch(() => {}),
      clearPendingAlarm().catch(() => {}),
    ]);
  }
  await setPatient(row.id);
  await setPatientName(row.name);
  await setOnboarded();
  // 같은 계정으로 오프라인 사용 뒤 재로그인한 경우 남은 기록을 재전송한다.
  void flushIntakeOutbox(row.id).catch(() => {});
}

// 로그인했나 — 기기에 환자 id가 있고 로그인 세션도 남아 있을 때.
// 세션은 저장소만 본다: 인터넷이 끊겨 토큰을 갱신하지 못했다고 로그인한 사람을 로그인 화면으로 보내지 않게.
// (환자 id만 있으면 로그인 전 옛 빌드의 흔적이다. 시작할 때 RootNavigator가 지운다.)
export async function isSignedIn(): Promise<boolean> {
  try {
    if (!(await getPatientId())) return false;
    return await hasStoredSession();
  } catch {
    return false;
  }
}

// 이 기기에서 내 흔적을 지운다 — 로그아웃·계정 삭제가 같이 쓴다.
//  · 예약된 알람: 남겨 두면 로그아웃한 뒤에도 남의(또는 지운) 약 알람이 울린다.
//  · 기기 저장값(환자 id·이름): 다음에 로그인하는 사람이 이 사람의 약장을 보게 된다.
//  · 1분 점검 초안: 남겨 두면 다음 사람의 환자로 저장(commit)될 수 있다.
//  · 로그인 세션.
// 소개 화면을 봤다는 표시만은 남긴다 — 다시 로그인하러 올 때 브랜드부터 넘기지 않게.
// 각 단계 실패는 다음 단계를 막지 않는다(하나라도 더 지우는 편이 낫다).
export async function clearLocalSession(): Promise<void> {
  await notifee.cancelAllNotifications().catch(() => {});
  // patientId를 먼저 지워 백그라운드 알림 액션이 로그아웃 중 새 outbox를 만들지 못하게 한다.
  await clearAll().catch((e) => console.warn("account: 기기 저장값 삭제 실패", e));
  await Promise.all([
    clearLocalAlarmSchedules().catch(() => {}),
    clearIntakeOutbox().catch(() => {}),
  ]);
  await clearDraft().catch(() => {});
  await signOut();
  await setOnboarded().catch(() => {});
}

// 계정 삭제 (App Store 5.1.1(v)) — 서버 함수가 로그인 계정을 지우고, 환자·일정·기록·알람 로그·
// 점검 결과는 외래 키 cascade로 함께 지워진다(migrate-auth-1-additive.sql delete_my_account).
// 서버 삭제가 실패하면 던진다 — 기기만 지우고 "삭제했어요"라고 하면 안 된다.
export async function deleteMyAccount(): Promise<void> {
  if (!(await myUserId())) throw new Error("로그인 세션이 없어요");
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw error;
  await clearLocalSession();
}

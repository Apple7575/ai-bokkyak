import { getPatientId } from "../lib/storage";
import { supabase, hasStoredSession } from "../lib/supabase";
import { adoptPatient, clearLocalSession, findMyPatient } from "../lib/account";
import { resyncAllAlarms } from "../lib/alarmSync";

// 시작할 때 로그인 상태 판정 — 회의 2026-10-08.
// 로그인 = 기기에 로그인 세션이 있고, 그 계정의 환자가 이 기기에 앉아 있다(환자 id). 환자 id가 없으면
// 서버에서 찾아 앉힌다(다른 기기에서 가입했거나, 동의까지 마친 직후 앱이 꺼진 경우).
//  · 세션은 있는데 인터넷 문제로 확인하지 못함 + 환자 id 있음 → 그대로 로그인으로 본다(홈).
//  · 환자 id만 있고 세션이 없음 → 로그인 전 옛 빌드의 흔적. 알람·저장값을 지우고 로그아웃 상태로.
//  · 세션만 있고 환자가 없음(동의 전에 멈춤) → 로그아웃 상태로 본다. 다시 로그인하면 동의로 간다.
// 서버를 기다리는 단계(토큰 갱신·내 환자 조회)는 시간을 제한한다 — 느린 인터넷에서 첫 화면이
// 빙글이만 돌면 안 된다. 시간이 넘으면 기기에 저장된 세션으로 판단한다.
const STARTUP_WAIT_MS = 5000;
function within<T, F>(p: Promise<T>, fallback: F): Promise<T | F> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), STARTUP_WAIT_MS);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      () => { clearTimeout(timer); resolve(fallback); },
    );
  });
}

export async function resolveSignedIn(): Promise<boolean> {
  const pid = await getPatientId();
  // undefined = 시간 안에 확인하지 못함, null = 세션 없음
  const session = await within(supabase.auth.getSession().then((r) => r.data.session), undefined);
  if (session) {
    if (pid) return true;
    // 없음(null)과 모름(undefined, 인터넷 문제) 모두 로그아웃 상태로 — 로그인 화면에서 다시 찾는다.
    const mine = await within(findMyPatient(), undefined);
    if (!mine) return false;
    await adoptPatient(mine);
    void resyncAllAlarms().catch(() => {});
    return true;
  }
  // 토큰 갱신이 인터넷 문제로 실패(또는 시간 초과)하면 세션 없이 돌아온다 — 기기에 세션이 남아 있으면
  // 로그인 상태다. (갱신이 거절된 세션은 supabase-js가 기기에서 지우므로 여기 걸리지 않는다.)
  if (await hasStoredSession()) return pid !== null;
  if (pid) await clearLocalSession();
  return false;
}

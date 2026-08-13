import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "./supabase";
import { parseKakaoProfile, parseAuthCallback, KakaoProfile } from "./kakaoProfile";

// 카카오 로그인 — 교체 가능한 좁은 경계.
// 화면은 signInWithKakao()와 signOutKakao()만 쓴다. 브라우저 세션·PKCE 교환 같은
// 세부는 전부 여기 숨긴다 (tts.ts/realtimeCall.ts와 같은 원칙).
//
// 흐름:
//   Supabase에 인가 URL 요청 → 앱 내 브라우저로 열기 → 카카오 로그인
//   → modubokyak://auth-callback?code=... 로 앱 복귀 → code를 세션으로 교환
//
// 주의: 이 파일이 동작하려면 app.json의 scheme("modubokyak")이 네이티브에 반영돼
// 있어야 한다. scheme 추가는 네이티브 변경이므로 재빌드가 필요하다.

export type KakaoSignInResult =
  | { ok: true; userId: string; profile: KakaoProfile }
  | { ok: false; canceled: boolean; message: string };

// 딥링크 콜백 주소. Supabase의 리다이렉트 허용목록에 등록돼 있어야 한다.
function callbackUrl(): string {
  return Linking.createURL("auth-callback");
}

export async function signInWithKakao(): Promise<KakaoSignInResult> {
  const redirectTo = callbackUrl();
  try {
    // 1) 인가 URL 발급. skipBrowserRedirect: RN에는 자동 이동시킬 주소창이 없다.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data?.url) {
      return { ok: false, canceled: false, message: "카카오 로그인을 시작하지 못했어요." };
    }

    // 2) 앱 내 브라우저로 열고 딥링크로 돌아올 때까지 기다린다.
    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (res.type === "cancel" || res.type === "dismiss") {
      return { ok: false, canceled: true, message: "로그인을 취소했어요." };
    }
    if (res.type !== "success" || !res.url) {
      return { ok: false, canceled: false, message: "카카오 로그인 화면을 열지 못했어요." };
    }

    // 3) 돌아온 주소에서 code를 꺼내 세션으로 교환한다.
    const parsed = parseAuthCallback(res.url);
    if (parsed.kind === "error") {
      return { ok: false, canceled: false, message: `카카오 로그인에 실패했어요. (${parsed.message})` };
    }
    if (parsed.kind !== "code") {
      return { ok: false, canceled: false, message: "카카오에서 인증 정보를 받지 못했어요." };
    }

    const ex = await supabase.auth.exchangeCodeForSession(parsed.code);
    if (ex.error || !ex.data?.user) {
      return { ok: false, canceled: false, message: "로그인 정보를 확인하지 못했어요." };
    }
    return {
      ok: true,
      userId: ex.data.user.id,
      profile: parseKakaoProfile(ex.data.user.user_metadata),
    };
  } catch {
    return { ok: false, canceled: false, message: "카카오 로그인 중 문제가 생겼어요." };
  } finally {
    // 안드로이드에서 인증 세션이 남아 다음 로그인이 막히는 것을 방지.
    try { WebBrowser.maybeCompleteAuthSession(); } catch {}
  }
}

// 지금 로그인된 카카오 계정의 사용자 id. 로그인 안 했으면 null.
export async function currentAuthUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function signOutKakao(): Promise<void> {
  try { await supabase.auth.signOut(); } catch {}
}

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import type { User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured, AUTH_STORAGE_KEY } from "./supabase";
import { parseAuthCallback, isUserCanceled, formatAppleFullName, bytesToHex } from "./authHelpers";

export { hasStoredSession } from "./supabase";
export { displayNameFrom, loginProviderLabel, loginProviderOf } from "./authHelpers";

// 간편 로그인 — 교체 가능한 좁은 경계 (회의 2026-10-08).
// 안드로이드는 카카오만, iOS는 카카오 + Apple(App Store 가이드라인 4.8). 이메일·전화·비밀번호는 없다.
// 화면은 이 파일의 함수만 쓴다. 브라우저·토큰 교환 세부는 여기 숨긴다.
//
// 카카오 흐름 (PKCE):
//   앱 → Supabase /auth/v1/authorize?provider=kakao → 카카오 로그인·동의
//      → Supabase /auth/v1/callback (카카오 콘솔에 등록한 Redirect URI)
//      → modubokyak://auth-callback?code=...   (Supabase Redirect URLs에 등록)
//      → exchangeCodeForSession(code) — 기기에 남겨 둔 code verifier로 세션을 받는다.
// 카카오 클라이언트 시크릿은 Supabase에만 있다. 앱에는 없다.

// 로그인 창이 앱으로 돌려보내는 주소. app.json의 scheme과 맞아야 한다.
export const AUTH_REDIRECT = "modubokyak://auth-callback";

export type SignInResult = { ok: true } | { ok: false; canceled: boolean; message: string };
export type AppleSignInResult =
  | { ok: true; appleFullName: string | null }
  | { ok: false; canceled: boolean; message: string };

const NETWORK = "인터넷 연결을 확인하고 다시 시도해 주세요.";
const fail = (message: string) => ({ ok: false as const, canceled: false, message });
const canceled = () => ({ ok: false as const, canceled: true, message: "로그인을 취소했어요." });

export async function signInWithKakao(): Promise<SignInResult> {
  if (!isSupabaseConfigured) return fail("로그인 설정이 없어요.");
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true },
    });
    if (error || !data?.url) return fail("카카오 로그인 화면을 열지 못했어요. " + NETWORK);

    const res = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT);
    if (res.type === "cancel" || res.type === "dismiss") return canceled();
    if (res.type !== "success" || !res.url) return fail("카카오 로그인 화면을 열지 못했어요.");

    const cb = parseAuthCallback(res.url);
    if (isUserCanceled(cb)) return canceled();
    if (cb.kind === "error") {
      console.warn("auth: 카카오 로그인 오류", cb.error, cb.message);
      return fail("카카오 로그인에 실패했어요. 다시 시도해 주세요.");
    }
    if (cb.kind !== "code") return fail("카카오에서 로그인 정보를 받지 못했어요.");

    const { error: exErr } = await supabase.auth.exchangeCodeForSession(cb.code);
    if (exErr) {
      console.warn("auth: 코드 교환 실패", exErr.message);
      return fail("로그인 정보를 확인하지 못했어요. " + NETWORK);
    }
    return { ok: true };
  } catch (e) {
    console.warn("auth: 카카오 로그인 예외", (e as Error)?.message ?? e);
    return fail("카카오 로그인 중 문제가 생겼어요. " + NETWORK);
  } finally {
    try { WebBrowser.maybeCompleteAuthSession(); } catch {}
  }
}

// Apple 로그인 (iOS 전용). nonce는 무작위 원문을 Supabase에, 그 SHA-256 해시를 Apple에 준다 —
// Supabase가 토큰 속 해시와 원문을 대조해 다른 곳에서 가로챈 토큰을 거른다.
// Apple은 이름을 처음 로그인할 때 한 번만 준다. 받은 이름은 돌려줘서 동의 화면 이름 칸을 채우고,
// 그 사이 앱이 꺼져도 남도록 계정 정보(user_metadata.full_name)에도 적어 둔다.
export async function signInWithApple(): Promise<AppleSignInResult> {
  if (Platform.OS !== "ios") return fail("이 휴대폰에서는 Apple 로그인을 쓸 수 없어요.");
  if (!isSupabaseConfigured) return fail("로그인 설정이 없어요.");
  try {
    if (!(await AppleAuthentication.isAvailableAsync())) return fail("이 휴대폰에서는 Apple 로그인을 쓸 수 없어요.");
    const rawNonce = bytesToHex(Crypto.getRandomBytes(32));
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
      nonce: hashedNonce,
    });
    if (!cred.identityToken) return fail("Apple에서 로그인 정보를 받지 못했어요.");

    const { error } = await supabase.auth.signInWithIdToken({ provider: "apple", token: cred.identityToken, nonce: rawNonce });
    if (error) {
      console.warn("auth: Apple 토큰 로그인 실패", error.message);
      return fail("로그인 정보를 확인하지 못했어요. " + NETWORK);
    }
    const appleFullName = formatAppleFullName(cred.fullName) || null;
    if (appleFullName) {
      // 이름 저장 실패는 로그인 실패가 아니다 — 동의 화면에서 직접 적으면 된다.
      try { await supabase.auth.updateUser({ data: { full_name: appleFullName } }); } catch {}
    }
    return { ok: true, appleFullName };
  } catch (e) {
    if ((e as { code?: string })?.code === "ERR_REQUEST_CANCELED") return canceled();
    console.warn("auth: Apple 로그인 예외", (e as Error)?.message ?? e);
    return fail("Apple 로그인 중 문제가 생겼어요. 다시 시도해 주세요.");
  }
}

// 이 기기의 로그인만 끝낸다(다른 기기의 로그인은 그대로).
// 인터넷이 없으면 서버 로그아웃이 실패하고 supabase-js가 세션을 기기에 남겨 둔다 —
// 그때는 기기에 저장된 세션을 직접 지워 "로그아웃했는데 로그인돼 있는" 일이 없게 한다.
export async function signOut(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (!error) return;
    console.warn("auth: 서버 로그아웃 실패 — 기기 세션만 지운다", error.message);
  } catch {}
  await AsyncStorage.multiRemove([AUTH_STORAGE_KEY, `${AUTH_STORAGE_KEY}-code-verifier`, `${AUTH_STORAGE_KEY}-user`]).catch(() => {});
}

// 지금 로그인한 계정. 기기에 저장된 세션에서 읽는다(토큰이 만료됐으면 갱신을 시도한다).
export async function currentUser(): Promise<User | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user ?? null;
  } catch {
    return null;
  }
}

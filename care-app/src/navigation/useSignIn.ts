import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { signInWithKakao, signInWithApple } from "../lib/auth";
import { adoptPatient, findMyPatient } from "../lib/account";
import { continueAfterLogin } from "./afterLogin";
import type { LoginPurpose } from "./types";

export type SignInKind = "kakao" | "apple";

// 간편 로그인 버튼 뒤의 일 — 로그인 화면과 점검 결과 화면(회의 2026-10-09: 결과 화면에서 바로 가입)이 같이 쓴다.
// 로그인 뒤: 이 계정의 환자가 있으면 이 기기에 앉히고 이어 가고(afterLogin), 없으면 동의 화면으로.
// medicines: purpose "save"일 때 방금 점검한 이름 — 로그인 뒤 이 이름 그대로 알람을 맞춘다.
export function useSignIn(purpose: LoginPurpose, medicines?: string[]) {
  const nav = useNavigation<any>();
  // 두 번 눌러 로그인 창이 두 번 뜨지 않게 — ref는 동기 가드, state는 버튼 문구·비활성용.
  const busyRef = useRef(false);
  const [busy, setBusy] = useState<SignInKind | null>(null);
  // 로그인 중에 화면을 떠났으면 늦게 끝난 실패 안내가 다른 화면 위에 뜨지 않게.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // 조회 실패는 "처음 가입"으로 넘기지 않는다(쓰던 사람에게 환자를 하나 더 만들게 된다).
  async function afterSignIn(appleFullName: string | null): Promise<void> {
    let mine;
    try {
      mine = await findMyPatient();
    } catch (e) {
      console.warn("useSignIn: 내 정보 조회 실패", (e as Error)?.message ?? e);
      if (mounted.current) Alert.alert("로그인하지 못했어요", "인터넷 연결을 확인하고 다시 시도해 주세요.");
      return;
    }
    if (mine) {
      await adoptPatient(mine);
      await continueAfterLogin(nav, { purpose, medicines, isNew: false });
      return;
    }
    nav.navigate("Consent", { purpose, medicines, appleFullName });
  }

  async function signIn(kind: SignInKind): Promise<void> {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(kind);
    try {
      if (kind === "kakao") {
        const r = await signInWithKakao();
        if (!r.ok) { if (!r.canceled && mounted.current) Alert.alert("카카오 로그인", r.message); return; }
        await afterSignIn(null);
      } else {
        const r = await signInWithApple();
        if (!r.ok) { if (!r.canceled && mounted.current) Alert.alert("Apple 로그인", r.message); return; }
        await afterSignIn(r.appleFullName);
      }
    } catch (e) {
      console.warn("useSignIn: 로그인 후 처리 실패", (e as Error)?.message ?? e);
      if (mounted.current) Alert.alert("로그인하지 못했어요", "잠시 후 다시 시도해 주세요.");
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  return { busy, signIn, isBusy: () => busyRef.current };
}

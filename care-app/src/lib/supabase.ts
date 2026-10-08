import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import type { IntakeStatus } from "./intakeStatus";
export type { IntakeStatus };

const extra = Constants.expoConfig?.extra ?? {};
const url = (extra.supabaseUrl as string) ?? "";
const anonKey = (extra.supabaseAnonKey as string) ?? "";

// True only when real creds are present. When false we still construct a client
// against a harmless placeholder URL so the app BOOTS (createClient throws on an
// invalid URL); any data call then fails gracefully into the existing Korean alerts.
export const isSupabaseConfigured =
  /^https?:\/\/.+/.test(url) && !url.startsWith("REPLACE") && anonKey.length > 0 && !anonKey.startsWith("REPLACE");

// 로그인 세션을 기기에 둘 때 쓰는 키. 이름을 정해 두는 건 인터넷이 없어 서버 로그아웃이
// 실패했을 때 기기 세션만이라도 지울 수 있게 하려는 것(auth.ts signOut).
export const AUTH_STORAGE_KEY = "care.auth";

// 로그인은 Supabase Auth(카카오·Apple 간편 로그인)로 한다 — 회의 2026-10-08.
// 서버가 사용자를 구분해야 RLS로 "내 행만"을 걸 수 있다(migrate-auth-1-additive.sql).
// 세션은 AsyncStorage에 남겨 앱을 다시 열어도 로그인이 유지된다. 앱으로 돌아오는 주소는
// 우리가 직접 처리하므로(auth.ts) URL에서 세션을 읽지 않고, 코드 교환은 PKCE로 한다.
export const supabase = createClient(
  isSupabaseConfigured ? url : "https://placeholder.supabase.co",
  isSupabaseConfigured ? anonKey : "placeholder-anon-key",
  {
    auth: {
      storage: AsyncStorage,
      storageKey: AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  }
);

// 기기에 로그인 세션이 남아 있나 — 네트워크 없이 저장소만 본다. 인터넷이 끊겨 토큰을
// 갱신하지 못한 때에도 로그인한 사람을 로그아웃된 사람으로 착각하지 않으려고 쓴다.
export async function hasStoredSession(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(AUTH_STORAGE_KEY)) !== null;
  } catch {
    return false;
  }
}

// 토큰 자동 갱신은 앱이 화면에 있을 때만 — 뒤에 있는 동안 타이머가 멈춰 있다가 한꺼번에 돌면
// 갱신이 꼬인다(Supabase의 React Native 권장 방식).
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

export type Patient = {
  id: string; name: string; created_at: string;
  gender?: string | null; birth_date?: string | null; region?: string | null; phone?: string | null;
  kakao_id?: string | null;       // 옛 카카오 연결의 회원번호 — 지금 앱은 쓰지 않는다(옛 빌드 호환용으로 남은 칸)
  user_id?: string | null;        // 로그인 계정(auth.users.id). 옛 빌드로 만든 환자는 null
  consent?: import("./account").Consent | null; // 처음 로그인 때 받은 약관·개인정보·민감정보 동의
};
export type Schedule = {
  id: string; patient_id: string; medicine_name: string;
  time_of_day: string; hour: number; minute: number;
  repeat_days: number[]; active: boolean; created_at: string;
  dose_amount?: string | null;   // "1정" / "1포" 등 표시 문자열 (없을 수 있음)
};
export type IntakeRecord = {
  id: string; patient_id: string; schedule_id: string;
  scheduled_for: string; status: IntakeStatus;
  response_method: "음성" | "버튼" | null; responded_at: string | null;
  created_at: string;
};
export type QuickCheckResult = {
  id: string; patient_id: string;
  items: {
    supplements: string[]; medicines: string[]; names: string[]; unmatched?: string[];
    /** 연령대·해당 항목 — 기록용, 분석에는 쓰지 않는다 */
    profile?: { age: string | null; conditions: string[] };
    // 아래는 commitQuickCheckDraft가 쓰는 값(quickCheckDraft.ts). 구버전 행에는 없다.
    /** 제품명 대조를 네트워크 문제로 못 한 채 저장된 결과인지 */
    durUnavailable?: boolean;
    /** 서버 판정 전용: 제품은 찾았지만 성분 매핑이 없던 원료명(로컬 판정이면 빈 배열) */
    unmappedIngredients?: string[];
    /** 서버가 판정하지 못한 기본 정보 라벨(신장질환 등, 로컬 판정이면 빈 배열) */
    uncoveredConditions?: string[];
    /** 판정 주체. 구버전 초안이면 null */
    engine?: "server" | "local" | null;
  };
  /** 규칙(source "rule") + 식약처 DUR(source "dur") 결과 — quickCheckRules.QuickFinding[] */
  findings: import("./quickCheckRules").QuickFinding[];
  created_at: string;
};

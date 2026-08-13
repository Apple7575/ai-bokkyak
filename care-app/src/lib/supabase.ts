import "react-native-url-polyfill/auto";
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

export const supabase = createClient(
  isSupabaseConfigured ? url : "https://placeholder.supabase.co",
  isSupabaseConfigured ? anonKey : "placeholder-anon-key",
  {
    auth: {
      // 카카오 로그인 세션을 기기에 남긴다 — 앱을 껐다 켜도 로그인이 유지돼야
      // 기기를 바꿔도 약이 따라온다는 약속을 지킬 수 있다.
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      // RN에는 주소창이 없다. 딥링크로 돌아온 code는 우리가 직접 교환한다(kakaoAuth.ts).
      detectSessionInUrl: false,
      // 모바일 앱에는 PKCE가 표준. 콜백으로 code만 오고 토큰은 직접 교환한다.
      flowType: "pkce",
    },
  }
);

export type Patient = {
  id: string; name: string; patient_code: string; created_at: string;
  gender?: string | null; birth_date?: string | null; region?: string | null; phone?: string | null;
  auth_user_id?: string | null;   // 카카오 로그인 계정과의 연결 (없으면 무인증 사용자)
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

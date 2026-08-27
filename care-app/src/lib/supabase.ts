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
  // 카카오 로그인은 Supabase Auth를 쓰지 않는다(kakaoAuth.ts 주석 참고).
  // 인증 세션을 만들지 않으므로 저장할 것도 없다.
  { auth: { persistSession: false } }
);

export type Patient = {
  id: string; name: string; created_at: string;
  gender?: string | null; birth_date?: string | null; region?: string | null; phone?: string | null;
  kakao_id?: string | null;       // 카카오 회원번호 (없으면 카카오 없이 가입한 사용자)
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
  items: { supplements: string[]; medicines: string[]; names: string[] };
  findings: import("./interactions").Finding[];
  created_at: string;
};

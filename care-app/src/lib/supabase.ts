import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

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
  { auth: { persistSession: false } }
);

export type Patient = {
  id: string; name: string; patient_code: string; created_at: string;
};
export type Schedule = {
  id: string; patient_id: string; medicine_name: string;
  time_of_day: string; hour: number; minute: number;
  repeat_days: number[]; active: boolean; created_at: string;
};
export type IntakeStatus = "복용완료" | "미복용" | "복용예정" | "재알림";
export type IntakeRecord = {
  id: string; patient_id: string; schedule_id: string;
  scheduled_for: string; status: IntakeStatus;
  response_method: "음성" | "버튼" | null; responded_at: string | null;
  created_at: string;
};

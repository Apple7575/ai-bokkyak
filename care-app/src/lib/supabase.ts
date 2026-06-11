import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra ?? {};
export const supabase = createClient(
  extra.supabaseUrl as string,
  extra.supabaseAnonKey as string,
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

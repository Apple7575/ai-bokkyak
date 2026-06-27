import Constants from "expo-constants";
import { validateOcrMedicines, ParsedSchedule } from "./parse";

// 약봉투 사진(base64 jpeg)을 Edge Function("ai", op=ocr)으로 보내 gpt-4o-mini 비전으로
// 복약 일정을 인식한다. OpenAI 키는 서버 뒤에 있고 앱은 anon 키로 함수만 호출.
const extra = Constants.expoConfig?.extra ?? {};
const SUPABASE_URL = (extra.supabaseUrl as string) ?? "";
const ANON = (extra.supabaseAnonKey as string) ?? "";
const FN = `${SUPABASE_URL}/functions/v1/ai`;

export async function gptOcrPrescription(base64: string): Promise<ParsedSchedule[]> {
  const res = await fetch(`${FN}?op=ocr`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64 }),
  });
  if (!res.ok) throw new Error(`ocr ${res.status}`);
  const json = await res.json();
  return validateOcrMedicines(JSON.parse(json.content ?? '{"medicines":[]}'));
}

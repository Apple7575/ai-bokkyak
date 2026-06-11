import Constants from "expo-constants";
import { validateParsedSchedule, ParseResult } from "./parse";

// OpenAI 키는 클라이언트에 두지 않는다. Supabase Edge Function("ai")이 서버
// 시크릿 OPENAI_API_KEY로 OpenAI를 대신 호출한다. 앱은 anon 키로 함수만 호출.
const extra = Constants.expoConfig?.extra ?? {};
const SUPABASE_URL = (extra.supabaseUrl as string) ?? "";
const ANON = (extra.supabaseAnonKey as string) ?? "";
const FN = `${SUPABASE_URL}/functions/v1/ai`;

export async function whisperTranscribe(fileUri: string): Promise<string> {
  const form = new FormData();
  form.append("file", { uri: fileUri, name: "audio.m4a", type: "audio/m4a" } as any);
  const res = await fetch(`${FN}?op=transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ANON}`, apikey: ANON },
    body: form,
  });
  if (!res.ok) throw new Error(`transcribe ${res.status}`);
  const json = await res.json();
  return (json.text as string) ?? "";
}

export async function gptParseSchedule(text: string): Promise<ParseResult> {
  const res = await fetch(`${FN}?op=parse`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`parse ${res.status}`);
  const json = await res.json();
  return validateParsedSchedule(JSON.parse(json.content ?? "{}"));
}

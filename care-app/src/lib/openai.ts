import Constants from "expo-constants";
import { validateParsedSchedule, ParseResult } from "./parse";

const KEY = (Constants.expoConfig?.extra?.openaiApiKey as string) ?? "";

export async function whisperTranscribe(fileUri: string): Promise<string> {
  const form = new FormData();
  form.append("file", { uri: fileUri, name: "audio.m4a", type: "audio/m4a" } as any);
  form.append("model", "whisper-1");
  form.append("language", "ko");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`whisper ${res.status}`);
  const json = await res.json();
  return (json.text as string) ?? "";
}

export async function gptParseSchedule(text: string): Promise<ParseResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content:
          '복약 문장에서 다음 JSON만 출력하세요. repeat_days는 매일이면 문자열 "매일", 특정 요일이면 정수 배열을 사용하고 0=일,1=월,2=화,3=수,4=목,5=금,6=토 규칙을 따르세요 (예: 월수금 → [1,3,5]). 형식: {"medicine_name":string,"time_of_day":"아침|점심|저녁|취침","hour":0-23,"minute":0-59,"repeat_days":"매일" 또는 number[]}.' },
        { role: "user", content: text },
      ],
    }),
  });
  if (!res.ok) throw new Error(`gpt ${res.status}`);
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? "{}";
  return validateParsedSchedule(JSON.parse(content));
}

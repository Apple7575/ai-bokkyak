import Constants from "expo-constants";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { ttsCacheKey } from "./ttsCache";

const extra = Constants.expoConfig?.extra ?? {};
const SUPABASE_URL = (extra.supabaseUrl as string) ?? "";
const ANON = (extra.supabaseAnonKey as string) ?? "";
const FN = `${SUPABASE_URL}/functions/v1/ai`;

let current: Audio.Sound | null = null;

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const g = global as any;
  return g.btoa ? g.btoa(bin) : Buffer.from(bin, "binary").toString("base64");
}

export async function speak(text: string, opts?: { speed?: number }): Promise<void> {
  const speed = opts?.speed ?? 0.85;
  try {
    await stopSpeaking();
    const path = `${FileSystem.cacheDirectory}${ttsCacheKey(text, speed)}`;
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
      const res = await fetch(`${FN}?op=tts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ text, speed }),
      });
      if (!res.ok) throw new Error(`tts ${res.status}`);
      const buf = await res.arrayBuffer();
      await FileSystem.writeAsStringAsync(path, bufToBase64(buf), {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync({ uri: path });
    current = sound;
    await sound.playAsync();
  } catch {
    // TTS 실패는 앱 흐름을 막지 않는다 (화면 텍스트로 진행).
  }
}

export async function stopSpeaking(): Promise<void> {
  if (current) {
    try { await current.stopAsync(); await current.unloadAsync(); } catch {}
    current = null;
  }
}

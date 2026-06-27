import Constants from "expo-constants";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { ttsCacheKey } from "./ttsCache";

const extra = Constants.expoConfig?.extra ?? {};
const SUPABASE_URL = (extra.supabaseUrl as string) ?? "";
const ANON = (extra.supabaseAnonKey as string) ?? "";
const FN = `${SUPABASE_URL}/functions/v1/ai`;

let current: Audio.Sound | null = null;
// 최신 재생 요청 식별 토큰. TTS는 네트워크로 음성을 받아오는 지연이 있어, 앞 요청이
// 아직 재생 전(current 미등록)일 때 다음 요청이 들어오면 둘 다 늦게 재생돼 겹친다.
// speak는 시작 시 토큰을 claim하고, 받아온 뒤 자기 토큰이 여전히 최신일 때만 재생한다.
let playToken = 0;

// 앱에 번들된 시간대 고정 음성(아침/점심/저녁/취침). 네트워크 없이 바로 재생 — iOS에서 가장 안정적.
const ALARM_SOUNDS: Record<string, number> = {
  아침: require("../../assets/sounds/morning.mp3"),
  점심: require("../../assets/sounds/noon.mp3"),
  저녁: require("../../assets/sounds/evening.mp3"),
  취침: require("../../assets/sounds/night.mp3"),
};

// 알람 화면 안내 — 번들 mp3 직접 재생(네트워크/포맷 의존 없음). 무음스위치여도 들리게 오디오모드 설정.
export async function playAlarmAnnouncement(timeOfDay: string): Promise<void> {
  const asset = ALARM_SOUNDS[timeOfDay] ?? ALARM_SOUNDS["아침"];
  try {
    await stopSpeaking();
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: true });
    const { sound } = await Audio.Sound.createAsync(asset);
    current = sound;
    await sound.playAsync();
  } catch {}
}

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

// 성공 시 true. 호출부에서 실패 시 번들 음성 등으로 폴백할 수 있게 결과를 돌려준다.
export async function speak(text: string, opts?: { speed?: number }): Promise<boolean> {
  const speed = opts?.speed ?? 0.95;
  await stopSpeaking();          // 진행 중인 음성 정지 + in-flight 요청 무효화
  const myToken = ++playToken;   // 이 요청을 최신으로 등록
  try {
    const path = `${FileSystem.cacheDirectory}${ttsCacheKey(text, speed)}`;
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
      // 네트워크 TTS는 타임아웃을 둔다. 오프라인/지연 시 무한 대기로 알람 안내가
      // 침묵하지 않게 — 호출부(AlarmScreen)가 false를 받아 번들 음성으로 폴백한다.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      let res: Response;
      try {
        res = await fetch(`${FN}?op=tts`, {
          method: "POST",
          headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, "Content-Type": "application/json" },
          body: JSON.stringify({ text, speed }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) throw new Error(`tts ${res.status}`);
      const buf = await res.arrayBuffer();
      await FileSystem.writeAsStringAsync(path, bufToBase64(buf), {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
    if (myToken !== playToken) return false; // 받아오는 사이 더 새로운 speak/stop가 끼어듦
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync({ uri: path });
    if (myToken !== playToken) { try { await sound.unloadAsync(); } catch {} return false; }
    current = sound;
    await sound.playAsync();
    return true;
  } catch {
    // TTS 실패는 앱 흐름을 막지 않는다 (화면 텍스트로 진행).
    return false;
  }
}

export async function stopSpeaking(): Promise<void> {
  playToken++; // 아직 재생 전인 in-flight speak를 무효화(늦게 도착해도 재생 안 됨)
  if (current) {
    try { await current.stopAsync(); await current.unloadAsync(); } catch {}
    current = null;
  }
}

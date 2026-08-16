import { Audio } from "expo-av";
import { CueId } from "./voiceScript";

// 사전 녹음 멘트 재생 — 교체 가능한 좁은 경계.
//
// 문서 §2 "고정 멘트 원칙": 정의된 멘트 ID의 녹음 파일만 재생한다.
// 이 파일은 텍스트를 받지 않는다 — 받을 수 있게 두면 언젠가 동적 문장이 섞이고,
// 승인되지 않은 발화가 나갈 길이 열린다. 오직 CueId만 받는다.
//
// 문서 §4 단계 4: V05 재생이 끝난 뒤 0.8초 간격으로 V06을 잇는다.

const GAP_MS = 800;

// 파일은 assets/voice/<ID>.mp3. require는 정적 경로만 받으므로 표로 나열한다.
const FILES: Record<CueId, number> = {
  V01: require("../../assets/voice/V01.mp3"),
  V02: require("../../assets/voice/V02.mp3"),
  V03: require("../../assets/voice/V03.mp3"),
  V04: require("../../assets/voice/V04.mp3"),
  V05: require("../../assets/voice/V05.mp3"),
  V06: require("../../assets/voice/V06.mp3"),
  V07: require("../../assets/voice/V07.mp3"),
  V08: require("../../assets/voice/V08.mp3"),
  V11: require("../../assets/voice/V11.mp3"),
  V12: require("../../assets/voice/V12.mp3"),
  V13: require("../../assets/voice/V13.mp3"),
  V14: require("../../assets/voice/V14.mp3"),
};

let current: Audio.Sound | null = null;
// 재생 순번. 중간에 다른 재생이 시작되면 이전 큐는 조용히 버린다
// (사용자가 답을 먼저 해버렸는데 지나간 안내가 계속 나오면 안 된다).
let token = 0;

// 지금 재생 중인 멘트. 화면이 에코 판정에 쓴다 —
// 마이크가 들은 말이 "지금 스피커로 나가는 그 말"인지 대조해야 하기 때문이다.
let playingId: CueId | null = null;

export function currentCueId(): CueId | null {
  return playingId;
}

async function unload(): Promise<void> {
  const s = current;
  current = null;
  if (!s) return;
  try { s.setOnPlaybackStatusUpdate(null); await s.stopAsync(); await s.unloadAsync(); } catch {}
}

export async function stopCues(): Promise<void> {
  token++;
  playingId = null;
  await unload();
}

// 멘트 하나를 끝까지 재생한다. 실패해도 throw하지 않는다 —
// 소리가 안 나더라도 화면 버튼으로 진행할 수 있어야 한다(문서 §2 음성·터치 병행).
async function playOne(id: CueId, mine: number): Promise<void> {
  if (mine !== token) return;
  playingId = id;
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: true });
    const { sound } = await Audio.Sound.createAsync(FILES[id]);
    if (mine !== token) { try { await sound.unloadAsync(); } catch {} return; }
    current = sound;
    await new Promise<void>((resolve) => {
      // 파일이 짧아도 상태 콜백이 안 오는 기기가 있어 안전장치를 둔다.
      const safety = setTimeout(resolve, 30000);
      const done = () => { clearTimeout(safety); resolve(); };
      sound.setOnPlaybackStatusUpdate((st) => {
        if (!st.isLoaded || st.didJustFinish) done();
      });
      sound.playAsync().catch(done);
    });
    if (current === sound) current = null;
    try { await sound.unloadAsync(); } catch {}
  } catch {
    // 재생 실패는 흐름을 막지 않는다.
  } finally {
    if (playingId === id && mine === token) playingId = null;
  }
}

// 멘트를 순서대로 재생한다. 사이 간격은 문서가 정한 0.8초.
// 재생이 끝나면 resolve — 화면은 이 시점에 마이크를 연다(자기 목소리를 듣지 않게).
export async function playCues(ids: CueId[]): Promise<void> {
  await stopCues();
  const mine = ++token;
  for (let i = 0; i < ids.length; i++) {
    if (mine !== token) return;
    await playOne(ids[i], mine);
    if (i < ids.length - 1) {
      await new Promise((r) => setTimeout(r, GAP_MS));
    }
  }
  if (mine === token) playingId = null;
}

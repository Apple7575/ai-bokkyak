# 케어(CARE) 음성·알림 고도화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 으로 태스크 단위 실행. 단계는 체크박스(`- [ ]`). 모든 보고/주석은 한국어.

**Goal:** 실시간 온디바이스 STT(말하는 중 글자 표시), OpenAI TTS 자연 음성(엣지 함수 프록시), Notifee 전체화면 알람을 도입해 고령층 사용성을 끌어올린다.

**Architecture:** 스왑 가능 인터페이스(`lib/stt.ts`, `lib/tts.ts`)와 엣지 함수 프록시 패턴을 유지·확장. STT는 `expo-speech-recognition`(온디바이스), TTS는 OpenAI `/v1/audio/speech`를 기존 `ai` 엣지 함수에 `op=tts`로 추가해 mp3 받아 `expo-av`로 재생, 알람은 `@notifee/react-native` full-screen intent. 데이터/스키마 변경 없음.

**Tech Stack:** React Native (Expo SDK 54), TypeScript, expo-speech-recognition, @notifee/react-native, expo-av, expo-file-system, Supabase Edge Function(Deno), jest.

---

## 공통 검증 (모든 태스크)

- `cd care-app && npx tsc --noEmit` → EXIT 0
- `npx jest` → 기존 21개 + 신규 테스트 통과
- 네이티브/실기기 동작은 §Task 8(빌드+수동 검증)에서 확인. JS 변경은 tsc/jest로 1차 검증.

## 핵심 전제

네이티브 모듈 추가 → **새 EAS 빌드 필요**(현재 배포 APK로는 동작 안 함). 코드는 먼저 작성·tsc/jest 통과시키고, Task 8에서 빌드 후 실기기(Android) 검증.

---

## Task 1: 네이티브 의존성 설치 + app.json 설정

**Files:**
- Modify: `care-app/package.json`, `care-app/app.json`

- [ ] **Step 1: 의존성 설치**

```bash
cd care-app
npx expo install expo-speech-recognition expo-file-system
npm install @notifee/react-native
```

- [ ] **Step 2: app.json에 plugins/권한 추가**

`care-app/app.json`의 `expo.plugins` 배열에 `expo-speech-recognition` 플러그인을 추가(권한 메시지 포함). 기존 plugins(expo-notifications, expo-av)는 유지:

```json
"plugins": [
  "expo-notifications",
  ["expo-av", { "microphonePermission": "음성으로 복약 응답과 약 등록을 하기 위해 마이크를 사용합니다." }],
  ["expo-speech-recognition", {
    "microphonePermission": "음성으로 복약 응답과 약 등록을 하기 위해 마이크를 사용합니다.",
    "speechRecognitionPermission": "음성을 글자로 바꾸기 위해 음성 인식을 사용합니다.",
    "androidSpeechServicePackages": ["com.google.android.googlequicksearchbox"]
  }]
]
```

`expo.android.permissions`에 알람 권한을 추가(기존 RECORD_AUDIO 유지, 중복 제거):

```json
"permissions": [
  "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.USE_FULL_SCREEN_INTENT",
  "android.permission.SCHEDULE_EXACT_ALARM",
  "android.permission.VIBRATE"
]
```

- [ ] **Step 3: JSON 유효성 + tsc 확인**

```bash
cd care-app
node -e "JSON.parse(require('fs').readFileSync('app.json','utf8')); console.log('app.json OK')"
npx tsc --noEmit && echo "tsc OK"
```
Expected: app.json OK, tsc OK.

- [ ] **Step 4: 커밋** (app.json은 실키 포함으로 skip-worktree일 수 있음 — `git status`로 확인. 추적 안 되면 package.json/lock만 커밋)

```bash
git add care-app/package.json care-app/package-lock.json
git status --short care-app/app.json   # skip-worktree면 안 보임(정상)
git -c user.name="cruel" -c user.email="ahn1st2024@gmail.com" commit -m "chore: add expo-speech-recognition, notifee, expo-file-system deps + permissions"
```

---

## Task 2: 엣지 함수에 op=tts 추가 + op=transcribe 제거

**Files:**
- Modify: `care-app/supabase/functions/ai/index.ts`

- [ ] **Step 1: `op=transcribe` 블록 제거, `op=tts` 블록 추가**

`care-app/supabase/functions/ai/index.ts`에서 `if (op === "transcribe") { ... }` 블록 전체를 삭제하고, `if (op === "parse")` 블록은 유지한 채 그 앞에 아래 `op=tts` 블록을 추가:

```ts
    if (op === "tts") {
      const { text, speed } = await req.json().catch(() => ({ text: "" }));
      if (!text) return json({ error: "no text" }, 400);
      const r = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "tts-1",
          voice: "nova",
          input: text,
          response_format: "mp3",
          speed: typeof speed === "number" ? speed : 0.9,
        }),
      });
      if (!r.ok) {
        const detail = await r.text();
        return json({ error: "tts failed", detail }, 502);
      }
      const audio = await r.arrayBuffer();
      return new Response(audio, {
        status: 200,
        headers: { ...CORS, "Content-Type": "audio/mpeg" },
      });
    }
```

(파일 상단 안내 주석의 엔드포인트 목록도 `?op=transcribe` → `?op=tts`로 갱신.)

- [ ] **Step 2: 배포** (Supabase 로그인 상태 필요)

```bash
cd care-app
npx supabase functions deploy ai --project-ref atzosfqrzsfrveympcfj --use-api
```
Expected: "Deployed Functions on project atzosfqrzsfrveympcfj: ai"

- [ ] **Step 3: tts 동작 테스트**

```bash
ANON="sb_publishable_IxiFvJXOgllELr1E69-u-Q_34H6Oz8a"
curl -s -o /tmp/tts.mp3 -w "HTTP %{http_code} | %{content_type} | %{size_download} bytes\n" \
  -X POST "https://atzosfqrzsfrveympcfj.supabase.co/functions/v1/ai?op=tts" \
  -H "Authorization: Bearer $ANON" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"text":"안석찬 님, 저녁 약을 복용할 시간입니다.","speed":0.9}'
file /tmp/tts.mp3
```
Expected: HTTP 200, content_type audio/mpeg, size > 1000 bytes, `file`이 "Audio"/"MPEG"로 인식.

- [ ] **Step 4: 커밋**

```bash
git add care-app/supabase/functions/ai/index.ts
git -c user.name="cruel" -c user.email="ahn1st2024@gmail.com" commit -m "feat: edge function op=tts (OpenAI TTS); remove op=transcribe"
```

---

## Task 3: TTS 캐시 키 (TDD) + lib/tts.ts 클라우드 재생

**Files:**
- Create: `care-app/src/lib/ttsCache.ts`
- Test: `care-app/src/__tests__/ttsCache.test.ts`
- Modify: `care-app/src/lib/tts.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// care-app/src/__tests__/ttsCache.test.ts
import { ttsCacheKey } from "../lib/ttsCache";

describe("ttsCacheKey", () => {
  it("같은 텍스트+속도는 같은 키", () => {
    expect(ttsCacheKey("안녕하세요", 0.9)).toBe(ttsCacheKey("안녕하세요", 0.9));
  });
  it("다른 텍스트는 다른 키", () => {
    expect(ttsCacheKey("안녕하세요", 0.9)).not.toBe(ttsCacheKey("안녕히가세요", 0.9));
  });
  it("다른 속도는 다른 키", () => {
    expect(ttsCacheKey("안녕하세요", 0.9)).not.toBe(ttsCacheKey("안녕하세요", 1.0));
  });
  it(".mp3 확장자로 끝난다", () => {
    expect(ttsCacheKey("안녕하세요", 0.9).endsWith(".mp3")).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
cd care-app && npx jest src/__tests__/ttsCache.test.ts
```
Expected: FAIL "Cannot find module '../lib/ttsCache'".

- [ ] **Step 3: 구현**

```ts
// care-app/src/lib/ttsCache.ts
// 텍스트+속도 → 안정적 캐시 파일명. 동일 멘트 반복 재요청 방지.
export function ttsCacheKey(text: string, speed: number): string {
  const s = `${speed}|${text}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  }
  return `tts_${(h >>> 0).toString(36)}.mp3`;
}
```

- [ ] **Step 4: 통과 확인**

```bash
cd care-app && npx jest src/__tests__/ttsCache.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: lib/tts.ts를 클라우드 async 재생으로 교체**

```ts
// care-app/src/lib/tts.ts
import Constants from "expo-constants";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { ttsCacheKey } from "./ttsCache";

// OpenAI TTS를 엣지 함수(ai?op=tts)로 프록시 받아 mp3 재생. 키는 서버에만.
// 교체 가능 인터페이스: 더 좋은 TTS로 바꿀 때 이 파일만 교체.
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
  // RN 환경의 global.btoa 사용 (Hermes 제공)
  return global.btoa ? global.btoa(bin) : Buffer.from(bin, "binary").toString("base64");
}

export async function speak(text: string, opts?: { speed?: number }): Promise<void> {
  const speed = opts?.speed ?? 0.9;
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
```

- [ ] **Step 6: tsc + jest + 커밋**

```bash
cd care-app && npx tsc --noEmit && npx jest
git add care-app/src/lib/ttsCache.ts care-app/src/__tests__/ttsCache.test.ts care-app/src/lib/tts.ts
git -c user.name="cruel" -c user.email="ahn1st2024@gmail.com" commit -m "feat: cloud OpenAI TTS playback via edge function + cache key (TDD)"
```

---

## Task 4: 실시간 STT 훅 (`useSpeechToText`) + lib/stt.ts 정리

**Files:**
- Create: `care-app/src/hooks/useSpeechToText.ts`
- Modify: `care-app/src/lib/stt.ts` (또는 삭제 후 훅으로 일원화 — 아래 참고)

- [ ] **Step 1: 훅 작성**

```ts
// care-app/src/hooks/useSpeechToText.ts
import { useCallback, useRef, useState } from "react";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

export type SpeechController = {
  transcript: string;      // 실시간 갱신(부분 결과 포함)
  listening: boolean;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
};

// 온디바이스 음성인식. interimResults로 말하는 중 transcript가 실시간 갱신되고,
// 발화 종료(isFinal/end) 시 onFinal(text) 호출.
export function useSpeechToText(onFinal?: (text: string) => void): SpeechController {
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useSpeechRecognitionEvent("result", (e: any) => {
    const text: string = e.results?.[0]?.transcript ?? "";
    setTranscript(text);
    if (e.isFinal) {
      setListening(false);
      if (text.trim()) onFinalRef.current?.(text);
    }
  });
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("error", () => setListening(false));

  const start = useCallback(async () => {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) throw new Error("음성 인식 권한 거부");
    setTranscript("");
    setListening(true);
    ExpoSpeechRecognitionModule.start({
      lang: "ko-KR",
      interimResults: true,
      continuous: false,
    });
  }, []);

  const stop = useCallback(() => {
    try { ExpoSpeechRecognitionModule.stop(); } catch {}
    setListening(false);
  }, []);

  const reset = useCallback(() => setTranscript(""), []);

  return { transcript, listening, start, stop, reset };
}
```

- [ ] **Step 2: lib/stt.ts 정리**

기존 `lib/stt.ts`의 `startRecording`/`stopAndTranscribe`는 더 이상 쓰지 않는다. 화면들이 훅으로 전환되므로(Task 5), `lib/stt.ts`를 삭제한다:

```bash
rm care-app/src/lib/stt.ts
```
(이후 Task 5에서 화면의 `../lib/stt` import를 `../hooks/useSpeechToText`로 교체. 삭제 시점에 tsc가 깨지므로 Task 5와 함께 커밋한다.)

- [ ] **Step 3: 커밋은 Task 5와 함께** (stt.ts 삭제만 하면 tsc가 깨지므로 단독 커밋 금지). 이 태스크에서는 훅 파일만 작성하고, 삭제+화면전환+커밋은 Task 5에서.

```bash
git add care-app/src/hooks/useSpeechToText.ts
# 아직 커밋하지 않는다 (Task 5에서 함께)
```

---

## Task 5: 마이크 화면 3곳 — 실시간 STT + await TTS

**Files:**
- Modify: `care-app/src/screens/AlarmScreen.tsx`, `STTResponseScreen.tsx`, `VoiceRegisterScreen.tsx`
- Delete: `care-app/src/lib/stt.ts` (Task 4에서 rm)

각 화면에서 `import { startRecording, stopAndTranscribe } from "../lib/stt";`를 제거하고 `import { useSpeechToText } from "../hooks/useSpeechToText";`로 교체. `recording` 로컬 state와 imperative `onMic`을 훅으로 대체. **다른 로직(recordIntake/doseSlot/nav/parse/scheduleReminders/에러 Alert)은 보존.**

- [ ] **Step 1: AlarmScreen — 훅 + 실시간 transcript**

`AlarmScreen`의 `recording` state와 `onMic`을 다음 패턴으로 교체. 최종 텍스트는 `classifyIntent`로 분기(기존 write/snooze 재사용):

```tsx
  // 컴포넌트 본문 상단(기존 state 자리)
  const onSpeechFinal = async (text: string) => {
    const intent = classifyIntent(text);
    if (intent === "복용완료") { await write("복용완료", "음성"); return; }
    if (intent === "미복용") { await write("미복용", "음성"); return; }
    if (intent === "재알림") { await snooze("음성"); return; }
    Alert.alert("잘 듣지 못했어요", "버튼으로 선택해 주세요.");
  };
  const speech = useSpeechToText(onSpeechFinal);

  const onMic = async () => {
    if (speech.listening) { speech.stop(); return; }
    try { await speech.start(); }
    catch { Alert.alert("마이크를 사용할 수 없어요", "마이크 권한을 확인하시거나 버튼으로 선택해 주세요."); }
  };
```

JSX에서 `MicButton`은 `recording={speech.listening}`로, 그 아래에 실시간 자막을 표시:

```tsx
  <MicButton recording={speech.listening} onPress={onMic} />
  {speech.transcript ? <Text style={styles.live}>{speech.transcript}</Text> : null}
```

`styles`에 추가: `live: { textAlign: "center", fontSize: fontSizes.body, color: colors.textSecondary, marginTop: spacing.md }`. (기존 `write`/`snooze`/`ready` 게이팅/버튼 폴백은 그대로.)

- [ ] **Step 2: STTResponseScreen — 동일 패턴**

`recording`/`heard`/`onMic` 제거하고 훅으로. 최종 텍스트로 intent 분기(commit "음성" / snooze):

```tsx
  const onSpeechFinal = async (text: string) => {
    const intent = classifyIntent(text);
    if (intent === "복용완료") { await commit("복용완료", "음성"); return; }
    if (intent === "미복용") { await commit("미복용", "음성"); return; }
    if (intent === "재알림") { await snooze(); return; }
  };
  const speech = useSpeechToText(onSpeechFinal);
  const onMic = async () => {
    if (speech.listening) { speech.stop(); return; }
    try { await speech.start(); }
    catch { Alert.alert("마이크를 사용할 수 없어요", "마이크 권한을 확인하시거나 버튼으로 선택해 주세요."); }
  };
```

JSX: 기존 "들은 내용" 표시를 `speech.transcript`로 연결, `MicButton recording={speech.listening}`. 버튼 2개(commit "버튼")는 폴백 유지.

- [ ] **Step 3: VoiceRegisterScreen — 훅 + GPT parse**

`recording`/`onMic` 제거. 최종 텍스트를 `gptParseSchedule`로:

```tsx
  const onSpeechFinal = async (text: string) => {
    setTranscript(text);
    try {
      const result = await gptParseSchedule(text);
      if (!result.ok) { Alert.alert("다시 말씀해 주세요", "예: 매일 아침 8시에 고혈압약 먹어요"); return; }
      setParsed(result.value);
      await speak(`${result.value.hour}시, ${result.value.medicine_name}으로 등록할까요?`);
    } catch { Alert.alert("인식 실패", "다시 시도해 주세요."); }
  };
  const speech = useSpeechToText(onSpeechFinal);
  const onMic = async () => {
    if (speech.listening) { speech.stop(); return; }
    try { await speech.start(); }
    catch { Alert.alert("마이크를 사용할 수 없어요", "마이크 권한을 확인하시거나 버튼으로 선택해 주세요."); }
  };
```

`transcript` state는 표시용으로 유지하되 `speech.transcript`를 실시간 자막으로도 노출. `confirm()`의 `await speak("복약 일정을 등록했습니다.")` 등 기존 TTS 호출은 모두 `await`로(이미 async). MicButton `recording={speech.listening}`.

- [ ] **Step 4: 모든 speak() 호출을 await로**

세 화면 + 어디든 `speak(...)` 호출부가 `await` 없이 있으면 `await speak(...)`로(핸들러는 이미 async). `import { speak } from "../lib/tts"` 유지.

- [ ] **Step 5: tsc + jest + 커밋 (stt.ts 삭제 포함)**

```bash
cd care-app && npx tsc --noEmit && npx jest
cd /Users/cruel/Desktop/AI-bokkyak
git add care-app/src/hooks/useSpeechToText.ts care-app/src/screens/AlarmScreen.tsx care-app/src/screens/STTResponseScreen.tsx care-app/src/screens/VoiceRegisterScreen.tsx
git rm care-app/src/lib/stt.ts
git -c user.name="cruel" -c user.email="ahn1st2024@gmail.com" commit -m "feat: live on-device STT (interim transcript) across mic screens; remove Whisper stt"
```
Expected: tsc EXIT 0, jest 25 통과(기존 21 + ttsCache 4).

---

## Task 6: Notifee 전체화면 알람 (`lib/notifications.ts`)

**Files:**
- Modify: `care-app/src/lib/notifications.ts`

- [ ] **Step 1: notifications.ts를 Notifee로 교체**

기존 export 시그니처(`ensurePermission`, `scheduleReminders(scheduleId, name, hour, minute, repeatDays): Promise<string[]>`, `scheduleSnooze(scheduleId, name, minutes): Promise<string[]>`, `cancel(id)`)를 **유지**하고 내부를 Notifee로:

```ts
// care-app/src/lib/notifications.ts
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AndroidCategory,
  TriggerType,
  RepeatFrequency,
} from "@notifee/react-native";
import { nextNotificationTime } from "./schedule";

let channelId: string | null = null;
async function ensureChannel(): Promise<string> {
  if (channelId) return channelId;
  channelId = await notifee.createChannel({
    id: "care-alarm",
    name: "복약 알람",
    importance: AndroidImportance.HIGH,
    sound: "default",
    vibration: true,
    visibility: AndroidVisibility.PUBLIC,
  });
  return channelId;
}

export async function ensurePermission(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= 1; // AUTHORIZED/PROVISIONAL
}

function androidAlarm(scheduleId: string, ch: string) {
  return {
    channelId: ch,
    category: AndroidCategory.ALARM,
    importance: AndroidImportance.HIGH,
    fullScreenAction: { id: "alarm", launchActivity: "default" },
    pressAction: { id: "alarm", launchActivity: "default" },
    loopSound: true,
    ongoing: true,
    autoCancel: false,
  };
}

// 빈 repeatDays = 매일(DAILY 반복). 요일 배열 = 각 요일 WEEKLY 반복.
export async function scheduleReminders(
  scheduleId: string, medicineName: string, hour: number, minute: number, repeatDays: number[]
): Promise<string[]> {
  const ch = await ensureChannel();
  const now = new Date();
  const base = {
    title: "복약 시간이에요",
    body: `${medicineName} 드실 시간입니다.`,
    data: { scheduleId },
    android: androidAlarm(scheduleId, ch),
  };
  const ids: string[] = [];
  if (repeatDays.length === 0) {
    const t = nextNotificationTime({ hour, minute, repeat_days: [] }, now);
    ids.push(await notifee.createTriggerNotification(base, {
      type: TriggerType.TIMESTAMP, timestamp: t.getTime(), repeatFrequency: RepeatFrequency.DAILY,
    }));
  } else {
    for (const d of repeatDays) {
      const t = nextNotificationTime({ hour, minute, repeat_days: [d] }, now);
      ids.push(await notifee.createTriggerNotification(base, {
        type: TriggerType.TIMESTAMP, timestamp: t.getTime(), repeatFrequency: RepeatFrequency.WEEKLY,
      }));
    }
  }
  return ids;
}

export async function scheduleSnooze(
  scheduleId: string, medicineName: string, minutes: number
): Promise<string[]> {
  const ch = await ensureChannel();
  const id = await notifee.createTriggerNotification(
    {
      title: "다시 알림",
      body: `${medicineName} 드실 시간입니다.`,
      data: { scheduleId },
      android: androidAlarm(scheduleId, ch),
    },
    { type: TriggerType.TIMESTAMP, timestamp: now30(minutes) }
  );
  return [id];
}

function now30(minutes: number): number {
  return new Date().getTime() + minutes * 60 * 1000;
}

export async function cancel(notificationId: string): Promise<void> {
  await notifee.cancelNotification(notificationId);
}
```

(기존 `setNotificationHandler`/expo-notifications import는 제거. `scheduleReminders`/`scheduleSnooze`의 호출부(ButtonRegister/VoiceRegister/Alarm)는 시그니처 동일이라 변경 불필요.)

- [ ] **Step 2: tsc + jest**

```bash
cd care-app && npx tsc --noEmit && npx jest
```
Expected: EXIT 0, 25 통과.

- [ ] **Step 3: 커밋**

```bash
git add care-app/src/lib/notifications.ts
git -c user.name="cruel" -c user.email="ahn1st2024@gmail.com" commit -m "feat: Notifee full-screen alarm notifications (daily/weekly triggers)"
```

---

## Task 7: Notifee 이벤트 → Alarm 화면 진입 (App.tsx + index.ts)

**Files:**
- Modify: `care-app/App.tsx`
- Modify: `care-app/index.ts`

- [ ] **Step 1: 백그라운드 이벤트 핸들러 등록 (index.ts)**

`care-app/index.ts`(엔트리)에 Notifee 백그라운드 이벤트 핸들러를 등록(registerRootComponent 호출 전/후 무관, 모듈 최상위):

```ts
import notifee, { EventType } from "@notifee/react-native";

// 백그라운드/종료 상태에서 알람 상호작용 처리 (네비게이션은 앱 켜진 뒤 App.tsx가 처리)
notifee.onBackgroundEvent(async ({ type, detail }) => {
  // 전체화면/탭 진입은 OS가 앱을 열고, App.tsx의 onForegroundEvent + getInitialNotification이 라우팅한다.
  void type; void detail;
});
```

(기존 `import { registerRootComponent } from "expo";` 및 `registerRootComponent(App)`는 유지.)

- [ ] **Step 2: App.tsx에서 Notifee 포그라운드/콜드스타트 라우팅**

`care-app/App.tsx`의 기존 `useEffect`(expo-notifications 리스너)를 Notifee 기반으로 교체. `navigateToAlarm`(이미 존재) 재사용:

```tsx
import notifee, { EventType } from "@notifee/react-native";
// ...
  useEffect(() => {
    // 콜드스타트: 알람으로 앱이 켜진 경우
    notifee.getInitialNotification().then((initial) => {
      const sid = initial?.notification?.data?.scheduleId as string | undefined;
      if (sid) navigateToAlarm(sid);
    });
    // 포그라운드: 알람 탭/전체화면 진입
    const unsub = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS || type === EventType.DELIVERED) {
        const sid = detail.notification?.data?.scheduleId as string | undefined;
        if (sid) navigateToAlarm(sid);
      }
    });
    return () => unsub();
  }, []);
```

(기존 `Notifications.addNotificationResponseReceivedListener`/`getLastNotificationResponseAsync`/`clearLastNotificationResponseAsync` 및 `import * as Notifications` 제거. `navigateToAlarm` 함수와 `navRef`는 그대로 유지.)

- [ ] **Step 3: tsc + jest + 커밋**

```bash
cd care-app && npx tsc --noEmit && npx jest
git add care-app/App.tsx care-app/index.ts
git -c user.name="cruel" -c user.email="ahn1st2024@gmail.com" commit -m "feat: route Notifee alarm events to Alarm screen (foreground + cold start)"
```

---

## Task 8: 빌드 + 실기기(Android) 검증

**Files:** 없음(빌드/검증)

- [ ] **Step 1: 개발 빌드 또는 preview APK 재빌드**

```bash
cd care-app
npx eas-cli@latest build -p android --profile preview --non-interactive --no-wait
```
빌드 ID를 받아 대시보드/`eas build:view <id>`로 완료 대기(무료 큐 변동). 완료 시 APK 설치.

- [ ] **Step 2: 실시간 STT 검증**

실기기에서 약 등록(음성) 또는 알람 응답 시 마이크 누름 → **말하는 동안 화면에 글자가 실시간으로 차오르는지** 확인. "먹었어요" → 복용완료 기록, "매일 아침 8시에 고혈압약" → 파싱 카드.
Expected: interim 자막 실시간 표시, 최종 처리 정상.

- [ ] **Step 3: TTS 검증**

알람/등록 확인 시 음성이 **기계음이 아니라 자연스러운 음성**으로 나오는지 확인.
Expected: OpenAI nova 음성 재생, 동일 멘트 두 번째는 캐시로 즉시.

- [ ] **Step 4: 전체화면 알람 검증**

약 등록(가까운 시간) → 폰 잠금 → 시간 도달 시 **잠금화면에서 전체화면 알람 + 소리/진동**, 탭/열기 시 Alarm 화면 진입(scheduleId 전달). 30분 재알림도 확인.
Expected: full-screen 알람 발화, Alarm 화면 진입. (안 뜨면 USE_FULL_SCREEN_INTENT/SCHEDULE_EXACT_ALARM 권한 및 Notifee Activity 설정 점검 — 필요 시 app.json android 설정 보완 후 재빌드.)

- [ ] **Step 5: 회귀 확인 + 배포**

홈/기록/보호자/버튼 등록 등 기존 흐름 정상 동작 확인. 이상 없으면 EAS Update OTA(`eas update --branch preview`)로 JS 반영 또는 새 APK 링크 공유.

---

## Self-Review 메모 (스펙 커버리지)

- §5-1 실시간 STT → Task 4(훅), Task 5(화면 3곳). Whisper op 제거 → Task 2. ✅
- §5-2 OpenAI TTS → Task 2(op=tts), Task 3(lib/tts.ts+캐시). ✅
- §5-3 Notifee 전체화면 알람 → Task 6(lib/notifications), Task 7(이벤트 라우팅), 권한 → Task 1. ✅
- §3 전제(새 빌드) / §8 검증 → Task 8. ✅
- §6 스키마 변경 없음 → 어떤 태스크도 DB 손대지 않음. ✅
- 시그니처 일관성: `scheduleReminders(scheduleId,name,hour,minute,repeatDays):Promise<string[]>`, `scheduleSnooze(...):Promise<string[]>`, `speak(text,opts?):Promise<void>`, `useSpeechToText(onFinal?):SpeechController` — 호출부와 일치. ✅
- YAGNI: nova 고정, 소니옥스/iOS critical-alert/ElevenLabs 제외. ✅
- 알려진 리스크: Notifee 전체화면 Activity 네이티브 설정은 빌드 후 검증 필요(Task 8 Step 4에 점검 분기 명시).

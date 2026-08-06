// AI 건강전화 — OpenAI Realtime API + WebRTC 통화 클라이언트.
//
// 이 파일은 교체 가능 경계다: 화면은 startCall/CallHandle/CallEvent만 사용하고
// WebRTC·OpenAI 세부는 전부 여기에 숨긴다. 나중에 Gemini Live 등 다른 음성
// 모델로 갈아탈 때 이 파일 하나만 재구현하면 된다 (tts.ts/stt.ts와 같은 원칙).
//
// 흐름: Edge Function(ai?op=realtime-token)에서 임시 키를 받고 → 마이크 획득 →
// RTCPeerConnection + 데이터 채널("oai-events") → OpenAI에 SDP offer POST →
// answer 적용. 이후 모델 이벤트(전사/도구 호출)는 데이터 채널로 수신한다.
//
// 알려진 한계: 연결 수립 중(startCall이 resolve하기 전, 최악 ~25초)에는 취소
// 수단이 없다 — 화면은 연결이 끝나 handle을 받은 뒤에만 end()로 끊을 수 있다.

import Constants from "expo-constants";
import { mediaDevices, RTCPeerConnection, MediaStream } from "react-native-webrtc";
import InCallManager from "react-native-incall-manager";
import { CallMed } from "./callTools";
import { sdpErrorMessage, tokenErrorMessage } from "./callErrors";

const extra = Constants.expoConfig?.extra ?? {};
const SUPABASE_URL = (extra.supabaseUrl as string) ?? "";
const ANON = (extra.supabaseAnonKey as string) ?? "";
const FN = `${SUPABASE_URL}/functions/v1/ai`;

export type CallState = "connecting" | "active" | "ended" | "error";

export type CallEvent =
  | { type: "state"; state: CallState; message?: string }
  | { type: "ai-transcript"; text: string; final: boolean }
  | { type: "user-transcript"; text: string }
  | { type: "tool-call"; name: string; argsJson: string; callId: string };

export type CallHandle = {
  end(): Promise<void>;
  sendToolResult(callId: string, output: string): void;
};

// react-native-webrtc의 d.ts는 'event-target-shim/index'에서 EventTarget을 가져오는데,
// 중첩 설치된 event-target-shim v6의 exports 맵에 "./index" 서브패스가 없어
// tsc(moduleResolution: bundler)가 타입을 해석하지 못한다. 그 결과 addEventListener가
// 타입에 안 보인다(런타임에는 존재). as any 남발 대신 우리가 쓰는 이벤트 표면만
// 좁게 선언해 아래에서 한 번씩만 단언한다.
type PcEventTarget = {
  addEventListener(type: "track", listener: (e: { streams: MediaStream[] }) => void): void;
  addEventListener(type: "connectionstatechange", listener: () => void): void;
};
type DcEventTarget = {
  addEventListener(type: "open", listener: () => void): void;
  addEventListener(type: "close", listener: () => void): void;
  addEventListener(type: "message", listener: (e: { data: unknown }) => void): void;
};

// 사용자에게 그대로 보여도 되는 한국어 오류임을 표시한다. fail()은 이 표식이
// 있는 메시지만 통과시키고, 네이티브/영어 오류는 기본 한국어 문구로 바꾼다.
function koreanError(message: string): Error {
  const err = new Error(message);
  (err as { userFacing?: boolean } & Error).userFacing = true;
  return err;
}

// Edge Function에서 Realtime 임시 클라이언트 시크릿을 발급받는다.
// 실패는 한국어 메시지로 throw — 호출부(화면)가 Alert로 노출한다.
// 서버가 model을 못 돌려주는 옛 배포본을 만나도 빈 model을 그대로 쓰지 않도록 하는 기본값.
// (빈 문자열을 ?model= 에 넣으면 OpenAI가 400을 반환한다.)
const DEFAULT_REALTIME_MODEL = "gpt-realtime";

async function fetchRealtimeToken(payload: {
  patientName?: string;
  gender?: string;
  meds: CallMed[];
  setup?: boolean;
}): Promise<{ value: string; model: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let res: Response;
  try {
    res = await fetch(`${FN}?op=realtime-token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    // 타임아웃(abort) 포함 네트워크 단계 실패.
    throw new Error("통화 준비에 실패했어요. 네트워크를 확인해 주세요.");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    // 서버가 감싼 OpenAI 오류(detail)까지 보고 원인별 안내로 바꾼다.
    const detail = await res.text().catch(() => "");
    throw new Error(tokenErrorMessage(res.status, detail));
  }
  const j = (await res.json().catch(() => null)) as { value?: unknown; model?: unknown } | null;
  if (!j || typeof j.value !== "string" || j.value === "") {
    throw new Error("통화 준비에 실패했어요. (임시 키 발급 안 됨)");
  }
  // 빈 문자열도 typeof는 "string"이므로 명시적으로 non-empty 검사 — 이게 400의 원인이었다.
  const model = typeof j.model === "string" && j.model ? j.model : DEFAULT_REALTIME_MODEL;
  return { value: j.value, model };
}

export async function startCall(opts: {
  patientName?: string;
  gender?: string;
  meds: CallMed[];
  // 가입 직후 프로필/복약 수집 통화면 true. 서버가 다른 도구·안내로 세션을 만든다.
  setup?: boolean;
  onEvent: (e: CallEvent) => void;
  // 앱 쪽 대기 인사말("안녕하세요, 모두의 복약입니다") 재생이 끝나는 시점.
  // 연결이 되고 이 promise가 resolve되면 AI 첫 발화(response.create)를 요청해,
  // 인사말이 끝나자마자 AI 목소리가 곧바로 이어지게 한다. 없으면 연결 즉시 요청.
  greetingDone?: Promise<void>;
}): Promise<CallHandle> {
  const { onEvent } = opts;

  // 화면 콜백이 throw해도 통화 내부 상태·자원 정리가 망가지지 않게 격리한다.
  // (데이터 채널 리스너 안에서 콜백이 던지면 네이티브 이벤트 디스패치로 예외가
  // 새어 나가 앱이 죽을 수 있다.)
  function safeEmit(e: CallEvent): void {
    try {
      onEvent(e);
    } catch {}
  }

  safeEmit({ type: "state", state: "connecting" });

  // 토큰 발급은 마이크를 잡기 전에 한다 — 여기서 실패하면 정리할 자원이 없고,
  // 스펙대로 throw해서 호출부가 Alert로 처리한다.
  const token = await fetchRealtimeToken({
    patientName: opts.patientName,
    gender: opts.gender,
    meds: opts.meds,
    setup: opts.setup,
  });

  let pc: RTCPeerConnection | null = null;
  let localStream: MediaStream | null = null;
  let dc: ReturnType<RTCPeerConnection["createDataChannel"]> | null = null;

  // 원격 오디오 스트림 참조. react-native-webrtc는 수신 오디오를 자동 재생하지만,
  // 참조를 잃으면 GC로 트랙이 정리될 수 있어 통화 동안 붙잡아 둔다.
  // (통화 인스턴스별 클로저 변수 — 재시도로 통화가 겹쳐도 서로 침범하지 않게.)
  let remoteStream: MediaStream | null = null;

  // 종결 상태(ended/error)는 정확히 1회만 발행한다. end()가 두 번 불리거나
  // error 후 end()가 불려도 두 번째 상태 이벤트는 나가지 않는다.
  let finished = false;
  let cleaned = false;

  // 한 응답에 도구가 여러 개 담겨 올 수 있다("아침 혈압약이랑 저녁 당뇨약 먹어요"
  // → add_medication 2회). 도구마다 response.create를 보내면 두 번째가
  // "이미 진행 중인 응답이 있다"로 거부돼 통화가 그대로 멈춘다.
  // 그래서 배치의 결과를 다 돌려준 뒤에 딱 한 번만 응답을 요청한다.
  const emittedCallIds = new Set<string>(); // 같은 call_id 중복 발행 방지
  const outstanding = new Set<string>();    // 아직 결과를 못 돌려준 도구
  let batchTimer: ReturnType<typeof setTimeout> | null = null;

  function clearBatchTimer(): void {
    if (batchTimer) { clearTimeout(batchTimer); batchTimer = null; }
  }

  function requestResponse(): void {
    clearBatchTimer();
    if (finished || !dc || dc.readyState !== "open") return;
    try { dc.send(JSON.stringify({ type: "response.create" })); } catch {}
  }

  // 자원 정리 — 멱등. 어느 단계에서 실패했든 마이크 트랙이 살아남지 않게 한다.
  function cleanup(): void {
    if (cleaned) return;
    cleaned = true;
    clearBatchTimer();
    try {
      dc?.close();
    } catch {}
    try {
      localStream?.getTracks().forEach((t) => t.stop());
    } catch {}
    try {
      pc?.close();
    } catch {}
    try {
      InCallManager.stop();
    } catch {}
    remoteStream = null;
  }

  // 오류 종결. finished를 먼저 세워 cleanup이 유발하는 close 이벤트가 ended를
  // 발행하지 못하게 하고, 자원 정리를 콜백보다 먼저 해서 콜백이 던져도 마이크가
  // 반드시 회수되게 한다. error가 종결 상태이므로 ended는 안 나간다.
  function fail(message: string): void {
    if (finished) return;
    finished = true;
    cleanup();
    safeEmit({ type: "state", state: "error", message });
  }

  // 정상 종결(우리 쪽 end() 또는 원격 종료) — ended 1회 발행.
  function finish(): void {
    if (finished) return;
    finished = true;
    cleanup();
    safeEmit({ type: "state", state: "ended" });
  }

  try {
    try {
      localStream = await mediaDevices.getUserMedia({ audio: true });
    } catch {
      // 실기기에서 가장 흔한 실패 — 네이티브 영어 메시지 대신 안내 문구로.
      throw koreanError("마이크 권한을 허용해 주세요.");
    }
    pc = new RTCPeerConnection();
    const pcEvents = pc as unknown as PcEventTarget; // 위 PcEventTarget 주석 참고

    // 원격 오디오는 자동 재생되므로 참조만 보관한다.
    pcEvents.addEventListener("track", (e) => {
      remoteStream = e.streams[0] ?? null;
    });

    pcEvents.addEventListener("connectionstatechange", () => {
      if (pc?.connectionState === "failed") {
        fail("통화 연결이 끊어졌어요.");
      } else if (pc?.connectionState === "closed") {
        // 원격/네트워크가 연결을 정상 종료한 경우 — 화면이 "통화 중"에 갇히지 않게.
        finish();
      }
    });

    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }

    dc = pc.createDataChannel("oai-events");
    const dcEvents = dc as unknown as DcEventTarget; // 위 DcEventTarget 주석 참고

    // 모델이 응답을 시작했는지 — 인사말 종료 후 첫 발화 요청(response.create)의
    // 중복 방지에 쓴다 (사용자 발화로 VAD가 먼저 응답을 트리거했을 수 있다).
    let responseStarted = false;

    dcEvents.addEventListener("open", () => {
      if (finished) return;
      // 통화용 오디오 라우팅: 이어피스가 아닌 스피커폰으로 — 고령층이 폰을 귀에
      // 안 대고도 들을 수 있게.
      InCallManager.start({ media: "audio" });
      InCallManager.setSpeakerphoneOn(true);
      safeEmit({ type: "state", state: "active" });
      // 인사말 재생이 끝난 뒤 AI 첫 발화를 요청한다. 그 사이 사용자가 말을 걸어
      // 모델이 이미 응답을 시작했으면(responseStarted) 중복 요청하지 않는다.
      void (opts.greetingDone ?? Promise.resolve()).then(() => {
        if (finished || responseStarted) return;
        if (!dc || dc.readyState !== "open") return;
        try {
          dc.send(JSON.stringify({ type: "response.create" }));
        } catch {}
      });
    });

    // 원격(서버)이 데이터 채널을 닫으면 정상 종결로 처리한다. 우리 쪽 cleanup이
    // 닫은 경우는 finished가 이미 true라 무시된다.
    dcEvents.addEventListener("close", () => {
      finish();
    });

    // AI 발화 전사는 delta로 조각조각 오므로 누적해서 화면에 통째로 전달한다.
    // barge-in으로 response가 취소되면 done이 안 올 수 있어, response_id가 바뀌면
    // 누적을 리셋해 이전 발화 잔여분에 다음 발화가 이어붙지 않게 한다.
    let aiTranscript = "";
    let aiResponseId: string | null = null;

    dcEvents.addEventListener("message", (e) => {
      if (finished) return; // 종결 후 큐에 남아 있던 메시지는 무시
      if (typeof e.data !== "string") return;
      // 모델 이벤트 JSON — 스키마를 다 알 수 없어 필요한 필드만 골라 쓴다.
      let event: any;
      try {
        event = JSON.parse(e.data);
      } catch {
        return; // 파싱 실패는 조용히 무시 (모르는 바이너리/깨진 프레임)
      }
      switch (event.type) {
        case "response.created":
          responseStarted = true;
          break;
        case "response.output_audio_transcript.delta": {
          const rid = typeof event.response_id === "string" ? event.response_id : null;
          if (rid !== aiResponseId) {
            aiTranscript = "";
            aiResponseId = rid;
          }
          aiTranscript += typeof event.delta === "string" ? event.delta : "";
          safeEmit({ type: "ai-transcript", text: aiTranscript, final: false });
          break;
        }
        case "response.output_audio_transcript.done":
          safeEmit({
            type: "ai-transcript",
            text: typeof event.transcript === "string" ? event.transcript : aiTranscript,
            final: true,
          });
          aiTranscript = "";
          aiResponseId = null;
          break;
        case "conversation.item.input_audio_transcription.completed":
          safeEmit({
            type: "user-transcript",
            text: typeof event.transcript === "string" ? event.transcript : "",
          });
          break;
        case "response.done": {
          const output: any[] = Array.isArray(event.response?.output) ? event.response.output : [];
          const batch: { name: string; argsJson: string; callId: string }[] = [];
          for (const item of output) {
            if (item?.type !== "function_call") continue;
            const name = typeof item.name === "string" ? item.name : "";
            const callId = typeof item.call_id === "string" ? item.call_id : "";
            // name/call_id 없는 항목은 결과를 돌려줄 수 없으므로 발행하지 않는다.
            if (!name || !callId) continue;
            if (emittedCallIds.has(callId)) continue; // 같은 response.done 재도착 방어
            emittedCallIds.add(callId);
            batch.push({
              name,
              argsJson: typeof item.arguments === "string" ? item.arguments : "{}",
              callId,
            });
          }
          if (batch.length === 0) break;
          // 먼저 전부 outstanding에 등록한 뒤 발행한다. 발행 도중 첫 도구의 결과가
          // 돌아와 outstanding이 잠깐 비면 response.create가 조기 발사되기 때문.
          for (const t of batch) outstanding.add(t.callId);
          // 화면이 어떤 이유로든 결과를 안 돌려주면 통화가 영영 멈추므로 안전망을 둔다.
          clearBatchTimer();
          batchTimer = setTimeout(() => { outstanding.clear(); requestResponse(); }, 10000);
          for (const t of batch) safeEmit({ type: "tool-call", ...t });
          break;
        }
        default:
          break; // 모르는 이벤트 타입은 무시
      }
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // OpenAI Realtime에 SDP offer를 보내고 answer를 받는다. 임시 키(ek_...) 사용.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let res: Response;
    try {
      res = await fetch(
        `https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(token.model)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token.value}`, "Content-Type": "application/sdp" },
          body: offer.sdp as string,
          signal: controller.signal,
        }
      );
    } catch {
      // 타임아웃(abort) 포함 — 영어 AbortError 메시지가 노출되지 않게.
      throw koreanError("통화 서버 연결에 실패했어요. 네트워크를 확인해 주세요.");
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      // 본문을 읽어 원인별 안내로 바꾼다(크레딧 소진 / 과부하 / 인증 / 서버 장애).
      const detail = await res.text().catch(() => "");
      throw koreanError(sdpErrorMessage(res.status, detail));
    }
    const answerSdp = await res.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
  } catch (e) {
    // 연결 수립 중 실패 — 마이크 등 자원을 반드시 회수하고 error로 종결한다.
    // 토큰 발급과 달리 여기서는 throw하지 않는다: 오류는 error 상태 이벤트로
    // 전달되고, 화면은 상태 이벤트 하나만 보고 처리한다. 우리가 만든 한국어
    // 오류(userFacing)만 메시지를 통과시키고 네이티브/영어 오류는 기본 문구로.
    const userFacing = e instanceof Error && (e as { userFacing?: boolean }).userFacing;
    fail(userFacing && e.message ? e.message : "통화 연결에 실패했어요.");
  }

  return {
    // 통화 종료 — 멱등. 두 번 불려도 안전하고 ended는 1회만 발행된다.
    async end(): Promise<void> {
      if (finished) {
        cleanup(); // 이미 error 등으로 종결됐어도 자원 회수는 보장한다
        return;
      }
      finish();
    },
    // 도구 실행 결과를 모델에 돌려준다. 채널이 닫혀 있으면 no-op.
    // 응답 요청(response.create)은 이 배치의 도구 결과가 전부 돌아온 뒤 한 번만 보낸다.
    sendToolResult(callId: string, output: string): void {
      if (!dc || dc.readyState !== "open") return;
      try {
        dc.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: { type: "function_call_output", call_id: callId, output },
          })
        );
      } catch {
        return; // 전송 실패 시 outstanding을 지우지 않는다 — 안전망 타이머가 회수한다.
      }
      outstanding.delete(callId);
      if (outstanding.size === 0) requestResponse();
    },
  };
}

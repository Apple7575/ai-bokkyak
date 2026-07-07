// AI 건강전화 — OpenAI Realtime API + WebRTC 통화 클라이언트.
//
// 이 파일은 교체 가능 경계다: 화면은 startCall/CallHandle/CallEvent만 사용하고
// WebRTC·OpenAI 세부는 전부 여기에 숨긴다. 나중에 Gemini Live 등 다른 음성
// 모델로 갈아탈 때 이 파일 하나만 재구현하면 된다 (tts.ts/stt.ts와 같은 원칙).
//
// 흐름: Edge Function(ai?op=realtime-token)에서 임시 키를 받고 → 마이크 획득 →
// RTCPeerConnection + 데이터 채널("oai-events") → OpenAI에 SDP offer POST →
// answer 적용. 이후 모델 이벤트(전사/도구 호출)는 데이터 채널로 수신한다.

import Constants from "expo-constants";
import { mediaDevices, RTCPeerConnection, MediaStream } from "react-native-webrtc";
import InCallManager from "react-native-incall-manager";
import { CallMed } from "./callTools";

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

// 원격 오디오 스트림 참조. react-native-webrtc는 수신 오디오를 자동 재생하지만,
// 참조를 잃으면 GC로 트랙이 정리될 수 있어 통화 동안 붙잡아 둔다.
let remoteStream: MediaStream | null = null;

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
  addEventListener(type: "message", listener: (e: { data: unknown }) => void): void;
};

// Edge Function에서 Realtime 임시 클라이언트 시크릿을 발급받는다.
// 실패는 한국어 메시지로 throw — 호출부(화면)가 Alert로 노출한다.
async function fetchRealtimeToken(
  patientName: string | undefined,
  meds: CallMed[]
): Promise<{ value: string; model: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let res: Response;
  try {
    res = await fetch(`${FN}?op=realtime-token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ patientName, meds }),
      signal: controller.signal,
    });
  } catch {
    // 타임아웃(abort) 포함 네트워크 단계 실패.
    throw new Error("통화 준비에 실패했어요. 네트워크를 확인해 주세요.");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new Error(`통화 준비에 실패했어요. (서버 오류 ${res.status})`);
  }
  const j = (await res.json().catch(() => null)) as { value?: unknown; model?: unknown } | null;
  if (!j || typeof j.value !== "string" || j.value === "") {
    throw new Error("통화 준비에 실패했어요. (임시 키 발급 안 됨)");
  }
  return { value: j.value, model: typeof j.model === "string" ? j.model : "gpt-realtime-2.1" };
}

export async function startCall(opts: {
  patientName?: string;
  meds: CallMed[];
  onEvent: (e: CallEvent) => void;
}): Promise<CallHandle> {
  const { onEvent } = opts;
  onEvent({ type: "state", state: "connecting" });

  // 토큰 발급은 마이크를 잡기 전에 한다 — 여기서 실패하면 정리할 자원이 없고,
  // 스펙대로 throw해서 호출부가 Alert로 처리한다.
  const token = await fetchRealtimeToken(opts.patientName, opts.meds);

  let pc: RTCPeerConnection | null = null;
  let localStream: MediaStream | null = null;
  let dc: ReturnType<RTCPeerConnection["createDataChannel"]> | null = null;

  // 종결 상태(ended/error)는 정확히 1회만 발행한다. end()가 두 번 불리거나
  // error 후 end()가 불려도 두 번째 상태 이벤트는 나가지 않는다.
  let finished = false;
  let cleaned = false;

  // 자원 정리 — 멱등. 어느 단계에서 실패했든 마이크 트랙이 살아남지 않게 한다.
  function cleanup(): void {
    if (cleaned) return;
    cleaned = true;
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

  // 오류 종결: error 상태 발행 후 정리. error가 종결 상태이므로 ended는 안 나간다.
  function fail(message: string): void {
    if (finished) return;
    finished = true;
    onEvent({ type: "state", state: "error", message });
    cleanup();
  }

  try {
    localStream = await mediaDevices.getUserMedia({ audio: true });
    pc = new RTCPeerConnection();
    const pcEvents = pc as unknown as PcEventTarget; // 위 PcEventTarget 주석 참고

    // 원격 오디오는 자동 재생되므로 참조만 보관한다.
    pcEvents.addEventListener("track", (e) => {
      remoteStream = e.streams[0] ?? null;
    });

    pcEvents.addEventListener("connectionstatechange", () => {
      if (pc?.connectionState === "failed") {
        fail("통화 연결이 끊어졌어요.");
      }
    });

    for (const track of localStream.getTracks()) {
      pc.addTrack(track, localStream);
    }

    dc = pc.createDataChannel("oai-events");
    const dcEvents = dc as unknown as DcEventTarget; // 위 DcEventTarget 주석 참고

    dcEvents.addEventListener("open", () => {
      if (finished) return;
      // 통화용 오디오 라우팅: 이어피스가 아닌 스피커폰으로 — 고령층이 폰을 귀에
      // 안 대고도 들을 수 있게.
      InCallManager.start({ media: "audio" });
      InCallManager.setSpeakerphoneOn(true);
      onEvent({ type: "state", state: "active" });
    });

    // AI 발화 전사는 delta로 조각조각 오므로 누적해서 화면에 통째로 전달한다.
    let aiTranscript = "";

    dcEvents.addEventListener("message", (e) => {
      if (typeof e.data !== "string") return;
      // 모델 이벤트 JSON — 스키마를 다 알 수 없어 필요한 필드만 골라 쓴다.
      let event: any;
      try {
        event = JSON.parse(e.data);
      } catch {
        return; // 파싱 실패는 조용히 무시 (모르는 바이너리/깨진 프레임)
      }
      switch (event.type) {
        case "response.output_audio_transcript.delta":
          aiTranscript += typeof event.delta === "string" ? event.delta : "";
          onEvent({ type: "ai-transcript", text: aiTranscript, final: false });
          break;
        case "response.output_audio_transcript.done":
          onEvent({
            type: "ai-transcript",
            text: typeof event.transcript === "string" ? event.transcript : aiTranscript,
            final: true,
          });
          aiTranscript = "";
          break;
        case "conversation.item.input_audio_transcription.completed":
          onEvent({
            type: "user-transcript",
            text: typeof event.transcript === "string" ? event.transcript : "",
          });
          break;
        case "response.done": {
          const output: any[] = Array.isArray(event.response?.output) ? event.response.output : [];
          for (const item of output) {
            if (item?.type === "function_call") {
              onEvent({
                type: "tool-call",
                name: String(item.name ?? ""),
                argsJson: typeof item.arguments === "string" ? item.arguments : "{}",
                callId: String(item.call_id ?? ""),
              });
            }
          }
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
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      throw new Error(`통화 서버 연결에 실패했어요. (오류 ${res.status})`);
    }
    const answerSdp = await res.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
  } catch (e) {
    // 연결 수립 중 실패 — 마이크 등 자원을 반드시 회수하고 error로 종결한다.
    // 토큰 발급과 달리 여기서는 throw하지 않는다: 오류는 error 상태 이벤트로
    // 전달되고(한국어 메시지 포함), 화면은 상태 이벤트 하나만 보고 처리한다.
    fail(e instanceof Error && e.message ? e.message : "통화 연결에 실패했어요.");
  }

  return {
    // 통화 종료 — 멱등. 두 번 불려도 안전하고 ended는 1회만 발행된다.
    async end(): Promise<void> {
      cleanup();
      if (finished) return; // 이미 error로 종결됐으면 ended를 덧붙이지 않는다
      finished = true;
      onEvent({ type: "state", state: "ended" });
    },
    // 도구 실행 결과를 모델에 돌려주고 다음 응답을 요청한다. 채널이 닫혀 있으면 no-op.
    sendToolResult(callId: string, output: string): void {
      if (!dc || dc.readyState !== "open") return;
      dc.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: { type: "function_call_output", call_id: callId, output },
        })
      );
      dc.send(JSON.stringify({ type: "response.create" }));
    },
  };
}

import { supabase } from "./supabase";

// 알파 테스트 지표용 알람 이벤트 로그.
// 'fired'  = 알람이 실제로 발생(알람 화면 진입)한 시각.
// 나머지    = 사용자 응답(완료/미루기/건너뛰기) 이벤트 — 발생과 대비해 반응 시간 산출.
// "undone": 완료 직후 "잘못 눌렀어요"로 되돌린 경우. 직전 completed 이벤트를 상쇄하는 보정 이벤트.
export type AlarmEventType = "fired" | "completed" | "snoozed" | "skipped" | "undone";

// 알람 이벤트를 alarm_events에 남긴다.
// 베스트에포트: 테이블 미생성/네트워크 실패 등 어떤 이유로도 예외를 던지지 않아,
// 복약 알람·기록 흐름을 절대 막지 않는다. (지표 수집은 부가 기능)
export async function logAlarmEvent(args: {
  patientId: string;
  scheduleId: string;
  scheduledFor: Date;
  type: AlarmEventType;
  method?: "음성" | "버튼" | null;
}): Promise<void> {
  try {
    await supabase.from("alarm_events").insert({
      patient_id: args.patientId,
      schedule_id: args.scheduleId,
      scheduled_for: args.scheduledFor.toISOString(),
      event_type: args.type,
      method: args.method ?? null,
    });
  } catch {
    // 무시 — 지표 로그 실패가 앱 동작에 영향 주지 않게.
  }
}

// 음성 가이드 온보딩 지표 (음성 대본 문서 §7 로그 항목).
// 알파 테스트에서 "어디서 막히는가"를 보려면 단계별 이탈과 폴백 비율이 필요하다.
//   · step            : 어느 단계에서 끝났나 (done / skipped)
//   · buttonFallback  : 버튼으로 진행한 횟수
//   · tapInterrupt    : 화면을 눌러 안내 음성을 끊은 횟수
//                       (많으면 멘트가 길어 답답하다는 뜻)
//
// noReply / fail / echoFiltered 는 음성 입력이 있던 시절의 지표라 지금은 항상 0이다.
// 컬럼을 지우지 않고 남겨 둔 것은 음성 입력을 되살릴 때 마이그레이션 없이 돌아오기
// 위해서다. 집계할 때 0만 나오는 것이 정상이다.
//
// 베스트에포트 — 실패해도 온보딩 흐름을 막지 않는다.
export async function logGuideEvent(args: {
  step: string;
  buttonFallback: number;
  /** 화면을 눌러 안내를 끊은 횟수 */
  tapInterrupt: number;
  noReply?: number;
  fail?: number;
  echoFiltered?: number;
}): Promise<void> {
  try {
    await supabase.from("voice_guide_events").insert({
      step: args.step,
      no_reply_count: args.noReply ?? 0,
      fail_count: args.fail ?? 0,
      button_fallback_count: args.buttonFallback,
      echo_filtered_count: args.echoFiltered ?? 0,
      tap_interrupt_count: args.tapInterrupt,
    });
  } catch {
    // 무시 — 지표 수집 실패가 앱 동작에 영향 주지 않게.
  }
}

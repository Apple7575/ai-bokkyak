// "가족·지인에게 1분 점검 보내기" 공유 문구 — 순수 로직(jest 대상).
// 시스템 공유 시트(RN Share)로 보낸다. 카카오 SDK는 없다 — 시트에 카카오톡이 뜬다.
// 분석 결과는 절대 넣지 않는다("내 분석 결과는 공유되지 않아요").
// "괜찮은지/안전한지 확인"처럼 안전을 보증하는 표현은 쓰지 않는다(스토어 의료 표현 심사 2026-10-04).

export const APP_STORE_URL = "https://apps.apple.com/app/id6797708328";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.care.bokyak";

// 받는 사람이 보낸 사람과 같은 플랫폼일 가능성이 높아 보낸 기기의 스토어 링크를 넣는다.
export function buildQuickCheckShareMessage(platform: "ios" | "android" | string = "ios"): string {
  return [
    "드시는 약과 영양제 중에 주의가 필요한 조합이 있는지 1분이면 확인해 볼 수 있어요.",
    "모두의 복약 앱에서 1분 복용 점검을 해보세요.",
    platform === "android" ? PLAY_STORE_URL : APP_STORE_URL,
  ].join(" ");
}

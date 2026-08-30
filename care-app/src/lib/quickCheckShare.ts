// "가족·지인에게 1분 점검 보내기" 공유 문구 — 순수 로직(jest 대상).
// 시스템 공유 시트(RN Share)로 보낸다. 카카오 SDK는 없다 — 시트에 카카오톡이 뜬다.
// 분석 결과는 절대 넣지 않는다("내 분석 결과는 공유되지 않아요").

export const APP_STORE_URL = "https://apps.apple.com/app/id6797708328";

export function buildQuickCheckShareMessage(): string {
  return [
    "약과 영양제를 함께 먹어도 괜찮은지 1분이면 확인할 수 있어요.",
    "모두의 복약 앱에서 1분 복용 점검을 해보세요.",
    APP_STORE_URL,
  ].join(" ");
}

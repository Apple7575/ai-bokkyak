// 알람 알림의 제목·본문 — 순수 로직 (RN 의존 없음, jest 대상).
//
// QA 2026-08-20:
//   ① 같은 시각에 알림이 두 개 떴는데 본문이 서로 달라("복용 완료를 눌러주세요" vs
//      "'지금 약 먹기'를 눌러주세요") 어느 쪽을 눌러야 하는지 알 수 없었다.
//      본문 생성을 이 파일 하나로 모아 두 경로가 갈라질 수 없게 한다.
//   ② "취침 약 복용 시간입니다"만으로는 어느 약인지 몰랐다. 약 이름을 제목에 넣는다.
//
// 약 이름이 없을 수 있다(옛 알림 data에 medName이 없거나, 조회 실패). 그때는
// 시간대만으로도 말이 되는 문구로 떨어진다 — 알람은 어떤 경우에도 떠야 한다.

/** 알림 제목에 넣을 약 이름의 최대 길이. 길면 잠금화면에서 잘려 시간대가 안 보인다. */
const MAX_NAME = 14;

function trimName(medName?: string | null): string {
  const n = (medName ?? "").trim();
  if (!n) return "";
  return n.length > MAX_NAME ? `${n.slice(0, MAX_NAME - 1)}…` : n;
}

/** 예: "고혈압약 드실 시간이에요" / 이름을 모르면 "아침 약 드실 시간이에요" */
export function alarmTitle(medName: string | null | undefined, slot: string): string {
  const n = trimName(medName);
  return n ? `${n} 드실 시간이에요` : `${slot} 약 드실 시간이에요`;
}

/** 두 경로(정시 알람·iOS 윈도우)가 같은 본문을 쓰도록 여기서만 만든다. */
export function alarmBody(medName: string | null | undefined, slot: string): string {
  const n = trimName(medName);
  // 제목이 약 이름이면 본문이 시간대를 알려주고, 제목이 시간대면 본문은 행동만 안내한다.
  return n
    ? `${slot} 약이에요. 드신 뒤 '지금 약 먹기'를 눌러 주세요.`
    : "약을 드신 뒤 '지금 약 먹기'를 눌러 주세요.";
}

/** 스누즈(다시 알림) 제목. 무엇을 다시 알리는지 이름을 유지한다. */
export function snoozeTitle(medName: string | null | undefined, slot: string): string {
  const n = trimName(medName);
  return n ? `다시 알림 — ${n}` : `다시 알림 — ${slot} 약`;
}

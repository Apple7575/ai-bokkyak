// 복약 시각을 자연스러운 한국어 음성 문장으로. TTS가 "22시"를 "스물두시"로 읽거나
// 분을 빠뜨리던 문제 해결 — 오전/오후 12시간제 + 분 포함.
export function spokenTime(hour: number, minute: number): string {
  const ap = hour < 12 ? "오전" : "오후";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const base = `${ap} ${h12}시`;
  return minute > 0 ? `${base} ${minute}분` : base;
}

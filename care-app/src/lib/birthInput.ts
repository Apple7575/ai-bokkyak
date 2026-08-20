// 생년월일 직접 입력의 정제·검증 — 순수 로직 (RN 의존 없음, jest 대상).
//
// QA 2026-08-20: 월 칸에 13 같은 값이 그대로 들어갔다. 저장 직전 buildBirthDate가
// 막긴 했지만, 어르신 입장에선 다 적고 [가입]을 누른 뒤에야 "확인해 주세요"를 본다.
// 애초에 못 들어가게 막고, 그래도 어긋나면 그 자리에서 이유를 알려준다.
//
// 왜 "잘라내기"가 아니라 "거부"인가:
//   월 칸에 1을 넣고 3을 더 누르면 13이 된다. 이때 12로 잘라 버리면 고르지도 않은
//   12월이 조용히 들어간다. 받아들이지 않고 1로 두면 사용자가 지우고 다시 친다.

export type BirthPart = "year" | "month" | "day";

const MAX: Record<BirthPart, number> = { year: 2100, month: 12, day: 31 };
const LEN: Record<BirthPart, number> = { year: 4, month: 2, day: 2 };

/**
 * 입력 한 글자마다 부르는 정제기. 받아들일 수 없는 입력이면 이전 값을 그대로 돌려준다.
 * (숫자가 아닌 문자 제거, 자릿수 초과 거부, 월 13·일 32 같은 값 거부.)
 */
export function sanitizeBirthPart(next: string, part: BirthPart, prev = ""): string {
  const digits = (next ?? "").replace(/[^0-9]/g, "");
  if (digits === "") return "";
  if (digits.length > LEN[part]) return prev;
  const n = Number(digits);
  // "0", "00"은 아직 타이핑 중일 수 있으니 지우진 않되, 연도는 앞자리 0을 허용하지 않는다.
  if (part === "year" && digits[0] === "0") return prev;
  if (n > MAX[part]) return prev;
  return digits;
}

/**
 * 세 칸을 합쳐 본 결과. 문제가 있으면 사람이 읽을 한국어 이유, 없으면 null.
 * 세 칸이 모두 비어 있으면 "입력 안 함"이라 문제로 보지 않는다(생년월일은 선택 입력).
 *
 * @param today 미래 날짜 판정 기준. 테스트에서 고정하기 위해 주입받는다.
 */
export function birthError(
  year: string, month: string, day: string, today: Date = new Date()
): string | null {
  const y = year.trim(), m = month.trim(), d = day.trim();
  if (!y && !m && !d) return null;
  if (!y || !m || !d) return "연·월·일을 모두 적어 주세요.";
  if (y.length < 4) return "연도는 네 자리로 적어 주세요. 예: 1954";

  const yn = Number(y), mn = Number(m), dn = Number(d);
  if (mn < 1 || mn > 12) return "월은 1부터 12까지예요.";
  if (dn < 1 || dn > 31) return "일은 1부터 31까지예요.";

  // 그 달에 실제로 있는 날인지 (2월 30일, 4월 31일 등).
  const dt = new Date(yn, mn - 1, dn);
  if (dt.getFullYear() !== yn || dt.getMonth() !== mn - 1 || dt.getDate() !== dn) {
    return `${mn}월에는 ${dn}일이 없어요.`;
  }

  if (dt.getTime() > today.getTime()) return "앞으로 올 날짜는 적을 수 없어요.";
  if (yn < 1900) return "연도를 다시 확인해 주세요. 예: 1954";
  return null;
}

/**
 * 세 숫자 → "YYYY-MM-DD" 또는 null(유효하지 않음).
 * 저장 직전의 마지막 관문. 화면 검증(birthError)과 별개로 여기서도 막는다 —
 * 저장 경로가 화면 하나뿐이라는 보장이 없다.
 *
 * (AI 건강전화가 음성으로 생년월일을 받던 시절 callTools.ts에 있던 함수다.
 *  음성 AI를 걷어내면서 생년월일 로직이 모인 이 파일로 옮겼다.)
 */
export function buildBirthDate(year: unknown, month: unknown, day: unknown): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const y = year as number, mo = month as number, d = day as number;
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const mm = String(mo).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  // 롤오버(존재하지 않는 날짜) 거부: 구성요소 라운드트립 확인.
  const dt = new Date(`${y}-${mm}-${dd}T00:00:00`);
  if (isNaN(dt.getTime()) || dt.getFullYear() !== y || dt.getMonth() + 1 !== mo || dt.getDate() !== d) {
    return null;
  }
  return `${y}-${mm}-${dd}`;
}

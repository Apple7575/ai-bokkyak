// 약 구분(처방약 / 일반약 / 건기식) — 순수 로직 (RN/네트워크 의존 없음, jest 대상).
//
// 회의 결정(D-01): 약과 건강기능식품은 아예 구분하고, 처방이 필요한 약은 따로
// 표시한다. 다만 우리가 가진 공공데이터(ATC 식약분류)는 약효분류라서 처방/일반을
// 판정할 수 없다. 그래서 순서는 이렇다:
//   1) 이름으로 확실히 알 수 있는 것만 자동 분류한다(건기식 키워드).
//   2) 모르면 null — AI에게 물어보거나 사용자가 직접 고른다.
// 이름만 보고 처방약/일반약을 추측하지 않는다. 틀린 분류는 없는 분류보다 나쁘다.

export type MedKind = "처방약" | "일반약" | "건기식";

export const MED_KINDS: readonly MedKind[] = ["처방약", "일반약", "건기식"] as const;

export function isMedKind(v: unknown): v is MedKind {
  return typeof v === "string" && (MED_KINDS as readonly string[]).includes(v);
}

// 건강기능식품으로 널리 쓰이는 이름들. 제품명에 이 단어가 들어가면 건기식으로 본다.
// (의약품에도 쓰이는 애매한 단어 — 예: "칼슘"이 들어간 처방약 — 는 넣지 않았다.)
const SUPPLEMENT_WORDS = [
  "비타민", "종합비타민", "멀티비타민", "오메가", "루테인", "밀크씨슬", "밀크시슬",
  "유산균", "프로바이오틱", "프리바이오틱", "홍삼", "흑삼", "산삼", "프로폴리스",
  "콜라겐", "글루코사민", "코엔자임", "코큐텐", "쏘팔메토", "아르기닌", "타우린",
  "엽산", "철분제", "마그네슘", "아연", "셀레늄", "크릴", "스피루리나", "클로렐라",
  "가르시니아", "차전자피", "이눌린", "보스웰리아", "MSM", "엠에스엠", "초유",
  "영양제", "건강식품", "건강기능식품",
];

// 비교용 정규화: 공백 제거 + 소문자. "오메가 3" 과 "오메가3" 을 같게 본다.
function norm(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

// 이름만으로 확신할 수 있으면 그 구분을, 아니면 null.
export function guessMedKind(name: string): MedKind | null {
  const n = norm(name);
  if (n === "") return null;
  for (const w of SUPPLEMENT_WORDS) {
    if (n.includes(norm(w))) return "건기식";
  }
  return null;
}

// 목록 화면의 그룹 순서. 중요한 것(처방약)이 위로 오고 미분류는 맨 아래.
export const KIND_ORDER: readonly (MedKind | "미분류")[] = ["처방약", "일반약", "건기식", "미분류"] as const;

// 구분별로 약을 묶는다. 값이 없거나 알 수 없으면 "미분류"로 모은다.
export function groupByKind<T>(
  items: T[],
  kindOf: (item: T) => MedKind | null | undefined
): { kind: MedKind | "미분류"; items: T[] }[] {
  const buckets = new Map<MedKind | "미분류", T[]>();
  for (const it of items) {
    const k = kindOf(it);
    const key: MedKind | "미분류" = isMedKind(k) ? k : "미분류";
    const arr = buckets.get(key);
    if (arr) arr.push(it);
    else buckets.set(key, [it]);
  }
  return KIND_ORDER.filter((k) => buckets.has(k)).map((k) => ({ kind: k, items: buckets.get(k) as T[] }));
}

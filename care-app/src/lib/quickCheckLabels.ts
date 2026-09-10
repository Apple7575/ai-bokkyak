// "1분 복용 점검" 화면의 버튼 라벨. **문자열 배열 상수만** 둔다 — scripts/check-server-labels.mjs가
// 이 파일을 정규식으로 읽어 라이브 서버(quick_check_v1)와 대조하므로 다른 코드를 넣지 말 것.
// 화면·로직은 quickCheck.ts가 재수출하는 이름을 쓴다.

// 칩 목록은 시안 V8 그대로 (PM 결정).
export const SUPPLEMENT_PRESETS = [
  "오메가3", "비타민D", "마그네슘", "유산균", "종합비타민", "철분", "루테인", "밀크씨슬",
] as const;
/** "더 보기"를 누르면 SUPPLEMENT_PRESETS 뒤에 이어 붙는 영양제 */
export const SUPPLEMENT_MORE = ["콜라겐", "아연", "홍삼", "단백질보충제"] as const;

export const MEDICINE_PRESETS = [
  "갑상선약", "혈압약", "고지혈증약", "위장약", "통증·소염제", "알레르기약", "피임약", "항우울제", "여드름약",
] as const;

// 3/3 기본 정보 — 연령대(단일 선택), 해당 항목(복수 선택, "해당 없음"은 나머지를 밀어낸다).
export const AGES = ["20대", "30대", "40대", "50대", "60대 이상"] as const;
export const CONDS = ["임신·수유 중", "신장질환", "간질환", "해당 없음"] as const;
export const NONE_CONDITION = "해당 없음";

/** 종류명 칩 전체(영양제 + 더 보기 + 복용약). 서버 응답에서 칩이 제대로 풀렸는지 검증할 때 쓴다. */
export const PRESET_LABELS: ReadonlySet<string> = new Set<string>([
  ...SUPPLEMENT_PRESETS, ...SUPPLEMENT_MORE, ...MEDICINE_PRESETS,
]);

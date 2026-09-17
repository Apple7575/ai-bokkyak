// "1분 복용 점검" — 판정 결과(QuickFinding)의 타입·등급 라벨·정렬. 순수 로직(RN/네트워크 의존 없음, jest 대상).
//
// 판정은 서버(quick_check_v1 RPC, quickCheckServer.ts) **전용**이다. 이 파일에 있던 앱 내장
// 상식 규칙(RULES/applyRules)은 2026-09-17에 제거됐다 — 오프라인 폴백을 두지 않기로 한 결정.
// 옛 규칙 표는 docs/quick-check-rules.md 에 약사 검수 요청용 참고로만 남아 있다.
//
// 문구 원칙(서버 문구에도 같은 원칙): 어르신용 쉬운 한국어, 단정 대신 "~할 수 있어 확인이 필요해요".
// 진단·처방처럼 읽히는 표현 금지. 결론은 항상 "약사·의료진과 확인".

export type RuleKind = "priority" | "timing" | "overlap" | "caution";
// priority=우선 확인 필요, timing=복용 시간 조정, overlap=중복·과다 확인, caution=주의사항

export type QuickFinding = {
  kind: RuleKind;
  a: string; b: string;          // 표시용 "A × B" (b는 질환·연령 라벨일 수 있다)
  title: string; message: string;
  tag: string;                   // "우선 확인 필요" | "복용 시간 확인 필요" | "중복 성분 확인" | "과다 복용 확인" | "주의사항"
  source: "rule" | "dur";
  notice_no?: string | null;
  // ↓ 서버 판정(quick_check_v1)이 채운다. 구버전 내장 규칙 결과·DUR 행에는 없다(하위 호환).
  /** 근거 수준: established | limited | conflicting | theoretical | none_known */
  evidenceLevel?: string;
  /** 권장 복용 간격(시간). 있으면 결과 카드에 "권장 간격: N시간"으로 보여 준다. */
  minSeparationHours?: number | null;
};

export const KIND_LABEL: Record<RuleKind, string> = {
  priority: "우선 확인 필요",
  timing: "복용 시간 조정",
  overlap: "중복·과다 확인",
  caution: "주의사항",
};

export const KIND_ORDER: RuleKind[] = ["priority", "timing", "overlap", "caution"];

export const TAG = {
  priority: "우선 확인 필요",
  timing: "복용 시간 확인 필요",
  overlap: "중복 성분 확인",
  excess: "과다 복용 확인",
  caution: "주의사항",
} as const;

/** kind 순서(우선 → 시간 → 중복 → 주의)로 안정 정렬. 같은 kind 안의 순서는 유지. */
export function sortFindings(findings: QuickFinding[]): QuickFinding[] {
  return findings
    .map((f, i) => ({ f, i }))
    .sort((x, y) => (KIND_ORDER.indexOf(x.f.kind) - KIND_ORDER.indexOf(y.f.kind)) || (x.i - y.i))
    .map((x) => x.f);
}

// 저장된 값이 이 빌드의 QuickFinding 모양인지(구버전 DUR Finding[] 구분용).
export function isQuickFinding(v: unknown): v is QuickFinding {
  if (!v || typeof v !== "object") return false;
  const f = v as Partial<QuickFinding>;
  return typeof f.kind === "string" && (KIND_ORDER as readonly string[]).includes(f.kind)
    && typeof f.title === "string" && typeof f.message === "string"
    && (f.source === "rule" || f.source === "dur");
}

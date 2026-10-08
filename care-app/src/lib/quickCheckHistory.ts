// 지난 복용 점검 — 서버에 저장된 결과 행(quick_check_results)을 목록·결과 화면 값으로 바꾼다.
// 순수 로직(RN/네트워크 의존 없음, jest 대상).
//
// items의 모양은 commitQuickCheckDraft(quickCheckDraft.ts)가 정한다. 옛 빌드가 저장한 행에는
// 없는 칸이 있으므로 하나씩 확인하고, 판정 결과(findings)가 지금 모양(QuickFinding)이 아니면
// 결과 화면을 열지 않는다 — 열면 종류별 색·이름을 찾지 못해 화면이 깨진다.

import { QuickFinding, isQuickFinding } from "./quickCheckRules";

export type QuickCheckResultParams = {
  findings: QuickFinding[]; names: string[]; unmatched: string[]; durUnavailable: boolean;
  unmappedIngredients: string[]; uncoveredConditions: string[]; engine?: "server" | "local";
  from: "history";
};

export type HistoryEntry = {
  id: string;
  createdAt: string;
  /** 점검한 이름(목록 한 줄) */
  names: string[];
  /** 확인이 필요한 조합 수. 결과를 읽지 못한 옛 행이면 null */
  findingsCount: number | null;
  /** 결과 화면 params. 옛 모양이라 열 수 없으면 null */
  params: QuickCheckResultParams | null;
};

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim().length > 0) : [];

export function historyEntry(row: { id?: unknown; created_at?: unknown; items?: unknown; findings?: unknown }): HistoryEntry {
  const items = (row.items && typeof row.items === "object" ? row.items : {}) as Record<string, unknown>;
  // names가 없던 옛 행은 영양제·약을 이어 붙여 쓴다.
  let names = strings(items.names);
  if (names.length === 0) names = [...strings(items.supplements), ...strings(items.medicines)];
  const findingsOk = Array.isArray(row.findings) && row.findings.every(isQuickFinding);
  const findings = findingsOk ? (row.findings as QuickFinding[]) : null;
  const engine = items.engine === "server" || items.engine === "local" ? items.engine : undefined;
  return {
    id: String(row.id ?? ""),
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
    names,
    findingsCount: findings ? findings.length : null,
    params: findings ? {
      findings, names,
      unmatched: strings(items.unmatched),
      durUnavailable: items.durUnavailable === true,
      unmappedIngredients: strings(items.unmappedIngredients),
      uncoveredConditions: strings(items.uncoveredConditions),
      engine,
      from: "history",
    } : null,
  };
}

/** "2026년 10월 8일" — 시각이 잘못됐으면 빈 문자열 */
export function koreanDate(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** "2026년 10월 8일 오후 2:05" */
export function koreanDateTime(iso: string): string {
  const day = koreanDate(iso);
  if (!day) return "";
  const d = new Date(iso);
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${day} ${h < 12 ? "오전" : "오후"} ${h12}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 목록 한 줄: 앞 3개 + "외 N개" */
export function historyNamesLine(names: string[]): string {
  if (names.length <= 3) return names.join(" · ");
  return `${names.slice(0, 3).join(" · ")} 외 ${names.length - 3}개`;
}

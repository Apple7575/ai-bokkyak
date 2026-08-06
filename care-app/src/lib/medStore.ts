import AsyncStorage from "@react-native-async-storage/async-storage";
import { MedKind, isMedKind, guessMedKind } from "./medKind";

// 약 구분·성분 조회 결과의 로컬 캐시.
//
// schedules 테이블에 컬럼을 추가하지 않고 기기에 저장한다:
//   · 구분은 "약 이름"의 성질이라 일정(schedule)마다 다를 이유가 없다.
//   · 성분 조회는 네트워크 왕복이 있어 매번 하면 화면이 느리다.
// 사용자가 직접 고른 값은 자동 추정보다 항상 우선한다.

const KIND_KEY = "care.medKind.v1";       // { [정규화된 약이름]: MedKind }
const ING_KEY = "care.medIngredients.v1"; // { [정규화된 약이름]: string[] }

function key(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase();
}

async function readMap<T>(k: string): Promise<Record<string, T>> {
  try {
    const raw = await AsyncStorage.getItem(k);
    if (!raw) return {};
    const j = JSON.parse(raw);
    return j && typeof j === "object" ? (j as Record<string, T>) : {};
  } catch {
    return {};
  }
}

// ── 약 구분 ────────────────────────────────────────────────────────────
export async function getKindMap(): Promise<Record<string, MedKind>> {
  const m = await readMap<unknown>(KIND_KEY);
  const out: Record<string, MedKind> = {};
  for (const [k, v] of Object.entries(m)) if (isMedKind(v)) out[k] = v;
  return out;
}

// 사용자가 고른 값 → 없으면 이름으로 자동 추정 → 그것도 없으면 null(미분류).
export function resolveKind(name: string, saved: Record<string, MedKind>): MedKind | null {
  return saved[key(name)] ?? guessMedKind(name);
}

export async function setKind(name: string, kind: MedKind): Promise<void> {
  const m = await getKindMap();
  m[key(name)] = kind;
  try { await AsyncStorage.setItem(KIND_KEY, JSON.stringify(m)); } catch {}
}

// ── 성분 캐시 ──────────────────────────────────────────────────────────
export async function getIngredientCache(): Promise<Record<string, string[]>> {
  const m = await readMap<unknown>(ING_KEY);
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(m)) {
    if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === "string");
  }
  return out;
}

export function cachedIngredients(name: string, cache: Record<string, string[]>): string[] | undefined {
  return cache[key(name)];
}

export async function setIngredients(name: string, ingredients: string[]): Promise<void> {
  const m = await getIngredientCache();
  m[key(name)] = ingredients;
  try { await AsyncStorage.setItem(ING_KEY, JSON.stringify(m)); } catch {}
}

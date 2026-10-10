import AsyncStorage from "@react-native-async-storage/async-storage";
import type { IntakeStatus } from "./supabase";

export type IntakeOutboxEntry = {
  key: string;
  operation: "upsert" | "delete";
  scheduleId: string;
  scheduledFor: string;
  status: IntakeStatus | null;
  method: "음성" | "버튼" | null;
  respondedAt: string | null;
  token: string;
};

type Envelope = { patientId: string; entries: IntakeOutboxEntry[] };
const KEY = "care.intakeOutbox.v1";
let storageChain: Promise<unknown> = Promise.resolve();

export function intakeOutboxKey(scheduleId: string, scheduledFor: string): string {
  return `${scheduleId}|${scheduledFor}`;
}

function validEntry(value: unknown): value is IntakeOutboxEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<IntakeOutboxEntry>;
  return typeof v.key === "string" && (v.operation === "upsert" || v.operation === "delete") &&
    typeof v.scheduleId === "string" && typeof v.scheduledFor === "string" && typeof v.token === "string";
}

function parseEnvelope(raw: string | null): Envelope | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Envelope>;
    if (typeof value.patientId !== "string" || !Array.isArray(value.entries)) return null;
    return { patientId: value.patientId, entries: value.entries.filter(validEntry) };
  } catch {
    return null;
  }
}

function locked<T>(work: () => Promise<T>): Promise<T> {
  const next = storageChain.then(work, work);
  storageChain = next.then(() => undefined, () => undefined);
  return next;
}

async function read(patientId: string): Promise<IntakeOutboxEntry[]> {
  const envelope = parseEnvelope(await AsyncStorage.getItem(KEY));
  return envelope?.patientId === patientId ? envelope.entries : [];
}

async function write(patientId: string, entries: IntakeOutboxEntry[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify({ patientId, entries } satisfies Envelope));
}

export async function enqueueIntakeMutation(patientId: string, entry: IntakeOutboxEntry): Promise<void> {
  await locked(async () => {
    const entries = await read(patientId);
    await write(patientId, [...entries.filter((e) => e.key !== entry.key), entry]);
  });
}

export async function listIntakeOutbox(patientId: string): Promise<IntakeOutboxEntry[]> {
  return locked(() => read(patientId));
}

// 같은 슬롯에 더 최근 의도가 들어온 경우 이전 요청의 성공 응답이 새 의도를 지우지 못하게 token을 비교한다.
export async function acknowledgeIntakeMutation(patientId: string, key: string, token: string): Promise<void> {
  await locked(async () => {
    const envelope = parseEnvelope(await AsyncStorage.getItem(KEY));
    // 로그아웃·계정 전환 뒤 도착한 이전 계정의 성공 응답은 현재 계정 envelope를 절대 덮지 않는다.
    if (!envelope || envelope.patientId !== patientId) return;
    await write(patientId, envelope.entries.filter((e) => e.key !== key || e.token !== token));
  });
}

export async function clearIntakeOutbox(): Promise<void> {
  await locked(() => AsyncStorage.removeItem(KEY));
}

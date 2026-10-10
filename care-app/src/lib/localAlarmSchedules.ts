import AsyncStorage from "@react-native-async-storage/async-storage";

// 다음 정시 알람을 네트워크 없이 다시 잡는 데 필요한 최소 일정 사본.
// 약 이름은 알림 본문에 필요하므로 포함하지만, 환자 이름·질환·복약 기록은 저장하지 않는다.
export type LocalAlarmSchedule = {
  id: string;
  medicineName: string;
  timeOfDay: string;
  hour: number;
  minute: number;
  repeatDays: number[];
};

type Envelope = { patientId: string; schedules: LocalAlarmSchedule[] };
const KEY = "care.alarmSchedules.v1";

function validSchedule(value: unknown): value is LocalAlarmSchedule {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<LocalAlarmSchedule>;
  return typeof v.id === "string" && typeof v.medicineName === "string" &&
    typeof v.timeOfDay === "string" && Number.isInteger(v.hour) && v.hour! >= 0 && v.hour! <= 23 &&
    Number.isInteger(v.minute) && v.minute! >= 0 && v.minute! <= 59 &&
    Array.isArray(v.repeatDays) && v.repeatDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
}

function parseEnvelope(raw: string | null): Envelope | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Envelope>;
    if (typeof value.patientId !== "string" || !Array.isArray(value.schedules)) return null;
    return { patientId: value.patientId, schedules: value.schedules.filter(validSchedule) };
  } catch {
    return null;
  }
}

async function read(patientId: string): Promise<LocalAlarmSchedule[]> {
  const envelope = parseEnvelope(await AsyncStorage.getItem(KEY));
  return envelope?.patientId === patientId ? envelope.schedules : [];
}

async function write(patientId: string, schedules: LocalAlarmSchedule[]): Promise<void> {
  const deduped = [...new Map(schedules.map((s) => [s.id, s])).values()];
  await AsyncStorage.setItem(KEY, JSON.stringify({ patientId, schedules: deduped } satisfies Envelope));
}

export async function listLocalAlarmSchedules(patientId: string): Promise<LocalAlarmSchedule[]> {
  return read(patientId);
}

export async function getLocalAlarmSchedule(patientId: string, scheduleId: string): Promise<LocalAlarmSchedule | null> {
  return (await read(patientId)).find((s) => s.id === scheduleId) ?? null;
}

export async function replaceLocalAlarmSchedules(patientId: string, schedules: LocalAlarmSchedule[]): Promise<void> {
  await write(patientId, schedules);
}

export async function upsertLocalAlarmSchedule(patientId: string, schedule: LocalAlarmSchedule): Promise<void> {
  const schedules = await read(patientId);
  await write(patientId, [...schedules.filter((s) => s.id !== schedule.id), schedule]);
}

export async function removeLocalAlarmSchedule(patientId: string, scheduleId: string): Promise<void> {
  await write(patientId, (await read(patientId)).filter((s) => s.id !== scheduleId));
}

export async function clearLocalAlarmSchedules(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}


import AsyncStorage from "@react-native-async-storage/async-storage";

export type Role = "patient" | "guardian";
const KEYS = { role: "care.role", patientId: "care.patientId", patientCode: "care.patientCode", onboarded: "care.onboarded" };

export async function getOnboarded(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.onboarded)) === "1";
}
export async function setOnboarded(): Promise<void> {
  await AsyncStorage.setItem(KEYS.onboarded, "1");
}

export async function getRole(): Promise<Role | null> {
  return (await AsyncStorage.getItem(KEYS.role)) as Role | null;
}
export async function setRole(role: Role): Promise<void> {
  await AsyncStorage.setItem(KEYS.role, role);
}
export async function getPatientId(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.patientId);
}
export async function setPatient(id: string, code: string): Promise<void> {
  await AsyncStorage.multiSet([[KEYS.patientId, id], [KEYS.patientCode, code]]);
}
export async function getPatientCode(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.patientCode);
}
export async function clearAll(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}

const PENDING = "care.pendingAlarm";
export async function setPendingAlarm(scheduleId: string): Promise<void> {
  await AsyncStorage.setItem(PENDING, scheduleId);
}
export async function takePendingAlarm(): Promise<string | null> {
  const v = await AsyncStorage.getItem(PENDING);
  if (v) await AsyncStorage.removeItem(PENDING);
  return v;
}

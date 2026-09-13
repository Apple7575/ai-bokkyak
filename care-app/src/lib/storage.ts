import AsyncStorage from "@react-native-async-storage/async-storage";

// 보호자 기능을 뺐다. 쓰는 사람은 본인 한 종류뿐이라 역할 구분도, 보호자에게
// 건네주던 6자리 코드도 없다. "가입했나"는 환자 id가 있느냐로 판단한다.
//
// care.role / care.patientCode 키는 더 쓰지 않지만 clearAll이 지울 수 있게
// 남겨 둔다 — 이전 버전을 쓰던 기기에 값이 남아 있다.
const KEYS = {
  patientId: "care.patientId",
  onboarded: "care.onboarded",
  patientName: "care.patientName",
  kakaoBannerDismissed: "care.kakaoBannerDismissed",
};
const LEGACY_KEYS = ["care.role", "care.patientCode"];

export async function getOnboarded(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.onboarded)) === "1";
}
export async function setOnboarded(): Promise<void> {
  await AsyncStorage.setItem(KEYS.onboarded, "1");
}

export async function getPatientId(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.patientId);
}
export async function setPatient(id: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.patientId, id);
}

// 이름은 결과·홈 인사말에 쓴다. 서버(patients.name)에도 있지만 화면을 열 때마다
// 조회하지 않도록 기기에 같이 둔다. 환자 id와 함께 clearAll()로 지워진다.
export async function getPatientName(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.patientName);
}
export async function setPatientName(name: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.patientName, name);
}

// 홈의 "카카오 연결" 배너를 ✕로 닫았는지. 한 번 닫으면 다시 띄우지 않는다(더보기에서 연결 가능).
export async function getKakaoBannerDismissed(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.kakaoBannerDismissed)) === "1";
}
export async function setKakaoBannerDismissed(): Promise<void> {
  await AsyncStorage.setItem(KEYS.kakaoBannerDismissed, "1");
}
export async function clearAll(): Promise<void> {
  await AsyncStorage.multiRemove([...Object.values(KEYS), ...LEGACY_KEYS]);
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

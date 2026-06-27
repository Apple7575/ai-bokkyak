import notifee, { AndroidNotificationSetting } from "@notifee/react-native";
import { Platform, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PROMPTED_KEY = "care.alarmPermPrompted";

/**
 * Android에서 '알람 및 리마인더' 권한이 활성화돼 있는지 확인한다.
 * iOS는 항상 true(정확알람 개념 없음).
 * 오류 발생 시 true를 반환해 불필요한 경고를 막는다.
 */
export async function hasExactAlarm(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  try {
    const s = await notifee.getNotificationSettings();
    return s.android?.alarm !== AndroidNotificationSetting.DISABLED;
  } catch {
    return true;
  }
}

/**
 * 첫 알람 등록 시 1회 호출. Android에서만 동작.
 * 시스템 설정 화면을 갑자기 띄우지 않고, 무엇을·왜 설정해야 하는지 먼저 안내한 뒤
 * 사용자가 "설정 열기"를 누를 때만 '알람 및 리마인더' 설정 화면을 연다.
 * (배터리 최적화 제외는 텍스트로 안내 — 갤럭시 등 기기마다 경로가 달라 자동으로 열지 않음.)
 * AsyncStorage 플래그로 가드해 약을 추가할 때마다 반복해서 뜨지 않게 한 번만 안내한다.
 */
export async function ensureStrongAlarmReady(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    if (await AsyncStorage.getItem(PROMPTED_KEY)) return;
  } catch {}
  await new Promise<void>((res) =>
    Alert.alert(
      "복약 알람 설정 안내",
      "정시에 정확히 울리려면 두 가지를 허용해 주세요.\n\n" +
        "① '알람 및 리마인더' 허용\n" +
        "② 배터리 최적화에서 '모두의 복약' 제외 (특히 갤럭시)\n\n" +
        "지금 '알람 및 리마인더' 설정을 열까요? (나중에 하셔도 됩니다)",
      [
        { text: "나중에", style: "cancel", onPress: () => res() },
        {
          text: "설정 열기",
          onPress: async () => {
            try { await notifee.openAlarmPermissionSettings(); } catch {}
            res();
          },
        },
      ],
      { cancelable: true, onDismiss: () => res() }, // 뒤로가기로 닫아도 반드시 resolve(등록 흐름 멈춤 방지)
    ),
  );
  try {
    await AsyncStorage.setItem(PROMPTED_KEY, "1");
  } catch {}
}

import notifee, { AndroidNotificationSetting } from "@notifee/react-native";
import { Platform, Alert } from "react-native";

/**
 * 첫 알람 등록 시 1회 호출.
 * Android에서만 동작하며, 정확 알람(SCHEDULE_EXACT_ALARM) 허용 여부를 확인하고
 * 사용자에게 안내한 뒤 배터리 최적화 설정 화면을 연다.
 */
export async function ensureStrongAlarmReady(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    const s = await notifee.getNotificationSettings();
    if (s.android?.alarm === AndroidNotificationSetting.DISABLED) {
      await new Promise<void>((res) =>
        Alert.alert(
          "정확한 알람 허용 필요",
          "정시에 울리려면 '알람 및 리마인더'를 허용해 주세요.",
          [
            { text: "나중에", onPress: () => res() },
            {
              text: "설정 열기",
              onPress: async () => {
                try {
                  await notifee.openAlarmPermissionSettings();
                } catch {}
                res();
              },
            },
          ],
        ),
      );
    }
    try {
      await notifee.openBatteryOptimizationSettings();
    } catch {}
  } catch {}
}

import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { RootStackParamList } from "./src/navigation/types";

export const navRef = createNavigationContainerRef<RootStackParamList>();

function navigateToAlarm(scheduleId: string | undefined, attempt = 0) {
  if (navRef.isReady()) {
    navRef.navigate("Alarm", { scheduleId });
  } else if (attempt < 50) {
    setTimeout(() => navigateToAlarm(scheduleId, attempt + 1), 100);
  }
}

export default function App() {
  useEffect(() => {
    let handled = false;
    const open = async (resp: Notifications.NotificationResponse | null) => {
      if (!resp || handled) return;
      handled = true;
      const scheduleId = resp.notification.request.content.data?.scheduleId as string | undefined;
      navigateToAlarm(scheduleId);
      try { await Notifications.clearLastNotificationResponseAsync(); } catch {}
    };
    // cold start: app launched by tapping a notification
    Notifications.getLastNotificationResponseAsync().then(open);
    // warm/background taps
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      handled = false; // allow subsequent taps
      open(resp);
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navRef}>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

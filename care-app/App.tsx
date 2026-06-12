import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import notifee, { EventType } from "@notifee/react-native";
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
    notifee.getInitialNotification().then((initial) => {
      const sid = initial?.notification?.data?.scheduleId as string | undefined;
      if (sid) navigateToAlarm(sid);
    });
    const unsub = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS || type === EventType.DELIVERED) {
        const sid = detail.notification?.data?.scheduleId as string | undefined;
        if (sid) navigateToAlarm(sid);
      }
    });
    return () => unsub();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navRef}>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { RootStackParamList } from "./src/navigation/types";

export const navRef = createNavigationContainerRef<RootStackParamList>();

export default function App() {
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const scheduleId = resp.notification.request.content.data?.scheduleId as string | undefined;
      if (navRef.isReady()) navRef.navigate("Alarm", { scheduleId });
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

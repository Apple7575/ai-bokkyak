import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import notifee from "@notifee/react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RootStackParamList, TabParamList } from "./types";
import { getPatientId, getOnboarded } from "../lib/storage";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { SplashScreen } from "../screens/SplashScreen";
import { RoleSelectScreen } from "../screens/RoleSelectScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { RecordScreen } from "../screens/RecordScreen";
import { RegisterMethodScreen } from "../screens/RegisterMethodScreen";
import { VoiceGuideScreen } from "../screens/VoiceGuideScreen";
import { ButtonRegisterScreen } from "../screens/ButtonRegisterScreen";
import { OcrRegisterScreen } from "../screens/OcrRegisterScreen";
import { MedicineSearchScreen } from "../screens/MedicineSearchScreen";
import { DoseTimeScreen } from "../screens/DoseTimeScreen";
import { AlarmScreen } from "../screens/AlarmScreen";
import { SnoozePickerScreen } from "../screens/SnoozePickerScreen";
import { SnoozeCountdownScreen } from "../screens/SnoozeCountdownScreen";
import { CheckupScreen } from "../screens/CheckupScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { AlarmSoundScreen } from "../screens/AlarmSoundScreen";
import { VoiceSpeedScreen } from "../screens/VoiceSpeedScreen";
import { PrivacyScreen } from "../screens/PrivacyScreen";
import { CabinetScreen } from "../screens/CabinetScreen";
import { MedicineDetailScreen } from "../screens/MedicineDetailScreen";
import { InteractionScreen } from "../screens/InteractionScreen";
import { CareCabinetIcon, CareHomeIcon, CareMoreIcon, CareRecordIcon } from "../components/CareIcons";
import { colors, shadows } from "../theme/tokens";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function TabIconBackground({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return <View style={[styles.tabIconBackground, focused && styles.tabIconBackgroundActive]}>{children}</View>;
}

function PatientTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryBlue,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarHideOnKeyboard: true,
        tabBarStyle: [styles.tabBar, { height: 72 + insets.bottom, paddingBottom: 10 + insets.bottom }],
        tabBarItemStyle: styles.tabItem,
        tabBarIconStyle: styles.tabIcon,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "홈", tabBarIcon: ({ color, focused }) => <TabIconBackground focused={focused}><CareHomeIcon size={27} color={color} accent={focused ? colors.coral : color} /></TabIconBackground> }} />
      <Tab.Screen name="Cabinet" component={CabinetScreen} options={{ title: "약 보관함", tabBarIcon: ({ color, focused }) => <TabIconBackground focused={focused}><CareCabinetIcon size={27} color={color} accent={focused ? colors.coral : color} /></TabIconBackground> }} />
      <Tab.Screen name="Record" component={RecordScreen} options={{ title: "복약 기록", tabBarIcon: ({ color, focused }) => <TabIconBackground focused={focused}><CareRecordIcon size={27} color={color} accent={focused ? colors.coral : color} /></TabIconBackground> }} />
      <Tab.Screen name="More" component={SettingsScreen} options={{ title: "더보기", tabBarIcon: ({ color, focused }) => <TabIconBackground focused={focused}><CareMoreIcon size={27} color={color} accent={focused ? colors.coral : color} /></TabIconBackground> }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const [init, setInit] = useState<{ signedUp: boolean; onboarded: boolean } | "loading">("loading");
  const [alarmSid, setAlarmSid] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const signedUp = (await getPatientId()) !== null;
      const onboarded = await getOnboarded();
      try {
        const initial = await notifee.getInitialNotification();
        const sid = initial?.notification?.data?.scheduleId as string | undefined;
        if (sid) setAlarmSid(sid);
      } catch {
        // 알림으로 시작하지 않은 일반 진입은 그대로 진행한다.
      }
      setInit({ signedUp, onboarded });
    })();
  }, []);

  if (init === "loading") {
    return <View style={styles.loading}><ActivityIndicator size="large" color={colors.primaryBlue} /></View>;
  }

  const initialRouteName: keyof RootStackParamList = alarmSid
    ? "Alarm"
    : !init.signedUp && !init.onboarded
      ? "Splash"
      : !init.signedUp
        ? "RoleSelect"
        : "Tabs";

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false, contentStyle: styles.stack, animation: "slide_from_right" }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
      <Stack.Screen name="Tabs" component={PatientTabs} />
      <Stack.Screen name="VoiceGuide" component={VoiceGuideScreen} />
      <Stack.Screen name="RegisterMethod" component={RegisterMethodScreen} />
      <Stack.Screen name="ButtonRegister" component={ButtonRegisterScreen} />
      <Stack.Screen name="OcrRegister" component={OcrRegisterScreen} />
      <Stack.Screen name="MedicineSearch" component={MedicineSearchScreen} />
      <Stack.Screen name="DoseTime" component={DoseTimeScreen} />
      <Stack.Screen name="Alarm" component={AlarmScreen} initialParams={alarmSid ? { scheduleId: alarmSid } : undefined} options={{ animation: "fade" }} />
      <Stack.Screen name="SnoozePicker" component={SnoozePickerScreen} options={{ presentation: "transparentModal", animation: "slide_from_bottom" }} />
      <Stack.Screen name="SnoozeCountdown" component={SnoozeCountdownScreen} />
      <Stack.Screen name="Checkup" component={CheckupScreen} />
      <Stack.Screen name="AlarmSound" component={AlarmSoundScreen} />
      <Stack.Screen name="VoiceSpeed" component={VoiceSpeedScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="MedicineDetail" component={MedicineDetailScreen} />
      <Stack.Screen name="Interaction" component={InteractionScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  stack: { backgroundColor: colors.canvas },
  tabBar: {
    position: "absolute",
    backgroundColor: colors.surfaceRaised,
    borderTopWidth: 0,
    paddingTop: 9,
    ...shadows.floating,
  },
  tabItem: { marginHorizontal: 4, marginVertical: 3 },
  tabIcon: { marginBottom: 1 },
  tabIconBackground: {
    width: 52,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconBackgroundActive: { backgroundColor: colors.primarySoft },
  tabLabel: { fontSize: 14, fontWeight: "800", letterSpacing: -0.2 },
});

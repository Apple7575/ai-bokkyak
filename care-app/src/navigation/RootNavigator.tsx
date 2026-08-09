import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import notifee from "@notifee/react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { RootStackParamList, TabParamList } from "./types";
import { getRole, getOnboarded, Role } from "../lib/storage";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { RoleSelectScreen } from "../screens/RoleSelectScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { RecordScreen } from "../screens/RecordScreen";
import { RegisterMethodScreen } from "../screens/RegisterMethodScreen";
import { ButtonRegisterScreen } from "../screens/ButtonRegisterScreen";
import { VoiceRegisterScreen } from "../screens/VoiceRegisterScreen";
import { OcrRegisterScreen } from "../screens/OcrRegisterScreen";
import { MedicineSearchScreen } from "../screens/MedicineSearchScreen";
import { DoseTimeScreen } from "../screens/DoseTimeScreen";
import { AlarmScreen } from "../screens/AlarmScreen";
import { SnoozePickerScreen } from "../screens/SnoozePickerScreen";
import { SnoozeCountdownScreen } from "../screens/SnoozeCountdownScreen";
import { CallScreen } from "../screens/CallScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { AlarmSoundScreen } from "../screens/AlarmSoundScreen";
import { VoiceSpeedScreen } from "../screens/VoiceSpeedScreen";
import { PrivacyScreen } from "../screens/PrivacyScreen";
import { CabinetScreen } from "../screens/CabinetScreen";
import { MedicineDetailScreen } from "../screens/MedicineDetailScreen";
import { InteractionScreen } from "../screens/InteractionScreen";
import { Home as HomeIcon, ClipboardList, Menu, Pill } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/tokens";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function PatientTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryBlue,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.cardBg,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: "홈",
          tabBarIcon: ({ color, size }) => <HomeIcon size={size ?? 24} color={color} />,
        }}
      />
      {/* 내 약장 — 회의 결정(D-01)으로 탭으로 승격 */}
      <Tab.Screen
        name="Cabinet"
        component={CabinetScreen}
        options={{
          title: "내 약장",
          tabBarIcon: ({ color, size }) => <Pill size={size ?? 24} color={color} />,
        }}
      />
      <Tab.Screen
        name="Record"
        component={RecordScreen}
        options={{
          title: "기록",
          tabBarIcon: ({ color, size }) => <ClipboardList size={size ?? 24} color={color} />,
        }}
      />
      <Tab.Screen
        name="More"
        component={SettingsScreen}
        options={{
          title: "더보기",
          tabBarIcon: ({ color, size }) => <Menu size={size ?? 24} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const [init, setInit] = useState<{ role: Role | null; onboarded: boolean } | "loading">("loading");
  const [alarmSid, setAlarmSid] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const role = await getRole();
      const onboarded = await getOnboarded();
      // 알람(풀스크린/알림 탭)으로 앱이 켜졌으면 홈을 먼저 그리지 않고 처음부터 알람 화면을 띄운다.
      try {
        const initial = await notifee.getInitialNotification();
        const sid = initial?.notification?.data?.scheduleId as string | undefined;
        if (sid) setAlarmSid(sid);
      } catch {}
      setInit({ role, onboarded });
    })();
  }, []);
  if (init === "loading") {
    return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator /></View>;
  }
  // 첫 실행(가입 전 + 온보딩 미완료)이면 안내 화면부터, 그다음 가입 화면.
  const initialRouteName: keyof RootStackParamList =
    alarmSid ? "Alarm"
      : !init.role && !init.onboarded ? "Onboarding"
        : !init.role ? "RoleSelect"
          : "Tabs";
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
      <Stack.Screen name="Tabs" component={PatientTabs} />
      <Stack.Screen name="RegisterMethod" component={RegisterMethodScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ButtonRegister" component={ButtonRegisterScreen} options={{ headerShown: false }} />
      <Stack.Screen name="VoiceRegister" component={VoiceRegisterScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OcrRegister" component={OcrRegisterScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MedicineSearch" component={MedicineSearchScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DoseTime" component={DoseTimeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Alarm" component={AlarmScreen} initialParams={alarmSid ? { scheduleId: alarmSid } : undefined} />
      <Stack.Screen
        name="SnoozePicker"
        component={SnoozePickerScreen}
        options={{ headerShown: false, presentation: "transparentModal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen name="SnoozeCountdown" component={SnoozeCountdownScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Call" component={CallScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AlarmSound" component={AlarmSoundScreen} options={{ headerShown: false }} />
      <Stack.Screen name="VoiceSpeed" component={VoiceSpeedScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MedicineDetail" component={MedicineDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Interaction" component={InteractionScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

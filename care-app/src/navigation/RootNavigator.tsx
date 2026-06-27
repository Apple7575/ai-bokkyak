import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { RootStackParamList, TabParamList } from "./types";
import { getRole, getPatientId, getOnboarded, Role } from "../lib/storage";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { RoleSelectScreen } from "../screens/RoleSelectScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { RecordScreen } from "../screens/RecordScreen";
import { GuardianDashboardScreen } from "../screens/GuardianDashboardScreen";
import { MedicineListScreen } from "../screens/MedicineListScreen";
import { RegisterMethodScreen } from "../screens/RegisterMethodScreen";
import { ButtonRegisterScreen } from "../screens/ButtonRegisterScreen";
import { VoiceRegisterScreen } from "../screens/VoiceRegisterScreen";
import { OcrRegisterScreen } from "../screens/OcrRegisterScreen";
import { AlarmScreen } from "../screens/AlarmScreen";
import { GuardianLinkScreen } from "../screens/GuardianLinkScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { Home as HomeIcon, ClipboardList, Users, Menu } from "lucide-react-native";
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
      <Tab.Screen
        name="Record"
        component={RecordScreen}
        options={{
          title: "기록",
          tabBarIcon: ({ color, size }) => <ClipboardList size={size ?? 24} color={color} />,
        }}
      />
      <Tab.Screen
        name="Guardian"
        component={GuardianDashboardScreen}
        options={{
          title: "보호자",
          tabBarIcon: ({ color, size }) => <Users size={size ?? 24} color={color} />,
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
  const [init, setInit] = useState<{ role: Role | null; linked: boolean; onboarded: boolean } | "loading">("loading");
  useEffect(() => {
    (async () => {
      const role = await getRole();
      const pid = await getPatientId();
      const onboarded = await getOnboarded();
      setInit({ role, linked: !!pid, onboarded });
    })();
  }, []);
  if (init === "loading") {
    return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator /></View>;
  }
  // 첫 실행(역할 없음 + 온보딩 미완료)이면 안내 화면부터.
  const initialRouteName: keyof RootStackParamList =
    !init.role && !init.onboarded ? "Onboarding"
      : !init.role ? "RoleSelect"
        : init.role === "guardian" ? (init.linked ? "GuardianHome" : "GuardianLink")
          : "Tabs";
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
      <Stack.Screen name="Tabs" component={PatientTabs} />
      <Stack.Screen name="GuardianHome" component={GuardianDashboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MedicineList" component={MedicineListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RegisterMethod" component={RegisterMethodScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ButtonRegister" component={ButtonRegisterScreen} options={{ headerShown: false }} />
      <Stack.Screen name="VoiceRegister" component={VoiceRegisterScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OcrRegister" component={OcrRegisterScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Alarm" component={AlarmScreen} />
      <Stack.Screen name="GuardianLink" component={GuardianLinkScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

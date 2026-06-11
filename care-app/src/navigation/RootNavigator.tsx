import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { RootStackParamList, TabParamList } from "./types";
import { getRole, getPatientId, Role } from "../lib/storage";
import { RoleSelectScreen } from "../screens/RoleSelectScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { RecordScreen } from "../screens/RecordScreen";
import { GuardianDashboardScreen } from "../screens/GuardianDashboardScreen";
import { MedicineListScreen } from "../screens/MedicineListScreen";
import { RegisterMethodScreen } from "../screens/RegisterMethodScreen";
import { ButtonRegisterScreen } from "../screens/ButtonRegisterScreen";
import { VoiceRegisterScreen } from "../screens/VoiceRegisterScreen";
import { AlarmScreen } from "../screens/AlarmScreen";
import { STTResponseScreen } from "../screens/STTResponseScreen";
import { StatusCheckScreen } from "../screens/StatusCheckScreen";
import { GuardianLinkScreen } from "../screens/GuardianLinkScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function PatientTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "홈" }} />
      <Tab.Screen name="Record" component={RecordScreen} options={{ title: "기록" }} />
      <Tab.Screen name="Guardian" component={GuardianDashboardScreen} options={{ title: "보호자" }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const [init, setInit] = useState<{ role: Role | null; linked: boolean } | "loading">("loading");
  useEffect(() => {
    (async () => {
      const role = await getRole();
      const pid = await getPatientId();
      setInit({ role, linked: !!pid });
    })();
  }, []);
  if (init === "loading") {
    return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator /></View>;
  }
  const initialRouteName: keyof RootStackParamList =
    !init.role ? "RoleSelect"
      : init.role === "guardian" ? (init.linked ? "GuardianHome" : "GuardianLink")
        : "Tabs";
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
      <Stack.Screen name="Tabs" component={PatientTabs} />
      <Stack.Screen name="GuardianHome" component={GuardianDashboardScreen} options={{ headerShown: true, title: "보호자 확인" }} />
      <Stack.Screen name="MedicineList" component={MedicineListScreen} options={{ headerShown: true, title: "복약 관리" }} />
      <Stack.Screen name="RegisterMethod" component={RegisterMethodScreen} options={{ headerShown: true, title: "약 등록" }} />
      <Stack.Screen name="ButtonRegister" component={ButtonRegisterScreen} options={{ headerShown: true, title: "버튼으로 등록" }} />
      <Stack.Screen name="VoiceRegister" component={VoiceRegisterScreen} options={{ headerShown: true, title: "음성으로 등록" }} />
      <Stack.Screen name="Alarm" component={AlarmScreen} />
      <Stack.Screen name="STTResponse" component={STTResponseScreen} options={{ headerShown: true, title: "음성 응답" }} />
      <Stack.Screen name="StatusCheck" component={StatusCheckScreen} options={{ headerShown: true, title: "상태 확인" }} />
      <Stack.Screen name="GuardianLink" component={GuardianLinkScreen} options={{ headerShown: true, title: "보호자 연결" }} />
    </Stack.Navigator>
  );
}

import { useState } from "react";
import { BottomNav, TabName } from "./components/BottomNav";
import { SplashScreen } from "./components/SplashScreen";
import { OnboardingScreen } from "./components/OnboardingScreen";
import { HomeScreen } from "./components/HomeScreen";
import { MedicineListScreen } from "./components/MedicineListScreen";
import { RegisterMethodScreen } from "./components/RegisterMethodScreen";
import { VoiceRegisterScreen } from "./components/VoiceRegisterScreen";
import { ButtonRegisterScreen } from "./components/ButtonRegisterScreen";
import { AlarmScreen } from "./components/AlarmScreen";
import { AlarmListScreen } from "./components/AlarmListScreen";
import { STTResponseScreen } from "./components/STTResponseScreen";
import { StatusCheckScreen } from "./components/StatusCheckScreen";
import { RecordScreen } from "./components/RecordScreen";
import { SettingsScreen } from "./components/SettingsScreen";

type AppScreen =
  | "splash"
  | "onboarding"
  | "home"
  | "medicine-list"
  | "register-method"
  | "voice-register"
  | "button-register"
  | "alarm-notify"
  | "alarm-list"
  | "stt-response"
  | "status-check"
  | "record"
  | "settings";

const tabToScreen: Record<TabName, AppScreen> = {
  home: "home",
  medicine: "medicine-list",
  alarm: "alarm-list",
  record: "record",
  more: "settings",
};

const screensWithNav: AppScreen[] = [
  "home",
  "medicine-list",
  "alarm-list",
  "record",
  "settings",
];

const tabForScreen: Partial<Record<AppScreen, TabName>> = {
  home: "home",
  "medicine-list": "medicine",
  "register-method": "medicine",
  "voice-register": "medicine",
  "button-register": "medicine",
  "alarm-list": "alarm",
  "alarm-notify": "alarm",
  "stt-response": "alarm",
  "status-check": "alarm",
  record: "record",
  settings: "more",
};

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("splash");

  const showNav = screensWithNav.includes(screen);
  const activeTab: TabName = tabForScreen[screen] ?? "home";

  const navigate = (s: AppScreen) => setScreen(s);

  const handleTabChange = (tab: TabName) => {
    navigate(tabToScreen[tab]);
  };

  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ background: "#1a1a2e", fontFamily: "'Noto Sans KR', sans-serif" }}
    >
      {/* Phone frame */}
      <div
        className="relative overflow-hidden"
        style={{
          width: 390,
          height: 844,
          background: "#fff",
          borderRadius: 44,
          boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
        }}
      >
        {/* Status bar */}
        <div
          className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6"
          style={{ height: 44, background: "transparent" }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: "#1F2937" }}>9:41</span>
          <div className="flex items-center gap-1.5">
            <div style={{ width: 17, height: 12, border: "1.5px solid #1F2937", borderRadius: 3, position: "relative" }}>
              <div style={{ width: "70%", height: "100%", background: "#1F2937", borderRadius: 1 }} />
            </div>
          </div>
        </div>

        {/* Screen content */}
        <div className="absolute inset-0 pt-[44px] overflow-hidden flex flex-col">
          {screen === "splash" && (
            <SplashScreen onDone={() => navigate("onboarding")} />
          )}

          {screen === "onboarding" && (
            <OnboardingScreen onDone={() => navigate("home")} />
          )}

          {screen === "home" && (
            <HomeScreen
              onViewSchedule={() => navigate("medicine-list")}
              onAlarmTrigger={() => navigate("alarm-notify")}
            />
          )}

          {screen === "medicine-list" && (
            <MedicineListScreen
              onBack={() => navigate("home")}
              onAddMedicine={() => navigate("register-method")}
            />
          )}

          {screen === "register-method" && (
            <RegisterMethodScreen
              onBack={() => navigate("medicine-list")}
              onVoice={() => navigate("voice-register")}
              onButton={() => navigate("button-register")}
              onNext={() => navigate("voice-register")}
            />
          )}

          {screen === "voice-register" && (
            <VoiceRegisterScreen
              onBack={() => navigate("register-method")}
              onRegister={() => navigate("home")}
            />
          )}

          {screen === "button-register" && (
            <ButtonRegisterScreen
              onBack={() => navigate("register-method")}
              onSave={() => navigate("home")}
            />
          )}

          {screen === "alarm-notify" && (
            <AlarmScreen
              onTaken={() => navigate("stt-response")}
              onNotTaken={() => navigate("status-check")}
              onRemind={() => navigate("home")}
              onSpeak={() => navigate("stt-response")}
            />
          )}

          {screen === "alarm-list" && (
            <AlarmListScreen onTriggerAlarm={() => navigate("alarm-notify")} />
          )}

          {screen === "stt-response" && (
            <STTResponseScreen
              onConfirm={() => navigate("status-check")}
              onViewRecord={() => navigate("record")}
            />
          )}

          {screen === "status-check" && (
            <StatusCheckScreen onDone={() => navigate("home")} />
          )}

          {screen === "record" && <RecordScreen />}

          {screen === "settings" && <SettingsScreen />}
        </div>

        {/* Bottom Nav */}
        {showNav && (
          <div className="absolute bottom-0 left-0 right-0 z-50">
            <BottomNav active={activeTab} onTabChange={handleTabChange} />
          </div>
        )}
      </div>
    </div>
  );
}

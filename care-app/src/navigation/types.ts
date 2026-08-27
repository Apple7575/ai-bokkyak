export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  RoleSelect: { from?: "quickCheck"; kakao?: boolean; kakaoAt?: number } | undefined;
  Tabs: undefined;
  VoiceGuide: undefined;
  RegisterMethod: undefined;
  ButtonRegister: { editId?: string } | undefined;
  OcrRegister: undefined;
  MedicineSearch: undefined;
  DoseTime: { medicineName: string };
  Alarm: { scheduleId?: string };
  SnoozePicker: { scheduleId: string };
  SnoozeCountdown: { scheduleId: string; fireAt: string; hour: number; minute: number };
  Checkup: undefined;
  AlarmSound: undefined;
  VoiceSpeed: undefined;
  Privacy: undefined;
  MedicineDetail: { scheduleId: string };
  Interaction: undefined;
  QuickCheckInput: undefined;
  QuickCheckAnalyzing: undefined;
  // findings: 가입 직후 초안이 서버로 옮겨져(지워져) 기기에 없으므로 RoleSelect가 넘겨준다.
  QuickCheckResult: { unlocked?: boolean; findings?: import("../lib/interactions").Finding[]; unmatched?: string[] } | undefined;
};
export type TabParamList = {
  Home: undefined;
  Cabinet: undefined;
  Record: undefined;
  More: undefined;
};

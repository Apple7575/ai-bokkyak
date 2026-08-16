export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  RoleSelect: undefined;
  Tabs: undefined;
  VoiceGuide: undefined;
  RegisterMethod: undefined;
  ButtonRegister: { editId?: string } | undefined;
  VoiceRegister: undefined;
  OcrRegister: undefined;
  MedicineSearch: undefined;
  DoseTime: { medicineName: string };
  Alarm: { scheduleId?: string };
  SnoozePicker: { scheduleId: string };
  SnoozeCountdown: { scheduleId: string; fireAt: string; hour: number; minute: number };
  Call: { setup?: boolean } | undefined;
  AlarmSound: undefined;
  VoiceSpeed: undefined;
  Privacy: undefined;
  MedicineDetail: { scheduleId: string };
  Interaction: undefined;
};
export type TabParamList = {
  Home: undefined;
  Cabinet: undefined;
  Record: undefined;
  More: undefined;
};

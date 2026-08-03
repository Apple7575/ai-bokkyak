export type RootStackParamList = {
  Onboarding: undefined;
  RoleSelect: undefined;
  Tabs: undefined;
  MedicineList: undefined;
  RegisterMethod: undefined;
  ButtonRegister: { editId?: string } | undefined;
  VoiceRegister: undefined;
  OcrRegister: undefined;
  Alarm: { scheduleId?: string };
  SnoozePicker: { scheduleId: string };
  SnoozeCountdown: { scheduleId: string; fireAt: string; hour: number; minute: number };
  Call: { setup?: boolean } | undefined;
  AlarmSound: undefined;
  Privacy: undefined;
};
export type TabParamList = {
  Home: undefined;
  Record: undefined;
  More: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  RoleSelect: undefined;
  Tabs: undefined;
  GuardianHome: undefined;
  MedicineList: undefined;
  RegisterMethod: undefined;
  ButtonRegister: { editId?: string } | undefined;
  VoiceRegister: undefined;
  OcrRegister: undefined;
  Alarm: { scheduleId?: string };
  GuardianLink: undefined;
  SnoozeCountdown: { scheduleId: string; fireAt: string; hour: number; minute: number };
};
export type TabParamList = {
  Home: undefined;
  Record: undefined;
  Guardian: undefined;
  More: undefined;
};

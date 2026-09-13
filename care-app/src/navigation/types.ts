export type RootStackParamList = {
  Intro: undefined;
  NameEntry: undefined;
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
  // findings: 초안이 서버로 옮겨져(지워져) 기기에 없을 수 있어 앞 화면이 넘겨준다.
  // names: 대조한 이름 전부(부제·대조 수 계산용). 대조 수 = names.length - unmatched.length.
  QuickCheckResult: {
    findings?: import("../lib/quickCheckRules").QuickFinding[]; unmatched?: string[]; names?: string[]; durUnavailable?: boolean;
    unmappedIngredients?: string[]; uncoveredConditions?: string[]; engine?: "server" | "local";
  } | undefined;
};
export type TabParamList = {
  Home: undefined;
  Cabinet: undefined;
  Record: undefined;
  More: undefined;
};

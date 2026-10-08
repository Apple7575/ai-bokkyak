export type RootStackParamList = {
  // slide: 점검 1/3에서 「뒤로」로 돌아올 때 시작 화면(마지막 장)을 바로 보인다.
  Intro: { slide?: "cta" } | undefined;
  NameEntry: undefined;
  AlarmPrompt: undefined;
  Tabs: undefined;
  // medicines: 1분 점검에서 방금 대조한 이름(Case A) — 이 이름 그대로 알람을 맞춘다.
  // 없으면(알람 물음에서 온 Case C) 하루 횟수만 묻는다. 회의 2026-09-06·09-12.
  VoiceGuide: { medicines?: string[] } | undefined;
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
  Privacy: undefined;
  MedicineDetail: { scheduleId: string };
  Interaction: undefined;
  // from: 인트로에서 들어왔으면 1/3의 「뒤로」가 인트로로 돌아간다(회의 2026-09-20).
  QuickCheckInput: { from?: "intro" } | undefined;
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

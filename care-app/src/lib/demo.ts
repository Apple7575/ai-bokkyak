import { supabase } from "./supabase";
import { setPatient, setRole } from "./storage";

const DEMO_CODE = "DEMO00";
const DEMO_NAME = "김복약";
const DEMO_MEDS = [
  { medicine_name: "고혈압약", time_of_day: "아침", hour: 8 },
  { medicine_name: "비타민D", time_of_day: "점심", hour: 13 },
  { medicine_name: "혈압약", time_of_day: "저녁", hour: 20 },
];

// 데모 전용 환자로 입장 + 매번 최신 날짜로 샘플 데이터 재시드(이 환자에 한정 격리).
export async function enterDemo(): Promise<void> {
  // 1) 데모 환자 확보(코드로 조회, 없으면 생성). created_at 백데이트 위해 schedules를 직접 시드.
  let { data: patient } = await supabase.from("patients").select("*").eq("patient_code", DEMO_CODE).maybeSingle();
  if (!patient) {
    const ins = await supabase.from("patients").insert({ name: DEMO_NAME, patient_code: DEMO_CODE }).select().single();
    patient = ins.data ?? null;
  }
  if (!patient) throw new Error("demo patient 생성 실패");
  const pid = patient.id as string;

  // 2) 이 데모 환자 데이터만 정리 후 재시드(항상 최신 날짜)
  await supabase.from("intake_records").delete().eq("patient_id", pid);
  await supabase.from("schedules").delete().eq("patient_id", pid);

  // schedules created_at을 3주 전으로 백데이트해야 과거 기록이 달력 due-slot에 잡힘
  const createdAt = new Date(Date.now() - 21 * 86400000).toISOString();
  const schedRows = DEMO_MEDS.map((m) => ({
    patient_id: pid, medicine_name: m.medicine_name, time_of_day: m.time_of_day,
    hour: m.hour, minute: 0, repeat_days: [] as number[], active: true, created_at: createdAt,
  }));
  const { data: scheds } = await supabase.from("schedules").insert(schedRows).select();
  if (!scheds || scheds.length === 0) { await setPatient(pid, DEMO_CODE); await setRole("patient"); return; }

  // 3) 최근 14일 복약 기록(섞인 상태)으로 달력 색/이행률 생성
  const now = new Date();
  const records: any[] = [];
  for (let d = 1; d <= 14; d++) {
    const day = new Date(now); day.setDate(now.getDate() - d);
    let completeCount = scheds.length;          // 기본: 전부 완료(초록)
    if (d % 5 === 0) completeCount = scheds.length - 1; // 1개 누락(노랑)
    if (d % 7 === 0) completeCount = scheds.length - 2; // 2개+ 누락(빨강)
    scheds.forEach((s: any, i: number) => {
      if (i >= completeCount) return; // 누락분은 기록 없음 → 달력에서 missed로 파생
      const slot = new Date(day); slot.setHours(s.hour, s.minute, 0, 0);
      records.push({
        patient_id: pid, schedule_id: s.id, scheduled_for: slot.toISOString(),
        status: "completed", response_method: "버튼", responded_at: slot.toISOString(),
      });
    });
  }
  if (records.length) await supabase.from("intake_records").upsert(records, { onConflict: "schedule_id,scheduled_for" });

  // 4) 로컬 상태 설정 → 앱 진입 (데모 알림 예약 안 함)
  await setPatient(pid, DEMO_CODE);
  await setRole("patient");
}

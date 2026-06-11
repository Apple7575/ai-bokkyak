import { supabase, IntakeStatus } from "./supabase";

// Upsert on (schedule_id, scheduled_for) — pinned decision #2 (dedup).
export async function recordIntake(args: {
  patientId: string; scheduleId: string; scheduledFor: Date;
  status: IntakeStatus; method: "음성" | "버튼" | null;
}): Promise<void> {
  const { error } = await supabase.from("intake_records").upsert({
    patient_id: args.patientId, schedule_id: args.scheduleId,
    scheduled_for: args.scheduledFor.toISOString(), status: args.status,
    response_method: args.method,
    responded_at: args.status === "복용예정" ? null : new Date().toISOString(),
  }, { onConflict: "schedule_id,scheduled_for" });
  if (error) throw error;
}

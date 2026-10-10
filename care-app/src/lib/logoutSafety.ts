import { listIntakeOutbox } from "./intakeOutbox";
import { flushIntakeOutbox } from "./records";

export async function pendingIntakeCount(patientId: string): Promise<number> {
  return (await listIntakeOutbox(patientId)).length;
}

export async function syncPendingIntakesForLogout(patientId: string): Promise<{
  before: number;
  sent: number;
  remaining: number;
}> {
  const before = await pendingIntakeCount(patientId);
  if (before === 0) return { before: 0, sent: 0, remaining: 0 };
  const sent = await flushIntakeOutbox(patientId);
  const remaining = await pendingIntakeCount(patientId);
  return { before, sent, remaining };
}

export type AlarmRouteParams = {
  scheduleId?: string;
  medicineName?: string;
  timeOfDay?: string;
  hour?: number;
  minute?: number;
};

function finiteInt(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) ? n : undefined;
}

export function alarmRouteFromData(data: unknown): AlarmRouteParams | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.scheduleId !== "string" || !d.scheduleId) return null;
  const hour = finiteInt(d.hour);
  const minute = finiteInt(d.minute);
  return {
    scheduleId: d.scheduleId,
    medicineName: typeof d.medName === "string" ? d.medName : undefined,
    timeOfDay: typeof d.tod === "string" ? d.tod : undefined,
    hour: hour !== undefined && hour >= 0 && hour <= 23 ? hour : undefined,
    minute: minute !== undefined && minute >= 0 && minute <= 59 ? minute : undefined,
  };
}

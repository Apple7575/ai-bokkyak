import { normalizeRepeatDays } from "./schedule";

export type ParsedSchedule = {
  medicine_name: string; time_of_day: string;
  hour: number; minute: number; repeat_days: number[];
};
export type ParseResult =
  | { ok: true; value: ParsedSchedule }
  | { ok: false; error: string };

export function validateParsedSchedule(input: any): ParseResult {
  if (!input || typeof input !== "object") return { ok: false, error: "not an object" };
  const name = typeof input.medicine_name === "string" ? input.medicine_name.trim() : "";
  if (!name) return { ok: false, error: "missing medicine_name" };
  const hour = Number(input.hour);
  const minute = Number(input.minute ?? 0);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return { ok: false, error: "bad hour" };
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return { ok: false, error: "bad minute" };
  const tod = typeof input.time_of_day === "string" ? input.time_of_day : "";
  return {
    ok: true,
    value: {
      medicine_name: name, time_of_day: tod, hour, minute,
      repeat_days: normalizeRepeatDays(input.repeat_days),
    },
  };
}

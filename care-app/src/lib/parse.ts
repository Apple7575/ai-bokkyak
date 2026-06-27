import { normalizeRepeatDays } from "./schedule";

export type ParsedSchedule = {
  medicine_name: string; time_of_day: string;
  hour: number; minute: number; repeat_days: number[];
};
export type ParseResult =
  | { ok: true; value: ParsedSchedule }
  | { ok: false; error: string };

// OCR 결과({medicines:[...]} 또는 배열)에서 유효한 일정만 추려 반환. 잘못된 항목은 조용히 버린다.
export function validateOcrMedicines(input: any): ParsedSchedule[] {
  const list = Array.isArray(input) ? input : Array.isArray(input?.medicines) ? input.medicines : [];
  const out: ParsedSchedule[] = [];
  for (const item of list) {
    const r = validateParsedSchedule(item);
    if (r.ok) out.push(r.value);
  }
  return out;
}

export function validateParsedSchedule(input: any): ParseResult {
  if (!input || typeof input !== "object") return { ok: false, error: "not an object" };
  const name = typeof input.medicine_name === "string" ? input.medicine_name.trim() : "";
  if (!name) return { ok: false, error: "missing medicine_name" };
  if (input.hour === null || input.hour === undefined || input.hour === "") {
    return { ok: false, error: "missing hour" };
  }
  const hour = Number(input.hour);
  const minute = input.minute === null || input.minute === undefined || input.minute === ""
    ? 0
    : Number(input.minute);
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

import type { AlarmRouteParams } from "./alarmPayload";

export type AlarmDisplaySchedule = {
  medicine_name: string;
  time_of_day: string;
  hour: number;
  minute: number;
};

export type LoadedAlarmSchedule = {
  routeKey: string;
  schedule: AlarmDisplaySchedule;
};

function routeKey(params: AlarmRouteParams): string {
  return [
    params.scheduleId, params.medicineName ?? "", params.timeOfDay ?? "",
    params.hour ?? "", params.minute ?? "",
  ].join("|");
}

export function fallbackAlarmSchedule(params: AlarmRouteParams): AlarmDisplaySchedule | null {
  if (!params.scheduleId || params.hour === undefined || params.minute === undefined) return null;
  return {
    medicine_name: params.medicineName || "약",
    time_of_day: params.timeOfDay ?? "아침",
    hour: params.hour,
    minute: params.minute,
  };
}

export function loadedAlarmSchedule(
  params: AlarmRouteParams,
  schedule: AlarmDisplaySchedule,
): LoadedAlarmSchedule {
  return { routeKey: routeKey(params), schedule };
}

export function alarmDisplayForRoute(
  params: AlarmRouteParams,
  loaded: LoadedAlarmSchedule | null,
): AlarmDisplaySchedule | null {
  return loaded?.routeKey === routeKey(params) ? loaded.schedule : fallbackAlarmSchedule(params);
}

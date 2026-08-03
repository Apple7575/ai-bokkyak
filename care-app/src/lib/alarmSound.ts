// 알람 소리 설정의 순수 로직 (RN/네트워크 의존 없음, jest 단위 테스트 대상).
//
// 어르신 중에는 알람 안내 음성이 부담스러워 진동만 원하는 분이 있다.
// Android 알림 채널은 "생성 후 소리를 바꿀 수 없다"는 제약이 있어,
// 무음 여부에 따라 서로 다른 채널 id를 쓴다.

export type AlarmSoundSettings = {
  /** true면 안내 음성 없이 진동만 울린다. */
  silent: boolean;
};

export const DEFAULT_ALARM_SOUND: AlarmSoundSettings = { silent: false };

// AsyncStorage에서 읽은 값(구버전/손상 포함)을 안전하게 정규화한다.
// 알 수 없는 값이면 기본값(소리 켜짐) — 알람이 조용해지는 쪽으로 실패하지 않게.
export function normalizeAlarmSound(raw: unknown): AlarmSoundSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_ALARM_SOUND;
  const { silent } = raw as Record<string, unknown>;
  return { silent: silent === true };
}

// 알림 채널 id. 무음 설정은 별도 채널로 분리해야 한다(채널 소리는 생성 후 변경 불가).
// 소리 켜짐 채널 id는 기존 설치본과 같은 값을 유지한다(`care-morning` 등).
export function alarmChannelId(slot: string, silent: boolean): string {
  return silent ? `care-${slot}-silent` : `care-${slot}`;
}

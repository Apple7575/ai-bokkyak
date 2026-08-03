import { normalizeAlarmSound, alarmChannelId, DEFAULT_ALARM_SOUND } from "../lib/alarmSound";

describe("normalizeAlarmSound", () => {
  it("silent: true만 무음으로 인정", () => {
    expect(normalizeAlarmSound({ silent: true })).toEqual({ silent: true });
    expect(normalizeAlarmSound({ silent: false })).toEqual({ silent: false });
  });

  it("손상/구버전 값은 기본값(소리 켜짐)으로 폴백", () => {
    // 저장소가 깨져도 알람이 조용해지는 쪽으로 실패하면 안 된다.
    expect(normalizeAlarmSound(null)).toEqual(DEFAULT_ALARM_SOUND);
    expect(normalizeAlarmSound(undefined)).toEqual(DEFAULT_ALARM_SOUND);
    expect(normalizeAlarmSound("silent")).toEqual(DEFAULT_ALARM_SOUND);
    expect(normalizeAlarmSound({})).toEqual({ silent: false });
    expect(normalizeAlarmSound({ silent: "true" })).toEqual({ silent: false });
    expect(normalizeAlarmSound({ silent: 1 })).toEqual({ silent: false });
  });
});

describe("alarmChannelId", () => {
  it("소리 켜짐은 기존 설치본과 같은 채널 id를 유지", () => {
    expect(alarmChannelId("morning", false)).toBe("care-morning");
    expect(alarmChannelId("night", false)).toBe("care-night");
  });

  it("무음은 별도 채널 (채널 소리는 생성 후 변경 불가)", () => {
    expect(alarmChannelId("morning", true)).toBe("care-morning-silent");
    expect(alarmChannelId("morning", true)).not.toBe(alarmChannelId("morning", false));
  });
});

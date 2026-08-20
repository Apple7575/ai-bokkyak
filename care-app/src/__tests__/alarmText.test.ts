import { alarmTitle, alarmBody, snoozeTitle } from "../lib/alarmText";

describe("alarmTitle", () => {
  it("약 이름이 있으면 이름을 앞세운다", () => {
    expect(alarmTitle("고혈압약", "아침")).toBe("고혈압약 드실 시간이에요");
  });
  it("이름이 없으면 시간대로 떨어진다", () => {
    expect(alarmTitle("", "자기 전")).toBe("자기 전 약 드실 시간이에요");
    expect(alarmTitle(null, "아침")).toBe("아침 약 드실 시간이에요");
    expect(alarmTitle(undefined, "점심")).toBe("점심 약 드실 시간이에요");
  });
  it("공백뿐인 이름은 없는 것으로 본다", () => {
    expect(alarmTitle("   ", "저녁")).toBe("저녁 약 드실 시간이에요");
  });
  it("긴 이름은 잘라서 잠금화면에서 시간대가 밀리지 않게 한다", () => {
    const long = "가나다라마바사아자차카타파하거너더";
    const t = alarmTitle(long, "아침");
    expect(t.length).toBeLessThanOrEqual("드실 시간이에요".length + 1 + 14);
    expect(t.endsWith("… 드실 시간이에요")).toBe(true);
  });
});

describe("alarmBody", () => {
  // QA에서 두 알림의 본문이 서로 달라 혼란을 준 게 이 버그의 핵심이다.
  it("이름이 있든 없든 누를 버튼 이름은 항상 같다", () => {
    expect(alarmBody("비타민", "아침")).toContain("'지금 약 먹기'");
    expect(alarmBody("", "아침")).toContain("'지금 약 먹기'");
  });
  it("제목이 약 이름일 때는 본문이 시간대를 알려준다", () => {
    expect(alarmBody("비타민", "자기 전")).toBe("자기 전 약이에요. 드신 뒤 '지금 약 먹기'를 눌러 주세요.");
  });
});

describe("snoozeTitle", () => {
  it("다시 알림에도 약 이름을 유지한다", () => {
    expect(snoozeTitle("고혈압약", "아침")).toBe("다시 알림 — 고혈압약");
    expect(snoozeTitle("", "아침")).toBe("다시 알림 — 아침 약");
  });
});

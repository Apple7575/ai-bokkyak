import { buildQuickCheckShareMessage, APP_STORE_URL } from "../lib/quickCheckShare";

describe("buildQuickCheckShareMessage", () => {
  it("앱 소개 + 스토어 링크, 분석 결과는 없다", () => {
    const m = buildQuickCheckShareMessage();
    expect(m).toBe(`드시는 약과 영양제 중에 주의가 필요한 조합이 있는지 1분이면 확인해 볼 수 있어요. 모두의 복약 앱에서 1분 복용 점검을 해보세요. ${APP_STORE_URL}`);
    expect(m).toContain("https://apps.apple.com/app/id6797708328");
    expect(m).not.toMatch(/×/);
    // 안전을 보증하는 표현 금지(스토어 의료 표현 심사)
    expect(m).not.toMatch(/괜찮|안전/);
  });
});

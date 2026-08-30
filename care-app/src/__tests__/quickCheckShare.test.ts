import { buildQuickCheckShareMessage, APP_STORE_URL } from "../lib/quickCheckShare";

describe("buildQuickCheckShareMessage", () => {
  it("앱 소개 + 스토어 링크, 분석 결과는 없다", () => {
    const m = buildQuickCheckShareMessage();
    expect(m).toBe(`약과 영양제를 함께 먹어도 괜찮은지 1분이면 확인할 수 있어요. 모두의 복약 앱에서 1분 복용 점검을 해보세요. ${APP_STORE_URL}`);
    expect(m).toContain("https://apps.apple.com/app/id6797708328");
    expect(m).not.toMatch(/×/);
  });
});

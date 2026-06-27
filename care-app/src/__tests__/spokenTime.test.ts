import { spokenTime } from "../lib/spokenTime";

describe("spokenTime", () => {
  it("오전/오후 + 12시간제로 읽고 분을 포함한다", () => {
    expect(spokenTime(22, 30)).toBe("오후 10시 30분");
    expect(spokenTime(8, 0)).toBe("오전 8시");        // 분 0이면 분 생략
    expect(spokenTime(13, 5)).toBe("오후 1시 5분");
  });
  it("자정/정오 경계", () => {
    expect(spokenTime(0, 0)).toBe("오전 12시");
    expect(spokenTime(12, 0)).toBe("오후 12시");
    expect(spokenTime(0, 15)).toBe("오전 12시 15분");
  });
});

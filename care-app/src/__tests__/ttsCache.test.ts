import { ttsCacheKey } from "../lib/ttsCache";

describe("ttsCacheKey", () => {
  it("같은 텍스트+속도는 같은 키", () => {
    expect(ttsCacheKey("안녕하세요", 0.9)).toBe(ttsCacheKey("안녕하세요", 0.9));
  });
  it("다른 텍스트는 다른 키", () => {
    expect(ttsCacheKey("안녕하세요", 0.9)).not.toBe(ttsCacheKey("안녕히가세요", 0.9));
  });
  it("다른 속도는 다른 키", () => {
    expect(ttsCacheKey("안녕하세요", 0.9)).not.toBe(ttsCacheKey("안녕하세요", 1.0));
  });
  it(".mp3 확장자로 끝난다", () => {
    expect(ttsCacheKey("안녕하세요", 0.9).endsWith(".mp3")).toBe(true);
  });
});

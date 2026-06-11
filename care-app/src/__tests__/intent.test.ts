import { classifyIntent } from "../lib/intent";

describe("classifyIntent", () => {
  it("복용완료", () => {
    expect(classifyIntent("먹었어요")).toBe("복용완료");
    expect(classifyIntent("약 먹었어")).toBe("복용완료");
    expect(classifyIntent("복용했어요")).toBe("복용완료");
  });
  it("미복용 (must beat 복용완료 substring 먹었)", () => {
    expect(classifyIntent("아직 안 먹었어요")).toBe("미복용");
    expect(classifyIntent("못 먹었어요")).toBe("미복용");
  });
  it("재알림 (highest priority)", () => {
    expect(classifyIntent("30분 뒤에 다시 알려줘")).toBe("재알림");
    expect(classifyIntent("이따 먹을게")).toBe("재알림");
    expect(classifyIntent("나중에 알려줘")).toBe("재알림");
  });
  it("인식실패", () => {
    expect(classifyIntent("오늘 날씨 좋네")).toBe("인식실패");
    expect(classifyIntent("")).toBe("인식실패");
  });
  it("non-medication 했어요 utterances are 인식실패, not 복용완료", () => {
    expect(classifyIntent("운동했어요")).toBe("인식실패");
    expect(classifyIntent("전화했어요")).toBe("인식실패");
  });
});

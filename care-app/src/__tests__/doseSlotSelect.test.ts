import { dueAtSlot } from "../lib/doseSlotSelect";

const S = (id: string, h: number, m: number, active = true) => ({ id, hour: h, minute: m, active });

describe("dueAtSlot", () => {
  it("같은 시각의 활성 일정 id만 반환", () => {
    const list = [S("a", 13, 0), S("b", 13, 0), S("c", 8, 0), S("d", 13, 0, false)];
    expect(dueAtSlot(list, 13, 0).sort()).toEqual(["a", "b"]);
  });
  it("일치 없으면 빈 배열", () => {
    expect(dueAtSlot([S("a", 8, 0)], 13, 0)).toEqual([]);
  });
});

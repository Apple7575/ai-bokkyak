import { createHydrationGate } from "../lib/quickCheckHydration";

it("hydration이 끝나기 전 뒤로가기는 기존 초안을 읽은 뒤에만 최신 입력을 저장한다", async () => {
  const gate = createHydrationGate();
  const writes: string[] = [];
  const leaving = gate.runWhenReady(() => { writes.push("restored-input"); });
  expect(writes).toEqual([]);
  gate.succeed();
  await leaving;
  expect(writes).toEqual(["restored-input"]);
});

it("초안 읽기가 실패하면 빈 입력 저장을 실행하지 않는다", async () => {
  const gate = createHydrationGate();
  const write = jest.fn();
  const leaving = gate.runWhenReady(write);
  gate.fail();
  await expect(leaving).resolves.toBe(false);
  expect(write).not.toHaveBeenCalled();
});

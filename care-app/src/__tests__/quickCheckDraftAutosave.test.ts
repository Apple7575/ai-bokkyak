const mockValues = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockValues.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => { mockValues.set(key, value); return Promise.resolve(); }),
    removeItem: jest.fn((key: string) => { mockValues.delete(key); return Promise.resolve(); }),
  },
}));
jest.mock("../lib/supabase", () => ({ supabase: { from: jest.fn() } }));

import { EMPTY_DRAFT } from "../lib/quickCheck";
import { loadDraft, saveDraft, saveDraftInputs } from "../lib/quickCheckDraft";

beforeEach(() => mockValues.clear());

it("입력이 바뀌면 오래된 분석 결과와 저장 완료 표식을 비운다", async () => {
  await saveDraft({
    ...EMPTY_DRAFT,
    supplements: ["오메가3"],
    findings: [{ kind: "caution", a: "A", b: "B", title: "이전 결과", message: "이전", tag: "주의사항", source: "rule", notice_no: null }],
    unmatched: ["이전"],
    analyzedAt: "2026-10-10T00:00:00.000Z",
    engine: "server",
    committedAt: "2026-10-10T00:01:00.000Z",
  });
  await expect(saveDraftInputs({
    supplements: ["오메가3", "비타민D"], medicines: [], profile: { age: null, conditions: [] },
  })).resolves.toBe("saved");
  const saved = await loadDraft();
  expect(saved).toMatchObject({
    supplements: ["오메가3", "비타민D"], findings: null, unmatched: [], analyzedAt: null, committedAt: null,
  });
  expect(saved?.engine).toBeUndefined();
});

it("같은 입력은 다시 쓰지 않고 결과도 유지한다", async () => {
  await saveDraft({ ...EMPTY_DRAFT, medicines: ["혈압약"], analyzedAt: "2026-10-10T00:00:00.000Z" });
  await expect(saveDraftInputs({
    supplements: [], medicines: ["혈압약"], profile: { age: null, conditions: [] },
  })).resolves.toBe("unchanged");
  expect((await loadDraft())?.analyzedAt).toBe("2026-10-10T00:00:00.000Z");
});

it("모든 입력을 지우면 빈 초안을 남기지 않는다", async () => {
  await saveDraft({ ...EMPTY_DRAFT, medicines: ["혈압약"] });
  await expect(saveDraftInputs({ supplements: [], medicines: [], profile: { age: null, conditions: [] } })).resolves.toBe("cleared");
  await expect(loadDraft()).resolves.toBeNull();
});

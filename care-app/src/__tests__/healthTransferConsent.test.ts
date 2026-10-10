const mockValues = new Map<string, string>();
const mockAlert = jest.fn();
let mockPatientId: string | null = null;

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockValues.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => { mockValues.set(key, value); return Promise.resolve(); }),
    removeItem: jest.fn((key: string) => { mockValues.delete(key); return Promise.resolve(); }),
  },
}));
jest.mock("react-native", () => ({ Alert: { alert: (...args: unknown[]) => mockAlert(...args) } }));
jest.mock("../lib/storage", () => ({ getPatientId: jest.fn(() => Promise.resolve(mockPatientId)) }));

import {
  clearHealthTransferConsents, hasHealthTransferConsent, healthTransferDisclosure, requestHealthTransferConsent,
} from "../lib/healthTransferConsent";

beforeEach(() => {
  mockValues.clear();
  mockAlert.mockReset();
  mockPatientId = null;
});

it("범위별로 실제 전송 항목과 수신자를 구분한다", () => {
  expect(healthTransferDisclosure("quick-check").message).toContain("약·영양제 이름, 연령대, 선택한 건강 상태");
  expect(healthTransferDisclosure("quick-check").message).toContain("Supabase 서버");
  expect(healthTransferDisclosure("quick-check").message).not.toContain("OpenAI");
  expect(healthTransferDisclosure("product-search").message).toContain("검색창에 입력한");
  expect(healthTransferDisclosure("photo-ocr").message).toContain("사진");
  expect(healthTransferDisclosure("photo-ocr").message).toContain("OpenAI");
  expect(healthTransferDisclosure("drug-info").message).toContain("약 이름");
});

it("명시적으로 동의한 동일 범위와 동일 계정에서만 재사용한다", async () => {
  mockPatientId = "patient-a";
  mockAlert.mockImplementation((_title, _message, buttons) => buttons[1].onPress());
  await expect(requestHealthTransferConsent("drug-info")).resolves.toBe(true);
  await expect(hasHealthTransferConsent("drug-info")).resolves.toBe(true);
  expect(mockAlert).toHaveBeenCalledTimes(1);

  await expect(requestHealthTransferConsent("drug-info")).resolves.toBe(true);
  expect(mockAlert).toHaveBeenCalledTimes(1);
  await expect(hasHealthTransferConsent("photo-ocr")).resolves.toBe(false);

  mockPatientId = "patient-b";
  await expect(hasHealthTransferConsent("drug-info")).resolves.toBe(false);
});

it("거절하면 동의를 저장하지 않는다", async () => {
  mockAlert.mockImplementation((_title, _message, buttons) => buttons[0].onPress());
  await expect(requestHealthTransferConsent("photo-ocr")).resolves.toBe(false);
  await expect(hasHealthTransferConsent("photo-ocr")).resolves.toBe(false);
});

it("로그아웃·계정 전환 정리를 위해 저장된 동의를 지울 수 있다", async () => {
  mockAlert.mockImplementation((_title, _message, buttons) => buttons[1].onPress());
  await requestHealthTransferConsent("quick-check");
  await expect(hasHealthTransferConsent("quick-check")).resolves.toBe(true);
  await clearHealthTransferConsents();
  await expect(hasHealthTransferConsent("quick-check")).resolves.toBe(false);
});

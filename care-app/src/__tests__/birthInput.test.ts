import { sanitizeBirthPart, birthError } from "../lib/birthInput";

describe("sanitizeBirthPart", () => {
  it("숫자가 아닌 문자는 걸러낸다", () => {
    expect(sanitizeBirthPart("1a9b", "year")).toBe("19");
    expect(sanitizeBirthPart("３", "month")).toBe(""); // 전각 숫자는 숫자가 아님
  });

  it("월은 13을 받지 않고 직전 값을 지킨다 — QA에서 들어가던 값", () => {
    expect(sanitizeBirthPart("13", "month", "1")).toBe("1");
    expect(sanitizeBirthPart("12", "month", "1")).toBe("12");
  });

  it("일은 32를 받지 않는다", () => {
    expect(sanitizeBirthPart("32", "day", "3")).toBe("3");
    expect(sanitizeBirthPart("31", "day", "3")).toBe("31");
  });

  it("자릿수를 넘기면 거부한다", () => {
    expect(sanitizeBirthPart("19540", "year", "1954")).toBe("1954");
    expect(sanitizeBirthPart("123", "month", "12")).toBe("12");
  });

  it("지우는 것은 언제나 허용한다", () => {
    expect(sanitizeBirthPart("", "month", "12")).toBe("");
  });

  it("타이핑 중인 값은 통과시킨다", () => {
    expect(sanitizeBirthPart("1", "month", "")).toBe("1");
    expect(sanitizeBirthPart("0", "day", "")).toBe("0");   // 0으로 시작하는 09일
    expect(sanitizeBirthPart("09", "day", "0")).toBe("09");
    expect(sanitizeBirthPart("195", "year", "19")).toBe("195");
  });

  it("연도는 0으로 시작할 수 없다", () => {
    expect(sanitizeBirthPart("0", "year", "")).toBe("");
  });
});

describe("birthError", () => {
  const today = new Date(2026, 7, 20); // 2026-08-20

  it("전부 비어 있으면 문제 없음 (선택 입력)", () => {
    expect(birthError("", "", "", today)).toBeNull();
  });

  it("정상 날짜는 통과", () => {
    expect(birthError("1954", "3", "1", today)).toBeNull();
    expect(birthError("1954", "03", "01", today)).toBeNull();
  });

  it("일부만 적으면 알려준다", () => {
    expect(birthError("1954", "", "", today)).toBe("연·월·일을 모두 적어 주세요.");
  });

  it("연도 자릿수가 모자라면 알려준다", () => {
    expect(birthError("54", "3", "1", today)).toContain("네 자리");
  });

  it("그 달에 없는 날은 이유를 말해준다", () => {
    expect(birthError("1955", "2", "30", today)).toBe("2월에는 30일이 없어요.");
    expect(birthError("1955", "4", "31", today)).toBe("4월에는 31일이 없어요.");
  });

  it("윤년 2월 29일은 통과", () => {
    expect(birthError("1956", "2", "29", today)).toBeNull();
    expect(birthError("1955", "2", "29", today)).toBe("2월에는 29일이 없어요.");
  });

  it("미래 날짜는 막는다", () => {
    expect(birthError("2030", "1", "1", today)).toBe("앞으로 올 날짜는 적을 수 없어요.");
  });

  it("오늘은 허용한다", () => {
    expect(birthError("2026", "8", "20", today)).toBeNull();
  });
});

// callTools.ts에서 옮겨 온 저장 직전 관문 (음성 AI 제거로 이 파일에 통합).
import { buildBirthDate } from "../lib/birthInput";

describe("buildBirthDate", () => {
  it("정상 값을 YYYY-MM-DD로 만든다", () => {
    expect(buildBirthDate(1954, 3, 1)).toBe("1954-03-01");
  });
  it("정수가 아니면 null", () => {
    expect(buildBirthDate("1954", 3, 1)).toBeNull();
    expect(buildBirthDate(1954.5, 3, 1)).toBeNull();
    expect(buildBirthDate(NaN, 3, 1)).toBeNull();
  });
  it("범위를 벗어나면 null", () => {
    expect(buildBirthDate(1954, 13, 1)).toBeNull();
    expect(buildBirthDate(1954, 0, 1)).toBeNull();
    expect(buildBirthDate(1954, 3, 32)).toBeNull();
    expect(buildBirthDate(1899, 3, 1)).toBeNull();
  });
  it("존재하지 않는 날짜는 롤오버 없이 null", () => {
    expect(buildBirthDate(1955, 2, 30)).toBeNull();
    expect(buildBirthDate(1955, 4, 31)).toBeNull();
    expect(buildBirthDate(1956, 2, 29)).toBe("1956-02-29"); // 윤년
  });
});

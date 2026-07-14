import { describe, expect, it } from "vitest";
import {
  addWeeks,
  currentWeekStart,
  fromDateKey,
  isoWeek,
  toDateKey,
  utcDate,
  weekLabel,
  weekRange,
  weekStartOf,
} from "./week";

describe("weekStartOf", () => {
  it("월요일은 자기 자신", () => {
    expect(toDateKey(weekStartOf(utcDate(2026, 7, 13)))).toBe("2026-07-13");
  });
  it("일요일은 같은 주 월요일(6일 전)", () => {
    expect(toDateKey(weekStartOf(utcDate(2026, 7, 19)))).toBe("2026-07-13");
  });
  it("화요일~토요일도 같은 주 월요일", () => {
    for (const d of [14, 15, 16, 17, 18]) {
      expect(toDateKey(weekStartOf(utcDate(2026, 7, d)))).toBe("2026-07-13");
    }
  });
  it("연말/연초 경계", () => {
    // 2026-01-01(목) → 2025-12-29(월)
    expect(toDateKey(weekStartOf(utcDate(2026, 1, 1)))).toBe("2025-12-29");
  });
  it("시각이 섞인 Date도 날짜 기준으로 정규화", () => {
    const d = new Date("2026-07-15T23:59:59.000Z");
    expect(toDateKey(weekStartOf(d))).toBe("2026-07-13");
  });
});

describe("isoWeek / weekLabel", () => {
  it("2026-07-13 은 W29", () => {
    expect(isoWeek(utcDate(2026, 7, 13))).toEqual({ year: 2026, week: 29 });
    expect(weekLabel(utcDate(2026, 7, 13))).toBe("26-W29");
  });
  it("53주 연도: 2020-12-31 은 2020-W53", () => {
    expect(isoWeek(utcDate(2020, 12, 31))).toEqual({ year: 2020, week: 53 });
  });
  it("연초가 전년도 주차에 속하는 경우: 2027-01-01 은 2026-W53", () => {
    expect(isoWeek(utcDate(2027, 1, 1))).toEqual({ year: 2026, week: 53 });
  });
  it("2026-01-01 은 2026-W01", () => {
    expect(isoWeek(utcDate(2026, 1, 1))).toEqual({ year: 2026, week: 1 });
  });
});

describe("weekRange / addWeeks", () => {
  it("연속 4주 생성 (임의 요일 입력도 월요일부터)", () => {
    const r = weekRange(utcDate(2026, 7, 15), 4).map(toDateKey);
    expect(r).toEqual(["2026-07-13", "2026-07-20", "2026-07-27", "2026-08-03"]);
  });
  it("addWeeks 음수", () => {
    expect(toDateKey(addWeeks(utcDate(2026, 7, 13), -1))).toBe("2026-07-06");
  });
});

describe("currentWeekStart", () => {
  it("로컬 날짜 기준으로 계산", () => {
    // 2026-07-15 (수) 로컬 → 2026-07-13 월요일
    const now = new Date(2026, 6, 15, 3, 0, 0);
    expect(toDateKey(currentWeekStart(now))).toBe("2026-07-13");
  });
});

describe("dateKey 왕복", () => {
  it("toDateKey/fromDateKey 왕복 보존", () => {
    const d = utcDate(2026, 7, 13);
    expect(fromDateKey(toDateKey(d)).getTime()).toBe(d.getTime());
  });
});

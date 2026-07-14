import { describe, expect, it } from "vitest";
import {
  dayLabel,
  generateDailyDraft,
  splitEvenly,
  weekDates,
  workDates,
} from "./daily";
import { toDateKey, utcDate } from "./week";

const W = utcDate(2026, 7, 13); // 월요일

describe("weekDates / workDates", () => {
  it("월요일부터 7일 연속", () => {
    const keys = weekDates(W).map(toDateKey);
    expect(keys[0]).toBe("2026-07-13");
    expect(keys[6]).toBe("2026-07-19");
    expect(keys).toHaveLength(7);
  });
  it("가동일은 월~금 5일", () => {
    const keys = workDates(W).map(toDateKey);
    expect(keys).toEqual([
      "2026-07-13",
      "2026-07-14",
      "2026-07-15",
      "2026-07-16",
      "2026-07-17",
    ]);
  });
});

describe("splitEvenly", () => {
  it("나누어떨어지는 수량은 균등", () => {
    expect(splitEvenly(500, 5)).toEqual([100, 100, 100, 100, 100]);
  });
  it("나머지는 앞쪽부터 +1", () => {
    expect(splitEvenly(502, 5)).toEqual([101, 101, 100, 100, 100]);
    expect(splitEvenly(3, 5)).toEqual([1, 1, 1, 0, 0]);
  });
  it("합계 보존", () => {
    for (const q of [1, 7, 499, 1234]) {
      expect(splitEvenly(q, 5).reduce((s, v) => s + v, 0)).toBe(q);
    }
  });
  it("0 이하 수량은 전부 0", () => {
    expect(splitEvenly(0, 5)).toEqual([0, 0, 0, 0, 0]);
  });
});

describe("generateDailyDraft", () => {
  it("일별 계획이 없는 엔트리만 분할 (멱등)", () => {
    const out = generateDailyDraft([
      { id: 1, weekStart: W, qty: 500, hasDaily: false },
      { id: 2, weekStart: W, qty: 300, hasDaily: true },
    ]);
    expect(out.every((e) => e.planEntryId === 1)).toBe(true);
    expect(out.reduce((s, e) => s + e.qty, 0)).toBe(500);
  });
  it("금요일까지만 배치되고 qty 0 요일은 생성 안 함", () => {
    const out = generateDailyDraft([
      { id: 1, weekStart: W, qty: 3, hasDaily: false },
    ]);
    expect(out).toHaveLength(3);
    expect(out.map((e) => toDateKey(e.date))).toEqual([
      "2026-07-13",
      "2026-07-14",
      "2026-07-15",
    ]);
  });
});

describe("dayLabel", () => {
  it("요일 라벨 포함", () => {
    expect(dayLabel(utcDate(2026, 7, 13), W)).toBe("7/13 (월)");
    expect(dayLabel(utcDate(2026, 7, 19), W)).toBe("7/19 (일)");
  });
});

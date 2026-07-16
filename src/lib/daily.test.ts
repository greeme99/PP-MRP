import { describe, expect, it } from "vitest";
import {
  dayLabel,
  generateDailyDraft,
  splitEvenly,
  weekDates,
  workDates,
  type WeeklyEntryForSplit,
} from "./daily";
import { toDateKey, utcDate } from "./week";

const W = utcDate(2026, 7, 13); // 월요일

const entry = (over: Partial<WeeklyEntryForSplit>): WeeklyEntryForSplit => ({
  id: 1,
  lineId: 1,
  weekStart: W,
  qty: 100,
  hasDaily: false,
  dueDate: null,
  ...over,
});

const capa = (c: number | null) => new Map([[1, c]]);

/** planEntryId별 요일 수량 배열 [월..금] */
function byDay(
  drafts: ReturnType<typeof generateDailyDraft>,
  planEntryId: number
): number[] {
  const days = workDates(W).map(toDateKey);
  return days.map(
    (dk) =>
      drafts.find(
        (d) => d.planEntryId === planEntryId && toDateKey(d.date) === dk
      )?.qty ?? 0
  );
}

describe("weekDates / workDates", () => {
  it("월요일부터 7일 연속", () => {
    const keys = weekDates(W).map(toDateKey);
    expect(keys[0]).toBe("2026-07-13");
    expect(keys[6]).toBe("2026-07-19");
    expect(keys).toHaveLength(7);
  });
  it("가동일은 월~금 5일", () => {
    expect(workDates(W).map(toDateKey)).toEqual([
      "2026-07-13",
      "2026-07-14",
      "2026-07-15",
      "2026-07-16",
      "2026-07-17",
    ]);
  });
});

describe("splitEvenly (CAPA 미설정 fallback)", () => {
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
});

describe("generateDailyDraft — 순차 채움 (일일 CAPA 반영)", () => {
  it("CAPA 한도까지 앞 요일부터 채운다", () => {
    const drafts = generateDailyDraft([entry({ qty: 250 })], capa(100));
    expect(byDay(drafts, 1)).toEqual([100, 100, 50, 0, 0]);
  });

  it("여러 행이 같은 라인 CAPA를 공유한다", () => {
    const drafts = generateDailyDraft(
      [
        entry({ id: 1, qty: 150, dueDate: utcDate(2026, 7, 15) }),
        entry({ id: 2, qty: 100, dueDate: utcDate(2026, 7, 17) }),
      ],
      capa(100)
    );
    // 납기 빠른 1번이 먼저: 월100 화50 → 2번은 화50 수50
    expect(byDay(drafts, 1)).toEqual([100, 50, 0, 0, 0]);
    expect(byDay(drafts, 2)).toEqual([0, 50, 50, 0, 0]);
  });

  it("납기 빠른 행이 앞 요일을 차지한다 (입력 순서 무관)", () => {
    const drafts = generateDailyDraft(
      [
        entry({ id: 1, qty: 100, dueDate: utcDate(2026, 7, 18) }),
        entry({ id: 2, qty: 100, dueDate: utcDate(2026, 7, 14) }),
      ],
      capa(100)
    );
    expect(byDay(drafts, 2)).toEqual([100, 0, 0, 0, 0]);
    expect(byDay(drafts, 1)).toEqual([0, 100, 0, 0, 0]);
  });

  it("주 전체 CAPA(5일)를 넘는 초과분은 금요일에 몰아서 배치", () => {
    const drafts = generateDailyDraft([entry({ qty: 620 })], capa(100));
    expect(byDay(drafts, 1)).toEqual([100, 100, 100, 100, 220]);
  });

  it("기존 일별 부하(이미 분할된 행·수동 입력)를 CAPA에서 차감한다", () => {
    const existing = new Map([
      [`1|2026-07-13`, 80],
      [`1|2026-07-14`, 100],
    ]);
    const drafts = generateDailyDraft([entry({ qty: 100 })], capa(100), existing);
    // 월 잔여 20, 화 잔여 0, 수 80
    expect(byDay(drafts, 1)).toEqual([20, 0, 80, 0, 0]);
  });

  it("합계 보존 (초과 포함)", () => {
    for (const q of [1, 99, 500, 777]) {
      const drafts = generateDailyDraft([entry({ qty: q })], capa(100));
      expect(drafts.reduce((s, d) => s + d.qty, 0)).toBe(q);
    }
  });

  it("CAPA 미설정 라인은 균등 분할 fallback", () => {
    const drafts = generateDailyDraft([entry({ qty: 100 })], capa(null));
    expect(byDay(drafts, 1)).toEqual([20, 20, 20, 20, 20]);
  });

  it("이미 일별 계획이 있는 엔트리는 건너뜀 (멱등)", () => {
    const drafts = generateDailyDraft(
      [entry({ id: 1, hasDaily: true }), entry({ id: 2, qty: 50 })],
      capa(100)
    );
    expect(drafts.every((d) => d.planEntryId === 2)).toBe(true);
  });

  it("다른 라인끼리는 CAPA를 공유하지 않는다", () => {
    const capas = new Map([
      [1, 100],
      [2, 100],
    ]);
    const drafts = generateDailyDraft(
      [entry({ id: 1, lineId: 1, qty: 100 }), entry({ id: 2, lineId: 2, qty: 100 })],
      capas
    );
    expect(byDay(drafts, 1)).toEqual([100, 0, 0, 0, 0]);
    expect(byDay(drafts, 2)).toEqual([100, 0, 0, 0, 0]);
  });
});

describe("dayLabel", () => {
  it("요일 라벨 포함", () => {
    expect(dayLabel(utcDate(2026, 7, 13), W)).toBe("7/13 (월)");
    expect(dayLabel(utcDate(2026, 7, 19), W)).toBe("7/19 (일)");
  });
});

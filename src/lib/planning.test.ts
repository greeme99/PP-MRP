import { describe, expect, it } from "vitest";
import {
  aggregateLoad,
  generateDraftEntries,
  loadKey,
  type LineInfo,
  type PlannableOrderLine,
} from "./planning";
import { toDateKey, utcDate } from "./week";

// 기준 시각: 2026-07-15(수) → 이번 주 월요일 2026-07-13
const NOW = new Date(2026, 6, 15, 10, 0, 0);

const LINES: LineInfo[] = [
  { id: 1, isActive: true },
  { id: 2, isActive: true },
  { id: 3, isActive: false },
];

const ol = (over: Partial<PlannableOrderLine>): PlannableOrderLine => ({
  id: 100,
  itemId: 10,
  qty: 500,
  dueDate: utcDate(2026, 7, 30),
  defaultLineId: null,
  hasPlan: false,
  ...over,
});

describe("generateDraftEntries", () => {
  it("납기일이 속한 주(월요일)에 전량 배치", () => {
    // 2026-07-30(목) → 주 시작 2026-07-27(월)
    const { entries } = generateDraftEntries([ol({})], LINES, NOW);
    expect(entries).toHaveLength(1);
    expect(toDateKey(entries[0].weekStart)).toBe("2026-07-27");
    expect(entries[0].qty).toBe(500);
  });

  it("과거 납기는 이번 주로 클램프", () => {
    const { entries } = generateDraftEntries(
      [ol({ dueDate: utcDate(2026, 6, 1) })],
      LINES,
      NOW
    );
    expect(toDateKey(entries[0].weekStart)).toBe("2026-07-13");
  });

  it("이미 계획이 있는 라인은 건너뜀 (멱등)", () => {
    const { entries, skipped } = generateDraftEntries(
      [ol({ hasPlan: true })],
      LINES,
      NOW
    );
    expect(entries).toHaveLength(0);
    expect(skipped).toHaveLength(0);
  });

  it("기본 라인이 지정되어 있으면 그 라인에 배치", () => {
    const { entries } = generateDraftEntries(
      [ol({ defaultLineId: 2 })],
      LINES,
      NOW
    );
    expect(entries[0].lineId).toBe(2);
  });

  it("기본 라인이 비활성이면 첫 활성 라인으로 fallback", () => {
    const { entries } = generateDraftEntries(
      [ol({ defaultLineId: 3 })],
      LINES,
      NOW
    );
    expect(entries[0].lineId).toBe(1);
  });

  it("기본 라인이 없으면 첫 활성 라인", () => {
    const { entries } = generateDraftEntries([ol({})], LINES, NOW);
    expect(entries[0].lineId).toBe(1);
  });

  it("활성 라인이 하나도 없으면 skipped로 보고", () => {
    const { entries, skipped } = generateDraftEntries(
      [ol({})],
      [{ id: 3, isActive: false }],
      NOW
    );
    expect(entries).toHaveLength(0);
    expect(skipped).toEqual([
      { orderLineId: 100, reason: "가동 중인 라인이 없습니다" },
    ]);
  });

  it("여러 라인 혼합 처리", () => {
    const { entries } = generateDraftEntries(
      [
        ol({ id: 1, qty: 100 }),
        ol({ id: 2, qty: 200, hasPlan: true }),
        ol({ id: 3, qty: 300, defaultLineId: 2 }),
      ],
      LINES,
      NOW
    );
    expect(entries.map((e) => e.orderLineId)).toEqual([1, 3]);
  });
});

describe("aggregateLoad", () => {
  it("라인×주차별 합계", () => {
    const w1 = utcDate(2026, 7, 13);
    const w2 = utcDate(2026, 7, 20);
    const load = aggregateLoad([
      { lineId: 1, weekStart: w1, qty: 100 },
      { lineId: 1, weekStart: w1, qty: 250 },
      { lineId: 1, weekStart: w2, qty: 50 },
      { lineId: 2, weekStart: w1, qty: 999 },
    ]);
    expect(load.get(loadKey(1, w1))).toBe(350);
    expect(load.get(loadKey(1, w2))).toBe(50);
    expect(load.get(loadKey(2, w1))).toBe(999);
    expect(load.get(loadKey(2, w2))).toBeUndefined();
  });
});

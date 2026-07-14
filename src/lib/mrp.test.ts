import { describe, expect, it } from "vitest";
import {
  explodeRequirements,
  roundQty,
  type BomEdgeQty,
  type Demand,
} from "./mrp";
import { toDateKey, utcDate } from "./week";

const W1 = utcDate(2026, 7, 13);
const W2 = utcDate(2026, 7, 20);
const K1 = toDateKey(W1);
const K2 = toDateKey(W2);

const e = (p: number, c: number, q: number): BomEdgeQty => ({
  parentItemId: p,
  childItemId: c,
  qtyPer: q,
});
const d = (itemId: number, weekStart: Date, qty: number): Demand => ({
  itemId,
  weekStart,
  qty,
});

describe("explodeRequirements", () => {
  it("단일 레벨: 완제품 100 × 자재 2/개 = 200", () => {
    const req = explodeRequirements([d(1, W1, 100)], [e(1, 10, 2)]);
    expect(req.get(10)?.get(K1)).toBe(200);
  });

  it("BOM 없는 품목은 소요 없음", () => {
    const req = explodeRequirements([d(1, W1, 100)], []);
    expect(req.size).toBe(0);
  });

  it("다단계: FG(10) → SF(×2) → RM(×3) = SF 20, RM 60", () => {
    const req = explodeRequirements(
      [d(1, W1, 10)],
      [e(1, 2, 2), e(2, 3, 3)]
    );
    expect(req.get(2)?.get(K1)).toBe(20);
    expect(req.get(3)?.get(K1)).toBe(60);
  });

  it("다이아몬드: 두 경로의 소요가 합산된다", () => {
    // FG(1) → SF-A(2)×1 → RM(4)×2 = 20
    // FG(1) → SF-B(3)×2 → RM(4)×1 = 20   합계 40
    const req = explodeRequirements(
      [d(1, W1, 10)],
      [e(1, 2, 1), e(1, 3, 2), e(2, 4, 2), e(3, 4, 1)]
    );
    expect(req.get(4)?.get(K1)).toBe(40);
  });

  it("주차가 다른 수요는 주차별로 분리 집계", () => {
    const req = explodeRequirements(
      [d(1, W1, 10), d(1, W2, 5)],
      [e(1, 10, 2)]
    );
    expect(req.get(10)?.get(K1)).toBe(20);
    expect(req.get(10)?.get(K2)).toBe(10);
  });

  it("같은 주차의 여러 수요(다른 완제품 포함)는 합산", () => {
    const req = explodeRequirements(
      [d(1, W1, 10), d(2, W1, 20)],
      [e(1, 10, 1), e(2, 10, 2)]
    );
    expect(req.get(10)?.get(K1)).toBe(50);
  });

  it("소수 소요량(0.5/개) 지원", () => {
    const req = explodeRequirements([d(1, W1, 3)], [e(1, 10, 0.5)]);
    expect(req.get(10)?.get(K1)).toBe(1.5);
  });

  it("반제품 자체 생산계획도 하위 자재로 전개", () => {
    // SF(2)를 직접 30개 계획 → RM(3) 90
    const req = explodeRequirements([d(2, W1, 30)], [e(1, 2, 2), e(2, 3, 3)]);
    expect(req.get(3)?.get(K1)).toBe(90);
    expect(req.get(2)).toBeUndefined(); // SF 자신은 수요의 소요가 아님
  });
});

describe("roundQty", () => {
  it("부동소수 오차 정리", () => {
    expect(roundQty(0.1 + 0.2)).toBe(0.3);
    expect(roundQty(1.0000000001)).toBe(1);
  });
});

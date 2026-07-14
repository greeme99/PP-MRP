// MRP 자재소요 전개 순수 로직 (DB 비의존)
// 정책: 재고 차감 없는 총소요량(gross requirement), 리드타임 오프셋 없음
// (소요 주차 = 모품목 생산 주차). BOM은 저장 시 순환이 차단되므로 DAG를 전제한다.

import { toDateKey } from "./week";

export type BomEdgeQty = {
  parentItemId: number;
  childItemId: number;
  qtyPer: number;
};

export type Demand = {
  itemId: number;
  weekStart: Date;
  qty: number;
};

/** itemId → (주차 dateKey → 소요량). 다단계 전개 결과 누적 합산. */
export type Requirements = Map<number, Map<string, number>>;

export function explodeRequirements(
  demands: Demand[],
  edges: BomEdgeQty[]
): Requirements {
  const childrenOf = new Map<number, BomEdgeQty[]>();
  for (const e of edges) {
    const list = childrenOf.get(e.parentItemId) ?? [];
    list.push(e);
    childrenOf.set(e.parentItemId, list);
  }

  const req: Requirements = new Map();
  const add = (itemId: number, weekKey: string, qty: number) => {
    let weeks = req.get(itemId);
    if (!weeks) {
      weeks = new Map();
      req.set(itemId, weeks);
    }
    weeks.set(weekKey, (weeks.get(weekKey) ?? 0) + qty);
  };

  // BOM은 DAG이므로 명시적 스택으로 전개 (깊은 BOM에서도 안전)
  for (const d of demands) {
    const weekKey = toDateKey(d.weekStart);
    const stack: Array<{ itemId: number; qty: number }> = [
      { itemId: d.itemId, qty: d.qty },
    ];
    while (stack.length > 0) {
      const { itemId, qty } = stack.pop()!;
      for (const e of childrenOf.get(itemId) ?? []) {
        const childQty = qty * e.qtyPer;
        add(e.childItemId, weekKey, childQty);
        stack.push({ itemId: e.childItemId, qty: childQty });
      }
    }
  }
  return req;
}

/** 부동소수 오차 정리용: 소수 6자리 반올림 */
export function roundQty(qty: number): number {
  return Math.round(qty * 1e6) / 1e6;
}

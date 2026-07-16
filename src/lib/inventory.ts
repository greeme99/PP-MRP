// 재고/순소요 순수 로직 (DB 비의존)

import type { Requirements } from "./mrp";
import { roundQty } from "./mrp";

/** 트랜잭션(부호 있는 증감량) 합산 → 품목별 현재고 */
export function onHandByItem(
  txs: Array<{ itemId: number; qty: number }>
): Map<number, number> {
  const onHand = new Map<number, number>();
  for (const t of txs) {
    onHand.set(t.itemId, (onHand.get(t.itemId) ?? 0) + t.qty);
  }
  return onHand;
}

export type NetResult = {
  /** 품목별 주차별 순소요 = max(총소요 - 잔여재고, 0) */
  net: Requirements;
  /** 품목별 기간 말 잔여재고 (소진 후) */
  remainingByItem: Map<number, number>;
};

/**
 * 표준 MRP netting: 현재고를 첫 주부터 순차 소진하며 순소요를 계산한다.
 * 주차 키(YYYY-MM-DD) 오름차순으로 소진하고 남은 재고는 다음 주로 이월.
 * 음수 재고(과출고)는 0으로 간주한다.
 */
export function netRequirements(
  gross: Requirements,
  onHand: Map<number, number>
): NetResult {
  const net: Requirements = new Map();
  const remainingByItem = new Map<number, number>();

  for (const [itemId, weeks] of gross) {
    let remaining = Math.max(onHand.get(itemId) ?? 0, 0);
    const netWeeks = new Map<string, number>();
    for (const [weekKey, grossQty] of [...weeks].sort(([a], [b]) =>
      a.localeCompare(b)
    )) {
      const consumed = Math.min(remaining, grossQty);
      remaining = roundQty(remaining - consumed);
      const netQty = roundQty(grossQty - consumed);
      if (netQty > 0) netWeeks.set(weekKey, netQty);
    }
    if (netWeeks.size > 0) net.set(itemId, netWeeks);
    remainingByItem.set(itemId, remaining);
  }
  return { net, remainingByItem };
}

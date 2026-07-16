// 생산실적 순수 로직 (DB 비의존)

/**
 * 주간 계획 대비 실적 미달분 이월 계산.
 * 이월할 잔량이 없으면(실적 ≥ 계획) null.
 * - newQty: 이번 주 계획에 남길 수량(= 실적만큼). 0이면 이번 주 계획 삭제 대상.
 * - carryQty: 다음 주로 넘길 잔량.
 */
export function computeCarryover(
  planQty: number,
  resultQty: number
): { newQty: number; carryQty: number } | null {
  const carryQty = planQty - resultQty;
  if (carryQty <= 0) return null;
  return { newQty: resultQty, carryQty };
}

/** 달성률(%). 계획 0이면 실적이 있을 때만 100 초과 개념 대신 null. */
export function achievementRate(
  planQty: number,
  resultQty: number
): number | null {
  if (planQty <= 0) return null;
  return Math.round((resultQty / planQty) * 100);
}

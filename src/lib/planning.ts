// MPS 초안 생성/부하 집계 순수 로직 (DB 비의존)
// 정책: 무한능력 + 납기주 전량 배치. 과거 납기는 이번 주로 클램프.
// 이미 계획이 있는 수주라인은 건드리지 않는다 (멱등).

import { currentWeekStart, toDateKey, weekStartOf } from "./week";

export type PlannableOrderLine = {
  id: number;
  itemId: number;
  qty: number;
  dueDate: Date;
  defaultLineId: number | null;
  hasPlan: boolean;
};

export type LineInfo = { id: number; isActive: boolean };

export type DraftEntry = {
  orderLineId: number;
  itemId: number;
  lineId: number;
  weekStart: Date;
  qty: number;
};

export type SkippedLine = { orderLineId: number; reason: string };

export function generateDraftEntries(
  orderLines: PlannableOrderLine[],
  lines: LineInfo[],
  now: Date = new Date()
): { entries: DraftEntry[]; skipped: SkippedLine[] } {
  const activeLines = lines.filter((l) => l.isActive);
  const activeLineIds = new Set(activeLines.map((l) => l.id));
  const thisWeek = currentWeekStart(now);

  const entries: DraftEntry[] = [];
  const skipped: SkippedLine[] = [];

  for (const ol of orderLines) {
    if (ol.hasPlan) continue; // 기존 계획 보존 (멱등)

    const lineId =
      ol.defaultLineId !== null && activeLineIds.has(ol.defaultLineId)
        ? ol.defaultLineId
        : (activeLines[0]?.id ?? null);
    if (lineId === null) {
      skipped.push({ orderLineId: ol.id, reason: "가동 중인 라인이 없습니다" });
      continue;
    }

    const dueWeek = weekStartOf(ol.dueDate);
    const weekStart = dueWeek.getTime() < thisWeek.getTime() ? thisWeek : dueWeek;

    entries.push({
      orderLineId: ol.id,
      itemId: ol.itemId,
      lineId,
      weekStart,
      qty: ol.qty,
    });
  }

  return { entries, skipped };
}

export function loadKey(lineId: number, weekStart: Date): string {
  return `${lineId}|${toDateKey(weekStart)}`;
}

/** 라인×주차별 계획 수량 합계. key = `${lineId}|YYYY-MM-DD` */
export function aggregateLoad(
  entries: Array<{ lineId: number; weekStart: Date; qty: number }>
): Map<string, number> {
  const load = new Map<string, number>();
  for (const e of entries) {
    const key = loadKey(e.lineId, e.weekStart);
    load.set(key, (load.get(key) ?? 0) + e.qty);
  }
  return load;
}

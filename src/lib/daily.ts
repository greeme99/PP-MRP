// 일별계획 순수 로직 (DB 비의존)
// 정책: 주간 PlanEntry를 가동일(월~금) 균등 분할, 나머지는 앞쪽 요일부터 +1.
// 이미 일별 계획이 있는 주간 엔트리는 건드리지 않는다 (멱등).

import { addWeeks, toDateKey } from "./week";

const DAY_MS = 24 * 60 * 60 * 1000;
export const WORKDAYS = 5; // 월~금

/** 주 시작일(월요일)부터 7일 전체 (월~일). */
export function weekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS));
}

/** 가동일(월~금)만. */
export function workDates(weekStart: Date): Date[] {
  return weekDates(weekStart).slice(0, WORKDAYS);
}

/**
 * 수량을 n일로 균등 분할한다. 나머지는 앞쪽부터 1개씩 추가 배분.
 * 예: 502 → [101, 101, 100, 100, 100]
 */
export function splitEvenly(qty: number, days: number = WORKDAYS): number[] {
  if (days <= 0 || qty <= 0) return Array(Math.max(days, 0)).fill(0);
  const base = Math.floor(qty / days);
  const remainder = qty % days;
  return Array.from({ length: days }, (_, i) => base + (i < remainder ? 1 : 0));
}

export type WeeklyEntryForSplit = {
  id: number; // PlanEntry id
  weekStart: Date;
  qty: number;
  hasDaily: boolean;
};

export type DailyDraftEntry = {
  planEntryId: number;
  date: Date;
  qty: number;
};

/** 일별 계획이 없는 주간 엔트리를 월~금 균등 분할 초안으로 만든다 (멱등). */
export function generateDailyDraft(
  entries: WeeklyEntryForSplit[]
): DailyDraftEntry[] {
  const out: DailyDraftEntry[] = [];
  for (const e of entries) {
    if (e.hasDaily || e.qty <= 0) continue;
    const dates = workDates(e.weekStart);
    const qtys = splitEvenly(e.qty, dates.length);
    dates.forEach((date, i) => {
      if (qtys[i] > 0) out.push({ planEntryId: e.id, date, qty: qtys[i] });
    });
  }
  return out;
}

export const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

/** "M/D (요일)" 표시 라벨 */
export function dayLabel(date: Date, weekStart: Date): string {
  const idx = Math.round((date.getTime() - weekStart.getTime()) / DAY_MS);
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()} (${DAY_LABELS[idx] ?? "?"})`;
}

/** 일별 부하 집계 key */
export function dailyLoadKey(lineId: number, date: Date): string {
  return `${lineId}|${toDateKey(date)}`;
}

export { addWeeks };

// 일별계획 순수 로직 (DB 비의존)
// 정책: 주간 PlanEntry를 납기 우선 순차 채움(capacity-fill)으로 분할한다.
//  - 같은 라인×주의 행들을 납기순으로 정렬해 월요일부터 일일 CAPA 잔여량만큼 채운다.
//  - 이미 분할된 행·수동 입력분이 차지한 부하는 CAPA에서 차감한다.
//  - 금요일까지 채우고 남는 초과분은 금요일에 몰아서 배치한다(빨간 부하 표시로 사람이 조정).
//    주말 자동 배치는 하지 않는다 (특근은 수동 입력).
//  - 일일 CAPA가 없는 라인은 균등 분할(나머지 앞쪽 +1)로 fallback.
// 이미 일별 계획이 있는 주간 엔트리는 건드리지 않는다 (멱등).

import { toDateKey } from "./week";

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
 * 예: 502 → [101, 101, 100, 100, 100]. 일일 CAPA 미설정 라인의 fallback.
 */
export function splitEvenly(qty: number, days: number = WORKDAYS): number[] {
  if (days <= 0 || qty <= 0) return Array(Math.max(days, 0)).fill(0);
  const base = Math.floor(qty / days);
  const remainder = qty % days;
  return Array.from({ length: days }, (_, i) => base + (i < remainder ? 1 : 0));
}

export type WeeklyEntryForSplit = {
  id: number; // PlanEntry id
  lineId: number;
  weekStart: Date;
  qty: number;
  hasDaily: boolean;
  /** 납기일. 빠를수록 앞 요일에 배치. 없으면 후순위. */
  dueDate?: Date | null;
};

export type DailyDraftEntry = {
  planEntryId: number;
  date: Date;
  qty: number;
};

/**
 * 일별 분할 초안 생성.
 * @param entries 분할 대상 주간 엔트리 (hasDaily=true는 건너뜀 — 멱등)
 * @param dailyCapacityByLine 라인별 일일 CAPA (없거나 null이면 균등 분할 fallback)
 * @param existingLoad 이미 존재하는 일별 부하 (key: `${lineId}|${dateKey}`) — CAPA에서 차감
 */
export function generateDailyDraft(
  entries: WeeklyEntryForSplit[],
  dailyCapacityByLine: Map<number, number | null> = new Map(),
  existingLoad: Map<string, number> = new Map()
): DailyDraftEntry[] {
  const out: DailyDraftEntry[] = [];

  // 라인×주 단위로 묶어 순차 채움
  const groups = new Map<string, WeeklyEntryForSplit[]>();
  for (const e of entries) {
    if (e.hasDaily || e.qty <= 0) continue;
    const key = `${e.lineId}|${toDateKey(e.weekStart)}`;
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }

  for (const group of groups.values()) {
    const { lineId, weekStart } = group[0];
    const dates = workDates(weekStart);
    const capa = dailyCapacityByLine.get(lineId) ?? null;

    if (capa === null || capa <= 0) {
      // fallback: 행별 균등 분할
      for (const e of group) {
        const qtys = splitEvenly(e.qty, dates.length);
        dates.forEach((date, i) => {
          if (qtys[i] > 0) out.push({ planEntryId: e.id, date, qty: qtys[i] });
        });
      }
      continue;
    }

    // 납기 빠른 순 → id 순으로 앞 요일부터 채운다
    const sorted = [...group].sort(
      (a, b) =>
        (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity) ||
        a.id - b.id
    );
    const remaining = dates.map(
      (d) => Math.max(capa - (existingLoad.get(`${lineId}|${toDateKey(d)}`) ?? 0), 0)
    );

    for (const e of sorted) {
      let left = e.qty;
      for (let i = 0; i < dates.length && left > 0; i++) {
        const take = Math.min(left, remaining[i]);
        if (take > 0) {
          out.push({ planEntryId: e.id, date: dates[i], qty: take });
          remaining[i] -= take;
          left -= take;
        }
      }
      if (left > 0) {
        // CAPA로 못 담는 초과분은 금요일에 몰아서 배치 → 부하 초과 표시로 사람이 조정
        const friday = dates.length - 1;
        const existing = out.find(
          (d) => d.planEntryId === e.id && d.date.getTime() === dates[friday].getTime()
        );
        if (existing) existing.qty += left;
        else out.push({ planEntryId: e.id, date: dates[friday], qty: left });
      }
    }
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

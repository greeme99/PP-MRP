// 주차 표현의 단일 진입점.
// 모든 weekStart는 "해당 주 월요일의 UTC 자정"으로 정규화한다.
// 날짜 문자열(YYYY-MM-DD)을 new Date()로 파싱하면 UTC 자정이 되므로
// DB의 dueDate/weekStart와 UTC 기준 연산이 일관된다.

const DAY_MS = 24 * 60 * 60 * 1000;

export function utcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

/** 해당 날짜가 속한 주의 월요일(UTC 자정)을 반환한다. */
export function weekStartOf(date: Date): Date {
  const base = utcDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate()
  );
  const day = base.getUTCDay(); // 0=일 ... 6=토
  const diff = day === 0 ? 6 : day - 1;
  return new Date(base.getTime() - diff * DAY_MS);
}

/** 로컬(사용자 PC) 기준 오늘 날짜가 속한 주의 월요일. */
export function currentWeekStart(now: Date = new Date()): Date {
  return weekStartOf(
    utcDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
  );
}

export function addWeeks(weekStart: Date, n: number): Date {
  return new Date(weekStart.getTime() + n * 7 * DAY_MS);
}

/** from부터 count개의 연속 주 시작일 목록. */
export function weekRange(from: Date, count: number): Date[] {
  const start = weekStartOf(from);
  return Array.from({ length: count }, (_, i) => addWeeks(start, i));
}

/** ISO-8601 주차 (연도, 주번호). */
export function isoWeek(date: Date): { year: number; week: number } {
  const d = utcDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate()
  );
  // 해당 주의 목요일로 이동 → 그 목요일의 연도가 ISO 연도
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const isoYear = d.getUTCFullYear();
  const yearStart = utcDate(isoYear, 1, 1);
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return { year: isoYear, week };
}

/** 표시용 라벨: "26-W31" */
export function weekLabel(weekStart: Date): string {
  const { year, week } = isoWeek(weekStart);
  return `${String(year).slice(2)}-W${String(week).padStart(2, "0")}`;
}

/** 표시용 날짜: "7/27" (주 시작 월요일) */
export function weekDateLabel(weekStart: Date): string {
  return `${weekStart.getUTCMonth() + 1}/${weekStart.getUTCDate()}`;
}

/** YYYY-MM-DD (UTC 기준) — URL 파라미터/키 용도 */
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function fromDateKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

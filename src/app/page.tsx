import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge, Card, PageTitle } from "@/components/ui";
import { achievementRate } from "@/lib/results";
import {
  addWeeks,
  currentWeekStart,
  toDateKey,
  weekLabel,
} from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const thisWeek = currentWeekStart();
  const horizonEnd = addWeeks(thisWeek, 12);
  const in7days = new Date(thisWeek.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [unplanned, dueSoon, lines, entries, weekResults] = await Promise.all([
    prisma.salesOrderLine.findMany({
      where: {
        status: "OPEN",
        order: { status: "OPEN" },
        planEntries: { none: {} },
      },
      include: { order: true, item: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.salesOrderLine.findMany({
      where: {
        status: "OPEN",
        order: { status: "OPEN" },
        dueDate: { lt: in7days },
      },
      include: { order: true, item: true, planEntries: true },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.productionLine.findMany({ where: { isActive: true } }),
    prisma.planEntry.findMany({
      where: { weekStart: { gte: thisWeek, lt: horizonEnd } },
      select: { lineId: true, weekStart: true, qty: true },
    }),
    prisma.productionResult.aggregate({
      where: { date: { gte: thisWeek, lt: addWeeks(thisWeek, 1) } },
      _sum: { qty: true, defectQty: true },
    }),
  ]);

  // CAPA 초과 주×라인 (향후 12주)
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const load = new Map<string, number>();
  for (const e of entries) {
    const key = `${e.lineId}|${toDateKey(e.weekStart)}`;
    load.set(key, (load.get(key) ?? 0) + e.qty);
  }
  const overloads = [...load.entries()]
    .map(([key, qty]) => {
      const [lineIdStr, weekKey] = key.split("|");
      const line = lineById.get(Number(lineIdStr));
      return line && qty > line.weeklyCapacity
        ? { line, weekKey, qty, pct: Math.round((qty / line.weeklyCapacity) * 100) }
        : null;
    })
    .filter((x) => x !== null)
    .sort((a, b) => a.weekKey.localeCompare(b.weekKey));

  // 이번 주 계획 vs 실적
  const thisWeekKey = toDateKey(thisWeek);
  const thisWeekPlan = entries
    .filter((e) => toDateKey(e.weekStart) === thisWeekKey)
    .reduce((s, e) => s + e.qty, 0);
  const thisWeekResult = weekResults._sum.qty ?? 0;
  const rate = achievementRate(thisWeekPlan, thisWeekResult);

  return (
    <div>
      <PageTitle>대시보드 — {weekLabel(thisWeek)} 주</PageTitle>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-sm mb-2">
            이번 주 계획 대비 실적
          </h2>
          <p className="text-2xl font-bold">
            {thisWeekResult.toLocaleString()}
            <span className="text-base font-normal text-gray-500">
              {" "}/ {thisWeekPlan.toLocaleString()}
            </span>
            {rate !== null && (
              <Badge color={rate >= 100 ? "green" : rate >= 80 ? "amber" : "red"}>
                {rate}%
              </Badge>
            )}
          </p>
          {(weekResults._sum.defectQty ?? 0) > 0 && (
            <p className="text-xs text-red-700 mt-1">
              불량 {weekResults._sum.defectQty!.toLocaleString()}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-2">
            <Link href="/daily" className="text-blue-600 hover:underline">
              일별계획·실적 입력 →
            </Link>
          </p>
        </Card>

        <Card>
          <h2 className="font-semibold text-sm mb-2">
            미계획 수주 라인{" "}
            {unplanned.length > 0 ? (
              <Badge color="amber">{unplanned.length}건</Badge>
            ) : (
              <Badge color="green">없음</Badge>
            )}
          </h2>
          <ul className="text-sm space-y-1">
            {unplanned.slice(0, 5).map((l) => (
              <li key={l.id}>
                <Link href={`/orders/${l.orderId}`} className="text-blue-600 hover:underline font-mono text-xs">
                  {l.order.orderNo}
                </Link>{" "}
                <span className="font-mono text-xs">{l.item.code}</span>
                <span className="text-gray-500 text-xs">
                  {" "}×{l.qty.toLocaleString()} · 납기 {toDateKey(l.dueDate)}
                </span>
              </li>
            ))}
            {unplanned.length > 5 && (
              <li className="text-xs text-gray-500">외 {unplanned.length - 5}건</li>
            )}
          </ul>
          {unplanned.length > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              <Link href="/mps" className="text-blue-600 hover:underline">
                MPS에서 초안 생성 →
              </Link>
            </p>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold text-sm mb-2">
            CAPA 초과 (향후 12주){" "}
            {overloads.length > 0 ? (
              <Badge color="red">{overloads.length}곳</Badge>
            ) : (
              <Badge color="green">없음</Badge>
            )}
          </h2>
          <ul className="text-sm space-y-1">
            {overloads.slice(0, 8).map((o) => (
              <li key={`${o.line.id}|${o.weekKey}`}>
                <Link
                  href={`/mps?from=${o.weekKey}&weeks=4`}
                  className="text-blue-600 hover:underline"
                >
                  {o.weekKey} 주 · {o.line.code}
                </Link>{" "}
                <span className="text-red-700 text-xs">
                  {o.qty.toLocaleString()}/{o.line.weeklyCapacity.toLocaleString()} ({o.pct}%)
                </span>
              </li>
            ))}
            {overloads.length > 8 && (
              <li className="text-xs text-gray-500">외 {overloads.length - 8}곳</li>
            )}
          </ul>
        </Card>

        <Card>
          <h2 className="font-semibold text-sm mb-2">
            납기 임박 (7일 내, 진행중){" "}
            {dueSoon.length > 0 ? (
              <Badge color="amber">{dueSoon.length}건+</Badge>
            ) : (
              <Badge color="green">없음</Badge>
            )}
          </h2>
          <ul className="text-sm space-y-1">
            {dueSoon.map((l) => {
              const planned = l.planEntries.reduce((s, p) => s + p.qty, 0);
              return (
                <li key={l.id}>
                  <Link href={`/orders/${l.orderId}`} className="text-blue-600 hover:underline font-mono text-xs">
                    {l.order.orderNo}
                  </Link>{" "}
                  <span className="font-mono text-xs">{l.item.code}</span>
                  <span className="text-gray-500 text-xs">
                    {" "}×{l.qty.toLocaleString()} · 납기 {toDateKey(l.dueDate)}
                  </span>
                  {planned === 0 && <Badge color="red">미계획</Badge>}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}

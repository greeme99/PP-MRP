import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  generateDailyDraftForWeek,
  resetDailyForPlanEntry,
} from "@/actions/daily";
import { ActionButton } from "@/components/action-form";
import { DailyCell } from "@/components/daily-cell";
import { Badge, Card, PageTitle, btnCls, btnGhostCls, tdCls } from "@/components/ui";
import { dailyLoadKey, dayLabel, weekDates, WORKDAYS } from "@/lib/daily";
import {
  addWeeks,
  currentWeekStart,
  fromDateKey,
  toDateKey,
  weekLabel,
  weekStartOf,
} from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function DailyPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const sp = await searchParams;
  const weekStart = sp.week
    ? weekStartOf(fromDateKey(sp.week))
    : currentWeekStart();
  const weekKey = toDateKey(weekStart);
  const dates = weekDates(weekStart);
  const dateKeys = dates.map(toDateKey);

  const [lines, weekly] = await Promise.all([
    prisma.productionLine.findMany({
      orderBy: { code: "asc" },
      where: {
        OR: [{ isActive: true }, { planEntries: { some: { weekStart } } }],
      },
    }),
    prisma.planEntry.findMany({
      where: { weekStart },
      include: {
        orderLine: { include: { order: true } },
        item: true,
        dailyEntries: true,
      },
    }),
  ]);

  // 라인×일자 부하
  const load = new Map<string, number>();
  for (const w of weekly) {
    for (const d of w.dailyEntries) {
      const key = dailyLoadKey(w.lineId, d.date);
      load.set(key, (load.get(key) ?? 0) + d.qty);
    }
  }

  const prevKey = toDateKey(addWeeks(weekStart, -1));
  const nextKey = toDateKey(addWeeks(weekStart, 1));
  const todayWeekKey = toDateKey(currentWeekStart());
  const unsplit = weekly.filter((w) => w.dailyEntries.length === 0).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <PageTitle>
          일별계획 — {weekLabel(weekStart)} ({weekKey} 주)
        </PageTitle>
        <div className="flex gap-2 items-center">
          <Link href={`/daily?week=${prevKey}`} className={btnGhostCls}>← 이전 주</Link>
          <Link href={`/daily?week=${todayWeekKey}`} className={btnGhostCls}>이번 주</Link>
          <Link href={`/daily?week=${nextKey}`} className={btnGhostCls}>다음 주 →</Link>
          <Link href={`/mps?from=${weekKey}&weeks=12`} className={btnGhostCls}>
            주간(MPS) 보기
          </Link>
          <ActionButton
            action={generateDailyDraftForWeek.bind(null, weekKey)}
            className={btnCls}
          >
            일별 분할 {unsplit > 0 ? `(미분할 ${unsplit}건)` : ""}
          </ActionButton>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        주간 계획을 월~금 균등 분할한 초안입니다. 셀 수정은 즉시 저장(0 = 삭제),
        토/일은 초안에서 제외되며 특근 시 직접 입력하세요. 주간 수량 ≠ 일별
        합계면 <Badge color="amber">불일치</Badge> 배지가 표시됩니다.
      </p>

      {lines.map((line) => {
        const rows = weekly
          .filter((w) => w.lineId === line.id)
          .sort(
            (a, b) =>
              (a.orderLine?.order.orderNo ?? "").localeCompare(
                b.orderLine?.order.orderNo ?? ""
              ) || a.item.code.localeCompare(b.item.code)
          );
        if (rows.length === 0 && !line.isActive) return null;
        return (
          <Card key={line.id}>
            <h2 className="font-semibold text-sm mb-2">
              {line.code} — {line.name}{" "}
              <span className="text-gray-500 font-normal">
                (일일 CAPA {line.dailyCapacity?.toLocaleString() ?? "미설정"}/일)
              </span>
              {!line.isActive && <Badge color="gray">가동중지</Badge>}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-semibold text-gray-500 px-2 py-1 border-b min-w-64 sticky left-0 bg-white">
                      수주 / 품목 (주간 수량)
                    </th>
                    {dates.map((d, i) => (
                      <th
                        key={dateKeys[i]}
                        className={`text-center text-xs px-1 py-1 border-b min-w-16 ${
                          i >= WORKDAYS ? "bg-gray-50 text-gray-400" : "text-gray-600"
                        }`}
                      >
                        {dayLabel(d, weekStart)}
                      </th>
                    ))}
                    <th className="text-center text-xs text-gray-500 px-2 py-1 border-b">일별 합계</th>
                    <th className="border-b"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((w) => {
                    const cellQty = new Map(
                      w.dailyEntries.map((d) => [toDateKey(d.date), d.qty])
                    );
                    const dailyTotal = w.dailyEntries.reduce((s, d) => s + d.qty, 0);
                    const mismatch = w.dailyEntries.length > 0 && dailyTotal !== w.qty;
                    return (
                      <tr key={w.id}>
                        <td className="px-2 py-1 border-b text-sm sticky left-0 bg-white">
                          {w.orderLine ? (
                            <Link
                              href={`/orders/${w.orderLine.orderId}`}
                              className="text-blue-600 hover:underline font-mono text-xs"
                            >
                              {w.orderLine.order.orderNo}
                            </Link>
                          ) : (
                            <Badge color="gray">비수주</Badge>
                          )}{" "}
                          <span className="font-mono text-xs">{w.item.code}</span>
                          <span className="text-gray-500 text-xs"> ×{w.qty.toLocaleString()}</span>
                          {mismatch && <Badge color="amber">불일치</Badge>}
                        </td>
                        {dateKeys.map((dk, i) => (
                          <td key={dk} className={`border-b px-0.5 py-0.5 ${i >= WORKDAYS ? "bg-gray-50" : ""}`}>
                            <DailyCell
                              planEntryId={w.id}
                              dateKey={dk}
                              qty={cellQty.get(dk) ?? 0}
                              isWeekend={i >= WORKDAYS}
                            />
                          </td>
                        ))}
                        <td className="border-b text-right text-xs px-2 font-medium">
                          {dailyTotal > 0 ? dailyTotal.toLocaleString() : "·"}
                        </td>
                        <td className="border-b px-1">
                          {w.dailyEntries.length > 0 && (
                            <ActionButton
                              action={resetDailyForPlanEntry.bind(null, w.id)}
                              className={btnGhostCls}
                              confirmMessage="이 행의 일별 계획을 모두 삭제하고 분할 대상으로 되돌릴까요?"
                            >
                              초기화
                            </ActionButton>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={10} className={`${tdCls} text-gray-400 text-center`}>
                        이 주에 이 라인의 주간 계획이 없습니다
                      </td>
                    </tr>
                  )}
                  {rows.length > 0 && (
                    <tr className="bg-gray-50 font-medium">
                      <td className="px-2 py-1 border-b text-xs text-gray-600 sticky left-0 bg-gray-50">
                        부하 / 일일 CAPA {line.dailyCapacity?.toLocaleString() ?? "-"}
                      </td>
                      {dateKeys.map((dk, i) => {
                        const l = load.get(`${line.id}|${dk}`) ?? 0;
                        const capa = line.dailyCapacity ?? 0;
                        const pct = capa > 0 ? Math.round((l / capa) * 100) : 0;
                        const cls =
                          l === 0
                            ? "text-gray-300"
                            : capa > 0 && l > capa
                              ? "bg-red-100 text-red-700 font-bold"
                              : pct >= 80
                                ? "bg-amber-50 text-amber-700"
                                : "text-gray-700";
                        return (
                          <td key={dk} className={`border-b text-center text-xs px-1 py-1 ${cls} ${i >= WORKDAYS && l === 0 ? "bg-gray-50" : ""}`}>
                            {l > 0 ? (
                              <>
                                {l.toLocaleString()}
                                {capa > 0 && <div className="text-[10px]">{pct}%</div>}
                              </>
                            ) : (
                              "·"
                            )}
                          </td>
                        );
                      })}
                      <td className="border-b"></td>
                      <td className="border-b"></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

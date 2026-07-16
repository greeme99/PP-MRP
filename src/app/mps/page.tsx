import Link from "next/link";
import { prisma } from "@/lib/db";
import { generateDraftPlan, resetPlanForOrderLine } from "@/actions/plan";
import { ActionButton } from "@/components/action-form";
import { PlanCell } from "@/components/plan-cell";
import { Badge, Card, PageTitle, btnCls, btnGhostCls, tdCls } from "@/components/ui";
import {
  addWeeks,
  currentWeekStart,
  fromDateKey,
  toDateKey,
  weekDateLabel,
  weekLabel,
  weekRange,
  weekStartOf,
} from "@/lib/week";

export const dynamic = "force-dynamic";

const DEFAULT_WEEKS = 12;

type RowCell = { qty: number };
type Row = {
  orderLineId: number;
  orderId: number;
  orderNo: string;
  itemCode: string;
  itemName: string;
  orderQty: number;
  dueDateKey: string;
  dueWeekKey: string;
  lineStatus: string;
  cells: Map<string, RowCell>;
  plannedTotalAllLines: number; // 모든 라인·모든 주차 합계 (정합성 배지용)
  outsideQty: number; // 표시 범위 밖 수량 (이 라인 기준)
};

export default async function MpsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; weeks?: string }>;
}) {
  const sp = await searchParams;
  const from = sp.from
    ? weekStartOf(fromDateKey(sp.from))
    : currentWeekStart();
  const weeksCount = Math.min(
    Math.max(Number(sp.weeks) || DEFAULT_WEEKS, 4),
    26
  );
  const weeks = weekRange(from, weeksCount);
  const weekKeys = weeks.map(toDateKey);
  const weekKeySet = new Set(weekKeys);

  const [lines, entries, unplanned, results] = await Promise.all([
    prisma.productionLine.findMany({
      orderBy: { code: "asc" },
      where: { OR: [{ isActive: true }, { planEntries: { some: {} } }] },
    }),
    prisma.planEntry.findMany({
      where: { orderLineId: { not: null } },
      include: {
        orderLine: { include: { order: true, item: true } },
      },
    }),
    prisma.salesOrderLine.findMany({
      where: {
        status: "OPEN",
        order: { status: "OPEN" },
        planEntries: { none: {} },
      },
      include: { order: true, item: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.productionResult.findMany({
      where: { date: { gte: from, lt: addWeeks(from, weeksCount) } },
      select: { date: true, lineId: true, qty: true },
    }),
  ]);

  // 수주라인별 전체 계획 합계 (라인 불문)
  const totalByOrderLine = new Map<number, number>();
  for (const e of entries) {
    totalByOrderLine.set(
      e.orderLineId!,
      (totalByOrderLine.get(e.orderLineId!) ?? 0) + e.qty
    );
  }

  // 라인별 → 수주라인별 행 구성
  const rowsByLine = new Map<number, Map<number, Row>>();
  for (const e of entries) {
    const ol = e.orderLine!;
    let lineRows = rowsByLine.get(e.lineId);
    if (!lineRows) {
      lineRows = new Map();
      rowsByLine.set(e.lineId, lineRows);
    }
    let row = lineRows.get(ol.id);
    if (!row) {
      row = {
        orderLineId: ol.id,
        orderId: ol.orderId,
        orderNo: ol.order.orderNo,
        itemCode: ol.item.code,
        itemName: ol.item.name,
        orderQty: ol.qty,
        dueDateKey: toDateKey(ol.dueDate),
        dueWeekKey: toDateKey(weekStartOf(ol.dueDate)),
        lineStatus: ol.status,
        cells: new Map(),
        plannedTotalAllLines: totalByOrderLine.get(ol.id) ?? 0,
        outsideQty: 0,
      };
      lineRows.set(ol.id, row);
    }
    const key = toDateKey(e.weekStart);
    if (weekKeySet.has(key)) {
      row.cells.set(key, { qty: e.qty });
    } else {
      row.outsideQty += e.qty;
    }
  }

  // 라인×주차 부하 (범위 내)
  const load = new Map<string, number>();
  for (const e of entries) {
    const key = `${e.lineId}|${toDateKey(e.weekStart)}`;
    load.set(key, (load.get(key) ?? 0) + e.qty);
  }

  // 라인×주차 실적 합계 (범위 내)
  const resultLoad = new Map<string, number>();
  for (const r of results) {
    const key = `${r.lineId}|${toDateKey(weekStartOf(r.date))}`;
    resultLoad.set(key, (resultLoad.get(key) ?? 0) + r.qty);
  }

  const prevKey = toDateKey(addWeeks(from, -4));
  const nextKey = toDateKey(addWeeks(from, 4));
  const todayKey = toDateKey(currentWeekStart());

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <PageTitle>생산계획 (MPS) — 주 단위</PageTitle>
        <div className="flex gap-2 items-center">
          <Link href={`/mps?from=${prevKey}&weeks=${weeksCount}`} className={btnGhostCls}>
            ← 4주 이전
          </Link>
          <Link href={`/mps?from=${todayKey}&weeks=${weeksCount}`} className={btnGhostCls}>
            이번 주
          </Link>
          <Link href={`/mps?from=${nextKey}&weeks=${weeksCount}`} className={btnGhostCls}>
            4주 이후 →
          </Link>
          <ActionButton action={generateDraftPlan} className={btnCls}>
            초안 생성 (미계획 수주 → 납기주 배치)
          </ActionButton>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        셀에 수량을 입력하면 즉시 저장됩니다(0 입력 = 삭제, 수동 편집분은
        MANUAL로 표시). 파란 테두리 = 납기 주. 부하 행이 CAPA를 넘으면
        빨간색으로 표시됩니다.
      </p>

      {unplanned.length > 0 && (
        <Card>
          <h2 className="font-semibold text-sm mb-2">
            미계획 수주 라인 {unplanned.length}건
            <span className="font-normal text-gray-500 text-xs ml-2">
              — &quot;초안 생성&quot;을 누르면 납기 주에 자동 배치됩니다
            </span>
          </h2>
          <ul className="text-sm text-gray-700 flex flex-wrap gap-x-6 gap-y-1">
            {unplanned.map((l) => (
              <li key={l.id}>
                <Link href={`/orders/${l.orderId}`} className="text-blue-600 hover:underline font-mono">
                  {l.order.orderNo}
                </Link>{" "}
                <span className="font-mono">{l.item.code}</span> ×
                {l.qty.toLocaleString()} (납기 {toDateKey(l.dueDate)})
              </li>
            ))}
          </ul>
        </Card>
      )}

      {lines.map((line) => {
        const lineRows = Array.from(rowsByLine.get(line.id)?.values() ?? []).sort(
          (a, b) =>
            a.dueDateKey.localeCompare(b.dueDateKey) ||
            a.orderNo.localeCompare(b.orderNo)
        );
        return (
          <Card key={line.id}>
            <h2 className="font-semibold text-sm mb-2">
              {line.code} — {line.name}{" "}
              <span className="text-gray-500 font-normal">
                (CAPA {line.weeklyCapacity.toLocaleString()}/주)
              </span>
              {!line.isActive && <Badge color="gray">가동중지</Badge>}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-semibold text-gray-500 px-2 py-1 border-b min-w-64 sticky left-0 bg-white">
                      수주 / 품목
                    </th>
                    {weeks.map((w) => (
                      <th
                        key={toDateKey(w)}
                        className={`text-center text-xs px-1 py-1 border-b min-w-16 ${
                          toDateKey(w) === todayKey ? "bg-blue-50" : ""
                        }`}
                      >
                        <div className="font-semibold text-gray-600">{weekLabel(w)}</div>
                        <div className="text-gray-400">{weekDateLabel(w)}</div>
                      </th>
                    ))}
                    <th className="text-center text-xs text-gray-500 px-2 py-1 border-b">범위밖</th>
                    <th className="border-b"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineRows.map((row) => {
                    const mismatch =
                      row.lineStatus === "OPEN" &&
                      row.plannedTotalAllLines !== row.orderQty;
                    return (
                      <tr key={row.orderLineId}>
                        <td className="px-2 py-1 border-b text-sm sticky left-0 bg-white">
                          <Link href={`/orders/${row.orderId}`} className="text-blue-600 hover:underline font-mono text-xs">
                            {row.orderNo}
                          </Link>{" "}
                          <span className="font-mono text-xs">{row.itemCode}</span>
                          <span className="text-gray-500 text-xs">
                            {" "}×{row.orderQty.toLocaleString()} · 납기 {row.dueDateKey}
                          </span>
                          {mismatch && <Badge color="amber">수량 불일치</Badge>}
                          {row.lineStatus !== "OPEN" && (
                            <Badge color="gray">수주 {row.lineStatus === "CLOSED" ? "완료" : "취소"}</Badge>
                          )}
                        </td>
                        {weekKeys.map((wk) => (
                          <td key={wk} className={`border-b px-0.5 py-0.5 ${wk === todayKey ? "bg-blue-50" : ""}`}>
                            <PlanCell
                              orderLineId={row.orderLineId}
                              lineId={line.id}
                              weekStartKey={wk}
                              qty={row.cells.get(wk)?.qty ?? 0}
                              isDueWeek={wk === row.dueWeekKey}
                            />
                          </td>
                        ))}
                        <td className="border-b text-center text-xs text-gray-500">
                          {row.outsideQty > 0 ? row.outsideQty.toLocaleString() : ""}
                        </td>
                        <td className="border-b px-1">
                          <ActionButton
                            action={resetPlanForOrderLine.bind(null, row.orderLineId)}
                            className={btnGhostCls}
                            confirmMessage="이 수주라인의 계획을 모두 삭제하고 초안 생성 대상으로 되돌릴까요?"
                          >
                            초기화
                          </ActionButton>
                        </td>
                      </tr>
                    );
                  })}
                  {lineRows.length === 0 && (
                    <tr>
                      <td colSpan={weeksCount + 3} className={`${tdCls} text-gray-400 text-center`}>
                        이 라인에 배정된 계획이 없습니다
                      </td>
                    </tr>
                  )}
                  <tr className="bg-gray-50 font-medium">
                    <td className="px-2 py-1 border-b text-xs text-gray-600 sticky left-0 bg-gray-50">
                      부하 / CAPA {line.weeklyCapacity.toLocaleString()}
                    </td>
                    {weekKeys.map((wk) => {
                      const l = load.get(`${line.id}|${wk}`) ?? 0;
                      const pct = Math.round((l / line.weeklyCapacity) * 100);
                      const cls =
                        l === 0
                          ? "text-gray-300"
                          : l > line.weeklyCapacity
                            ? "bg-red-100 text-red-700 font-bold"
                            : pct >= 80
                              ? "bg-amber-50 text-amber-700"
                              : "text-gray-700";
                      return (
                        <td key={wk} className={`border-b text-center text-xs px-1 py-1 ${cls}`}>
                          {l > 0 ? (
                            <>
                              {l.toLocaleString()}
                              <div className="text-[10px]">{pct}%</div>
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
                  <tr className="bg-gray-50">
                    <td className="px-2 py-1 border-b text-xs text-green-700 sticky left-0 bg-gray-50">
                      실적 (달성률)
                    </td>
                    {weekKeys.map((wk) => {
                      const r = resultLoad.get(`${line.id}|${wk}`) ?? 0;
                      const l = load.get(`${line.id}|${wk}`) ?? 0;
                      const pct = l > 0 ? Math.round((r / l) * 100) : null;
                      return (
                        <td key={wk} className={`border-b text-center text-xs px-1 py-1 ${r === 0 ? "text-gray-300" : "text-green-700"}`}>
                          {r > 0 ? (
                            <>
                              {r.toLocaleString()}
                              {pct !== null && <div className="text-[10px]">{pct}%</div>}
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
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}

      <div className="text-right">
        <a
          href={`/api/export/mps?from=${toDateKey(from)}&weeks=${weeksCount}`}
          className={btnCls}
        >
          엑셀로 내보내기
        </a>
      </div>
    </div>
  );
}

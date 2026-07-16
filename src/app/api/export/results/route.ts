import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { achievementRate } from "@/lib/results";
import {
  addWeeks,
  currentWeekStart,
  fromDateKey,
  toDateKey,
  weekLabel,
  weekStartOf,
} from "@/lib/week";

export const runtime = "nodejs";

/** 주 단위 계획대비실적: 주간 계획 행별 실적/불량/달성률 + 계획 없는 실적 포함. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const weekStart = url.searchParams.get("week")
    ? weekStartOf(fromDateKey(url.searchParams.get("week")!))
    : currentWeekStart();
  const weekEnd = addWeeks(weekStart, 1);

  const [weekly, results] = await Promise.all([
    prisma.planEntry.findMany({
      where: { weekStart },
      include: {
        orderLine: { include: { order: true } },
        item: true,
        line: true,
      },
    }),
    prisma.productionResult.findMany({
      where: { date: { gte: weekStart, lt: weekEnd } },
      include: {
        orderLine: { include: { order: true } },
        item: true,
        line: true,
      },
    }),
  ]);

  const groupKey = (lineId: number, itemId: number, orderLineId: number | null) =>
    `${lineId}|${itemId}|${orderLineId ?? "-"}`;
  const resultAgg = new Map<string, { qty: number; defectQty: number }>();
  for (const r of results) {
    const k = groupKey(r.lineId, r.itemId, r.orderLineId);
    const agg = resultAgg.get(k) ?? { qty: 0, defectQty: 0 };
    agg.qty += r.qty;
    agg.defectQty += r.defectQty;
    resultAgg.set(k, agg);
  }

  const workbook = new ExcelJS.Workbook();

  // 시트 1: 주간 계획 대비 실적 요약
  const ws = workbook.addWorksheet("계획대비실적");
  ws.addRow([`계획대비실적 — ${weekLabel(weekStart)} (${toDateKey(weekStart)} 주)`]).font =
    { bold: true, size: 14 };
  ws.addRow([]);
  ws.addRow([
    "라인",
    "수주번호",
    "품목코드",
    "품명",
    "계획수량",
    "실적(양품)",
    "불량",
    "달성률(%)",
  ]).font = { bold: true };

  const seenKeys = new Set<string>();
  for (const w of [...weekly].sort((a, b) => a.line.code.localeCompare(b.line.code))) {
    const k = groupKey(w.lineId, w.itemId, w.orderLineId);
    seenKeys.add(k);
    const agg = resultAgg.get(k) ?? { qty: 0, defectQty: 0 };
    ws.addRow([
      w.line.code,
      w.orderLine?.order.orderNo ?? "-",
      w.item.code,
      w.item.name,
      w.qty,
      agg.qty || null,
      agg.defectQty || null,
      achievementRate(w.qty, agg.qty),
    ]);
  }
  // 계획 없이 입력된 실적 (이월로 계획이 삭제된 경우 등)
  for (const r of results) {
    const k = groupKey(r.lineId, r.itemId, r.orderLineId);
    if (seenKeys.has(k)) continue;
    seenKeys.add(k);
    const agg = resultAgg.get(k)!;
    ws.addRow([
      r.line.code,
      r.orderLine?.order.orderNo ?? "-",
      r.item.code,
      r.item.name,
      null,
      agg.qty || null,
      agg.defectQty || null,
      null,
    ]);
  }
  ws.columns.forEach((c, i) => {
    c.width = i === 3 ? 26 : 13;
  });

  // 시트 2: 일별 실적 플랫
  const flat = workbook.addWorksheet("일별실적");
  flat.addRow([
    "일자",
    "라인",
    "수주번호",
    "품목코드",
    "품명",
    "실적(양품)",
    "불량",
  ]).font = { bold: true };
  for (const r of [...results].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.lineId - b.lineId
  )) {
    flat.addRow([
      toDateKey(r.date),
      r.line.code,
      r.orderLine?.order.orderNo ?? "-",
      r.item.code,
      r.item.name,
      r.qty || null,
      r.defectQty || null,
    ]);
  }
  flat.columns.forEach((c, i) => {
    c.width = i === 4 ? 26 : 13;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = encodeURIComponent(
    `계획대비실적_${toDateKey(weekStart)}주.xlsx`
  );
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
    },
  });
}

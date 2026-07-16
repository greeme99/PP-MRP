import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { dayLabel, weekDates } from "@/lib/daily";
import {
  currentWeekStart,
  fromDateKey,
  toDateKey,
  weekLabel,
  weekStartOf,
} from "@/lib/week";

export const runtime = "nodejs";

/** 주 단위 작업지시서: 라인별 일별 생산계획. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const weekStart = url.searchParams.get("week")
    ? weekStartOf(fromDateKey(url.searchParams.get("week")!))
    : currentWeekStart();
  const dates = weekDates(weekStart);
  const dateKeys = dates.map(toDateKey);

  const weekly = await prisma.planEntry.findMany({
    where: { weekStart },
    include: {
      orderLine: { include: { order: true } },
      item: true,
      line: true,
      dailyEntries: true,
    },
    orderBy: [{ lineId: "asc" }],
  });

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("작업지시서");
  ws.addRow([`작업지시서 — ${weekLabel(weekStart)} (${toDateKey(weekStart)} 주)`]).font = {
    bold: true,
    size: 14,
  };
  ws.addRow([]);
  const header = ws.addRow([
    "라인",
    "수주번호",
    "품목코드",
    "품명",
    "주간수량",
    "납기일",
    ...dates.map((d) => dayLabel(d, weekStart)),
    "합계",
  ]);
  header.font = { bold: true };

  const sorted = [...weekly].sort(
    (a, b) =>
      a.line.code.localeCompare(b.line.code) ||
      (a.orderLine?.order.orderNo ?? "").localeCompare(
        b.orderLine?.order.orderNo ?? ""
      )
  );
  for (const w of sorted) {
    const cellQty = new Map(
      w.dailyEntries.map((d) => [toDateKey(d.date), d.qty])
    );
    const total = w.dailyEntries.reduce((s, d) => s + d.qty, 0);
    ws.addRow([
      w.line.code,
      w.orderLine?.order.orderNo ?? "-",
      w.item.code,
      w.item.name,
      w.qty,
      w.orderLine ? toDateKey(w.orderLine.dueDate) : "-",
      ...dateKeys.map((k) => cellQty.get(k) ?? null),
      total || null,
    ]);
  }
  ws.columns.forEach((c, i) => {
    c.width = i === 3 ? 26 : 12;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = encodeURIComponent(`작업지시서_${toDateKey(weekStart)}주.xlsx`);
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
    },
  });
}

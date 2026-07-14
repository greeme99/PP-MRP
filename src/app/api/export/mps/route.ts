import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import {
  currentWeekStart,
  fromDateKey,
  toDateKey,
  weekLabel,
  weekRange,
  weekStartOf,
} from "@/lib/week";

export const runtime = "nodejs";

const RED_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFC7CE" },
};
const GRAY_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF2F2F2" },
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from")
    ? weekStartOf(fromDateKey(url.searchParams.get("from")!))
    : currentWeekStart();
  const weeksCount = Math.min(
    Math.max(Number(url.searchParams.get("weeks")) || 12, 4),
    26
  );
  const weeks = weekRange(from, weeksCount);
  const weekKeys = weeks.map(toDateKey);
  const weekKeySet = new Set(weekKeys);

  const [lines, entries] = await Promise.all([
    prisma.productionLine.findMany({
      orderBy: { code: "asc" },
      where: { OR: [{ isActive: true }, { planEntries: { some: {} } }] },
    }),
    prisma.planEntry.findMany({
      where: { orderLineId: { not: null } },
      include: { orderLine: { include: { order: true, item: true } } },
    }),
  ]);

  const workbook = new ExcelJS.Workbook();

  // ---- 시트 1: 주간 그리드 ----
  const grid = workbook.addWorksheet("MPS");
  grid.columns = [
    { width: 14 },
    { width: 16 },
    { width: 24 },
    { width: 10 },
    { width: 12 },
    ...weeks.map(() => ({ width: 10 })),
    { width: 10 },
    { width: 10 },
  ];

  for (const line of lines) {
    const lineEntries = entries.filter((e) => e.lineId === line.id);

    const titleRow = grid.addRow([
      `${line.code} — ${line.name} (CAPA ${line.weeklyCapacity.toLocaleString()}/주)`,
    ]);
    titleRow.font = { bold: true, size: 12 };

    const headerRow = grid.addRow([
      "수주번호",
      "품목코드",
      "품명",
      "수주수량",
      "납기일",
      ...weeks.map((w) => weekLabel(w)),
      "범위밖",
      "합계",
    ]);
    headerRow.font = { bold: true };
    headerRow.eachCell((c) => {
      c.fill = GRAY_FILL;
    });

    // 수주라인별 행
    const byOrderLine = new Map<number, typeof lineEntries>();
    for (const e of lineEntries) {
      const list = byOrderLine.get(e.orderLineId!) ?? [];
      list.push(e);
      byOrderLine.set(e.orderLineId!, list);
    }
    const sorted = [...byOrderLine.values()].sort(
      (a, b) =>
        a[0].orderLine!.dueDate.getTime() - b[0].orderLine!.dueDate.getTime()
    );

    for (const group of sorted) {
      const ol = group[0].orderLine!;
      const cells = new Map<string, number>();
      let outside = 0;
      let total = 0;
      for (const e of group) {
        const key = toDateKey(e.weekStart);
        total += e.qty;
        if (weekKeySet.has(key)) cells.set(key, (cells.get(key) ?? 0) + e.qty);
        else outside += e.qty;
      }
      grid.addRow([
        ol.order.orderNo,
        ol.item.code,
        ol.item.name,
        ol.qty,
        toDateKey(ol.dueDate),
        ...weekKeys.map((k) => cells.get(k) ?? null),
        outside || null,
        total,
      ]);
    }

    // 부하/가동률 행
    const load = new Map<string, number>();
    for (const e of lineEntries) {
      const key = toDateKey(e.weekStart);
      if (weekKeySet.has(key)) load.set(key, (load.get(key) ?? 0) + e.qty);
    }
    const loadRow = grid.addRow([
      "부하 합계",
      "",
      "",
      "",
      "",
      ...weekKeys.map((k) => load.get(k) ?? null),
      null,
      null,
    ]);
    loadRow.font = { bold: true };
    weekKeys.forEach((k, i) => {
      const cell = loadRow.getCell(6 + i);
      if ((load.get(k) ?? 0) > line.weeklyCapacity) {
        cell.fill = RED_FILL;
      }
    });
    const utilRow = grid.addRow([
      "가동률(%)",
      "",
      "",
      "",
      "",
      ...weekKeys.map((k) =>
        load.get(k)
          ? Math.round(((load.get(k) ?? 0) / line.weeklyCapacity) * 100)
          : null
      ),
      null,
      null,
    ]);
    utilRow.font = { italic: true };
    grid.addRow([]);
  }

  // ---- 시트 2: 플랫 목록 ----
  const flat = workbook.addWorksheet("계획목록");
  flat.addRow([
    "라인코드",
    "수주번호",
    "행번호",
    "품목코드",
    "품명",
    "주시작일",
    "주차",
    "수량",
    "구분",
  ]).font = { bold: true };
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const sortedEntries = [...entries].sort(
    (a, b) =>
      a.weekStart.getTime() - b.weekStart.getTime() ||
      a.lineId - b.lineId ||
      a.orderLineId! - b.orderLineId!
  );
  for (const e of sortedEntries) {
    flat.addRow([
      lineById.get(e.lineId)?.code ?? e.lineId,
      e.orderLine!.order.orderNo,
      e.orderLine!.lineNo,
      e.orderLine!.item.code,
      e.orderLine!.item.name,
      toDateKey(e.weekStart),
      weekLabel(e.weekStart),
      e.qty,
      e.source,
    ]);
  }
  flat.columns.forEach((c) => {
    c.width = 14;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = encodeURIComponent(
    `생산계획_${toDateKey(from)}_${weeksCount}주.xlsx`
  );
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
    },
  });
}

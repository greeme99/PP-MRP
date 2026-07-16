import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { netRequirements } from "@/lib/inventory";
import { explodeRequirements, roundQty } from "@/lib/mrp";
import {
  addWeeks,
  currentWeekStart,
  fromDateKey,
  toDateKey,
  weekLabel,
  weekRange,
  weekStartOf,
} from "@/lib/week";
import { ITEM_TYPE_LABEL } from "@/components/ui";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from")
    ? weekStartOf(fromDateKey(url.searchParams.get("from")!))
    : currentWeekStart();
  const weeksCount = Math.min(
    Math.max(Number(url.searchParams.get("weeks")) || 12, 4),
    26
  );
  const typeFilter = url.searchParams.get("type") === "ALL" ? "ALL" : "RM";
  const view = url.searchParams.get("view") === "gross" ? "gross" : "net";
  const weeks = weekRange(from, weeksCount);
  const weekKeys = weeks.map(toDateKey);

  const [entries, edges, txSums] = await Promise.all([
    prisma.planEntry.findMany({
      where: {
        weekStart: {
          gte: from,
          lt: addWeeks(from, weeksCount),
        },
      },
      select: { itemId: true, weekStart: true, qty: true },
    }),
    prisma.bomLine.findMany({
      select: { parentItemId: true, childItemId: true, qtyPer: true },
    }),
    prisma.inventoryTx.groupBy({ by: ["itemId"], _sum: { qty: true } }),
  ]);

  const gross = explodeRequirements(entries, edges);
  const onHand = new Map(txSums.map((t) => [t.itemId, t._sum.qty ?? 0]));
  const { net } = netRequirements(gross, onHand);
  const req2 = view === "net" ? net : gross;

  const items = await prisma.item.findMany({
    where: { id: { in: [...gross.keys()] } },
  });
  const rows = items
    .filter((i) => typeFilter === "ALL" || i.type === "RM")
    .filter((i) => view === "gross" || net.has(i.id))
    .sort(
      (a, b) => a.type.localeCompare(b.type) || a.code.localeCompare(b.code)
    );

  const sheetTitle = view === "net" ? "순소요" : "총소요";
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(`자재${sheetTitle}`);
  const header = ws.addRow([
    "품목코드",
    "품명",
    "유형",
    "단위",
    "현재고",
    ...weeks.map((w) => weekLabel(w)),
    "합계",
  ]);
  header.font = { bold: true };

  for (const item of rows) {
    const weekMap = req2.get(item.id) ?? new Map<string, number>();
    const total = roundQty([...weekMap.values()].reduce((s, q) => s + q, 0));
    ws.addRow([
      item.code,
      item.name,
      ITEM_TYPE_LABEL[item.type],
      item.uom,
      onHand.get(item.id) ?? 0,
      ...weekKeys.map((k) =>
        weekMap.get(k) ? roundQty(weekMap.get(k)!) : null
      ),
      total,
    ]);
  }
  ws.columns.forEach((c, i) => {
    c.width = i === 1 ? 26 : 12;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = encodeURIComponent(
    `자재${sheetTitle}_${toDateKey(from)}_${weeksCount}주.xlsx`
  );
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
    },
  });
}

// 파싱된 Excel 행을 DB에 반영한다. 시트 단위 all-or-nothing 트랜잭션.
import { prisma } from "@/lib/db";
import { hasCycle } from "@/lib/bom";
import type {
  BomRow,
  ImportError,
  InventoryRow,
  ItemRow,
  OrderRow,
  PartnerRow,
} from "./import";

export type SheetApplyResult = {
  sheet: string;
  imported: number;
  errors: ImportError[];
};

export async function applyPartners(
  rows: PartnerRow[]
): Promise<SheetApplyResult> {
  await prisma.$transaction(
    rows.map((r) =>
      prisma.partner.upsert({
        where: { code: r.code },
        update: { name: r.name, type: r.type, contact: r.contact ?? null },
        create: {
          code: r.code,
          name: r.name,
          type: r.type,
          contact: r.contact,
        },
      })
    )
  );
  return { sheet: "거래처", imported: rows.length, errors: [] };
}

export async function applyItems(rows: ItemRow[]): Promise<SheetApplyResult> {
  const lineCodes = [
    ...new Set(rows.map((r) => r.defaultLineCode).filter(Boolean)),
  ] as string[];
  const lines = await prisma.productionLine.findMany({
    where: { code: { in: lineCodes } },
  });
  const lineByCode = new Map(lines.map((l) => [l.code, l.id]));

  const errors: ImportError[] = rows
    .filter((r) => r.defaultLineCode && !lineByCode.has(r.defaultLineCode))
    .map((r) => ({
      sheet: "품목",
      row: r.row,
      column: "기본라인코드",
      message: `등록되지 않은 라인코드입니다: ${r.defaultLineCode} (라인 화면에서 먼저 등록하세요)`,
    }));
  if (errors.length > 0) return { sheet: "품목", imported: 0, errors };

  await prisma.$transaction(
    rows.map((r) => {
      const defaultLineId = r.defaultLineCode
        ? lineByCode.get(r.defaultLineCode)
        : null;
      const data = {
        name: r.name,
        type: r.type,
        uom: r.uom,
        spec: r.spec ?? null,
        defaultLineId,
      };
      return prisma.item.upsert({
        where: { code: r.code },
        update: data,
        create: { code: r.code, ...data },
      });
    })
  );
  return { sheet: "품목", imported: rows.length, errors: [] };
}

export async function applyBom(rows: BomRow[]): Promise<SheetApplyResult> {
  const codes = [
    ...new Set(rows.flatMap((r) => [r.parentCode, r.childCode])),
  ];
  const items = await prisma.item.findMany({ where: { code: { in: codes } } });
  const itemByCode = new Map(items.map((i) => [i.code, i.id]));

  const errors: ImportError[] = [];
  for (const r of rows) {
    if (!itemByCode.has(r.parentCode))
      errors.push({
        sheet: "BOM",
        row: r.row,
        column: "모품목코드",
        message: `등록되지 않은 품목코드입니다: ${r.parentCode}`,
      });
    if (!itemByCode.has(r.childCode))
      errors.push({
        sheet: "BOM",
        row: r.row,
        column: "자품목코드",
        message: `등록되지 않은 품목코드입니다: ${r.childCode}`,
      });
  }
  if (errors.length > 0) return { sheet: "BOM", imported: 0, errors };

  // 기존 간선 + 신규 간선 병합 후 순환 검사
  const existing = await prisma.bomLine.findMany({
    select: { parentItemId: true, childItemId: true },
  });
  const incoming = rows.map((r) => ({
    parentItemId: itemByCode.get(r.parentCode)!,
    childItemId: itemByCode.get(r.childCode)!,
  }));
  const merged = new Map(
    [...existing, ...incoming].map((e) => [
      `${e.parentItemId}|${e.childItemId}`,
      e,
    ])
  );
  if (hasCycle([...merged.values()])) {
    return {
      sheet: "BOM",
      imported: 0,
      errors: [
        {
          sheet: "BOM",
          row: 0,
          column: "",
          message:
            "반영하면 순환 BOM이 생깁니다. 모품목-자품목 관계를 확인하세요 (전체 미반영)",
        },
      ],
    };
  }

  await prisma.$transaction(
    rows.map((r) => {
      const parentItemId = itemByCode.get(r.parentCode)!;
      const childItemId = itemByCode.get(r.childCode)!;
      return prisma.bomLine.upsert({
        where: { parentItemId_childItemId: { parentItemId, childItemId } },
        update: { qtyPer: r.qtyPer },
        create: { parentItemId, childItemId, qtyPer: r.qtyPer },
      });
    })
  );
  return { sheet: "BOM", imported: rows.length, errors: [] };
}

export async function applyOrders(rows: OrderRow[]): Promise<SheetApplyResult> {
  const customerCodes = [...new Set(rows.map((r) => r.customerCode))];
  const itemCodes = [...new Set(rows.map((r) => r.itemCode))];
  const [customers, items] = await Promise.all([
    prisma.partner.findMany({ where: { code: { in: customerCodes } } }),
    prisma.item.findMany({ where: { code: { in: itemCodes } } }),
  ]);
  const customerByCode = new Map(customers.map((c) => [c.code, c.id]));
  const itemByCode = new Map(items.map((i) => [i.code, i.id]));

  const errors: ImportError[] = [];
  for (const r of rows) {
    if (!customerByCode.has(r.customerCode))
      errors.push({
        sheet: "수주",
        row: r.row,
        column: "고객사코드",
        message: `등록되지 않은 거래처코드입니다: ${r.customerCode}`,
      });
    if (!itemByCode.has(r.itemCode))
      errors.push({
        sheet: "수주",
        row: r.row,
        column: "품목코드",
        message: `등록되지 않은 품목코드입니다: ${r.itemCode}`,
      });
  }
  // 같은 수주번호에 서로 다른 고객사코드가 섞여 있으면 에러
  const customerByOrder = new Map<string, string>();
  for (const r of rows) {
    const prev = customerByOrder.get(r.orderNo);
    if (prev && prev !== r.customerCode) {
      errors.push({
        sheet: "수주",
        row: r.row,
        column: "고객사코드",
        message: `수주번호 ${r.orderNo}에 서로 다른 고객사코드가 있습니다 (${prev} ≠ ${r.customerCode})`,
      });
    }
    customerByOrder.set(r.orderNo, r.customerCode);
  }
  if (errors.length > 0) return { sheet: "수주", imported: 0, errors };

  // 수주번호별로 묶어 헤더 upsert 후 라인 upsert
  const byOrder = new Map<string, OrderRow[]>();
  for (const r of rows) {
    const list = byOrder.get(r.orderNo) ?? [];
    list.push(r);
    byOrder.set(r.orderNo, list);
  }

  await prisma.$transaction(async (tx) => {
    for (const [orderNo, orderRows] of byOrder) {
      const first = orderRows[0];
      const order = await tx.salesOrder.upsert({
        where: { orderNo },
        update: {
          customerId: customerByCode.get(first.customerCode)!,
          orderDate: first.orderDate,
        },
        create: {
          orderNo,
          customerId: customerByCode.get(first.customerCode)!,
          orderDate: first.orderDate,
        },
      });
      for (const r of orderRows) {
        await tx.salesOrderLine.upsert({
          where: { orderId_lineNo: { orderId: order.id, lineNo: r.lineNo } },
          update: {
            itemId: itemByCode.get(r.itemCode)!,
            qty: r.qty,
            dueDate: r.dueDate,
          },
          create: {
            orderId: order.id,
            lineNo: r.lineNo,
            itemId: itemByCode.get(r.itemCode)!,
            qty: r.qty,
            dueDate: r.dueDate,
          },
        });
      }
    }
  });
  return { sheet: "수주", imported: rows.length, errors: [] };
}

/** 재고 실사 이관: 실사 절대수량과 현재고의 차이를 ADJUST 트랜잭션으로 기록한다. */
export async function applyInventory(
  rows: InventoryRow[]
): Promise<SheetApplyResult> {
  const codes = [...new Set(rows.map((r) => r.itemCode))];
  const items = await prisma.item.findMany({ where: { code: { in: codes } } });
  const itemByCode = new Map(items.map((i) => [i.code, i.id]));

  const errors: ImportError[] = rows
    .filter((r) => !itemByCode.has(r.itemCode))
    .map((r) => ({
      sheet: "재고",
      row: r.row,
      column: "품목코드",
      message: `등록되지 않은 품목코드입니다: ${r.itemCode}`,
    }));
  if (errors.length > 0) return { sheet: "재고", imported: 0, errors };

  const today = new Date(
    `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`
  );
  const sums = await prisma.inventoryTx.groupBy({
    by: ["itemId"],
    where: { itemId: { in: items.map((i) => i.id) } },
    _sum: { qty: true },
  });
  const currentByItem = new Map(sums.map((s) => [s.itemId, s._sum.qty ?? 0]));

  let applied = 0;
  await prisma.$transaction(async (tx) => {
    for (const r of rows) {
      const itemId = itemByCode.get(r.itemCode)!;
      const current = currentByItem.get(itemId) ?? 0;
      const delta = r.actualQty - current;
      if (delta === 0) continue;
      await tx.inventoryTx.create({
        data: {
          itemId,
          type: "ADJUST",
          qty: delta,
          date: r.date ?? today,
          memo: `엑셀 실사 이관 (${current.toLocaleString()} → ${r.actualQty.toLocaleString()})`,
        },
      });
      applied++;
    }
  });
  return { sheet: "재고", imported: applied, errors: [] };
}

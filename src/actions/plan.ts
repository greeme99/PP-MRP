"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateDraftEntries } from "@/lib/planning";
import { fromDateKey, weekStartOf } from "@/lib/week";
import type { ActionResult } from "./items";

/** OPEN 수주라인 중 계획이 없는 것을 납기주에 배치한다 (멱등). */
export async function generateDraftPlan(): Promise<ActionResult> {
  const [orderLines, lines] = await Promise.all([
    prisma.salesOrderLine.findMany({
      where: { status: "OPEN", order: { status: "OPEN" } },
      include: {
        item: { select: { defaultLineId: true } },
        planEntries: { select: { id: true } },
      },
    }),
    prisma.productionLine.findMany({ select: { id: true, isActive: true } }),
  ]);

  const { entries, skipped } = generateDraftEntries(
    orderLines.map((ol) => ({
      id: ol.id,
      itemId: ol.itemId,
      qty: ol.qty,
      dueDate: ol.dueDate,
      defaultLineId: ol.item.defaultLineId,
      hasPlan: ol.planEntries.length > 0,
    })),
    lines
  );

  if (entries.length > 0) {
    await prisma.planEntry.createMany({
      data: entries.map((e) => ({ ...e, source: "AUTO" as const })),
    });
  }

  revalidatePath("/mps");
  const parts = [`신규 계획 ${entries.length}건 생성`];
  if (skipped.length > 0) {
    parts.push(`제외 ${skipped.length}건 (${skipped[0].reason})`);
  }
  return { ok: true, message: parts.join(", ") };
}

const cellSchema = z.object({
  orderLineId: z.coerce.number().int().positive(),
  lineId: z.coerce.number().int().positive(),
  weekStartKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  qty: z.coerce.number().int().min(0, "수량은 0 이상이어야 합니다"),
});

/** MPS 셀 편집: qty>0 upsert(MANUAL), qty=0 삭제. */
export async function setPlanCell(input: {
  orderLineId: number;
  lineId: number;
  weekStartKey: string;
  qty: number;
}): Promise<ActionResult> {
  const parsed = cellSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const { orderLineId, lineId, qty } = parsed.data;
  const weekStart = weekStartOf(fromDateKey(parsed.data.weekStartKey));

  const where = {
    orderLineId_lineId_weekStart: { orderLineId, lineId, weekStart },
  };
  if (qty === 0) {
    await prisma.planEntry.deleteMany({
      where: { orderLineId, lineId, weekStart },
    });
  } else {
    const orderLine = await prisma.salesOrderLine.findUnique({
      where: { id: orderLineId },
    });
    if (!orderLine) return { ok: false, message: "수주 라인이 없습니다" };
    await prisma.planEntry.upsert({
      where,
      update: { qty, source: "MANUAL" },
      create: {
        orderLineId,
        lineId,
        weekStart,
        qty,
        itemId: orderLine.itemId,
        source: "MANUAL",
      },
    });
  }
  revalidatePath("/mps");
  return { ok: true };
}

/** 수주라인의 계획 전체 삭제 → 다음 초안 생성 대상으로 복귀. */
export async function resetPlanForOrderLine(
  orderLineId: number
): Promise<ActionResult> {
  await prisma.planEntry.deleteMany({ where: { orderLineId } });
  revalidatePath("/mps");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { computeCarryover } from "@/lib/results";
import { addWeeks, fromDateKey } from "@/lib/week";
import type { ActionResult } from "./items";

const cellSchema = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lineId: z.coerce.number().int().positive(),
  itemId: z.coerce.number().int().positive(),
  orderLineId: z.coerce.number().int().positive().nullable(),
  field: z.enum(["qty", "defectQty"]),
  value: z.coerce.number().int().min(0, "수량은 0 이상이어야 합니다"),
});

/** 실적 셀 편집: 양품(qty) 또는 불량(defectQty) 입력. 둘 다 0이면 행 삭제. */
export async function setResultCell(input: {
  dateKey: string;
  lineId: number;
  itemId: number;
  orderLineId: number | null;
  field: "qty" | "defectQty";
  value: number;
}): Promise<ActionResult> {
  const parsed = cellSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const { lineId, itemId, orderLineId, field, value } = parsed.data;
  const date = fromDateKey(parsed.data.dateKey);

  // 복합 unique에 nullable(orderLineId)이 있어 upsert 대신 findFirst 사용
  const existing = await prisma.productionResult.findFirst({
    where: { date, lineId, itemId, orderLineId },
  });

  if (existing) {
    const next = { qty: existing.qty, defectQty: existing.defectQty, [field]: value };
    if (next.qty === 0 && next.defectQty === 0) {
      await prisma.productionResult.delete({ where: { id: existing.id } });
    } else {
      await prisma.productionResult.update({
        where: { id: existing.id },
        data: { [field]: value },
      });
    }
  } else if (value > 0) {
    await prisma.productionResult.create({
      data: { date, lineId, itemId, orderLineId, [field]: value },
    });
  }
  revalidatePath("/daily");
  revalidatePath("/mps");
  return { ok: true };
}

/**
 * 주간 계획 미달 잔량을 다음 주로 이월한다 (사람이 버튼으로 결정).
 * 이번 주 계획 수량 = 실적 합계로 줄이고(실적 0이면 계획 삭제),
 * 잔량은 다음 주 같은 수주라인×라인 계획에 합산(MANUAL).
 */
export async function carryoverRemainder(
  planEntryId: number
): Promise<ActionResult> {
  const plan = await prisma.planEntry.findUnique({
    where: { id: planEntryId },
  });
  if (!plan) return { ok: false, message: "계획이 없습니다" };

  const weekEnd = addWeeks(plan.weekStart, 1);
  const results = await prisma.productionResult.aggregate({
    where: {
      lineId: plan.lineId,
      itemId: plan.itemId,
      orderLineId: plan.orderLineId,
      date: { gte: plan.weekStart, lt: weekEnd },
    },
    _sum: { qty: true },
  });
  const resultQty = results._sum.qty ?? 0;

  const carry = computeCarryover(plan.qty, resultQty);
  if (!carry) {
    return { ok: false, message: "이월할 잔량이 없습니다 (실적 ≥ 계획)" };
  }

  const nextWeek = addWeeks(plan.weekStart, 1);
  await prisma.$transaction(async (tx) => {
    if (carry.newQty === 0) {
      await tx.planEntry.delete({ where: { id: plan.id } }); // 일별계획도 연쇄 삭제
    } else {
      await tx.planEntry.update({
        where: { id: plan.id },
        data: { qty: carry.newQty, source: "MANUAL" },
      });
    }
    const existing = await tx.planEntry.findFirst({
      where: {
        orderLineId: plan.orderLineId,
        lineId: plan.lineId,
        weekStart: nextWeek,
      },
    });
    if (existing) {
      await tx.planEntry.update({
        where: { id: existing.id },
        data: { qty: existing.qty + carry.carryQty, source: "MANUAL" },
      });
    } else {
      await tx.planEntry.create({
        data: {
          orderLineId: plan.orderLineId,
          itemId: plan.itemId,
          lineId: plan.lineId,
          weekStart: nextWeek,
          qty: carry.carryQty,
          source: "MANUAL",
        },
      });
    }
  });

  revalidatePath("/daily");
  revalidatePath("/mps");
  return {
    ok: true,
    message: `잔량 ${carry.carryQty.toLocaleString()}을 다음 주로 이월했습니다`,
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { ActionResult } from "./items";

const txSchema = z.object({
  itemId: z.coerce.number().int().positive("품목을 선택하세요"),
  type: z.enum(["IN", "OUT"]),
  qty: z.coerce.number().int().positive("수량은 1 이상이어야 합니다"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식(YYYY-MM-DD)이 아닙니다")
    .transform((s) => new Date(`${s}T00:00:00.000Z`)),
  memo: z.string().trim().optional(),
});

/** 입고/출고 등록. 출고는 음수로 저장한다. */
export async function addInventoryTx(
  formData: FormData
): Promise<ActionResult> {
  const parsed = txSchema.safeParse({
    itemId: formData.get("itemId"),
    type: formData.get("type"),
    qty: formData.get("qty"),
    date: formData.get("date"),
    memo: formData.get("memo") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const { itemId, type, qty, date, memo } = parsed.data;
  await prisma.inventoryTx.create({
    data: { itemId, type, qty: type === "OUT" ? -qty : qty, date, memo },
  });
  revalidatePath("/inventory");
  revalidatePath("/mrp");
  return { ok: true };
}

const adjustSchema = z.object({
  itemId: z.coerce.number().int().positive("품목을 선택하세요"),
  actualQty: z.coerce.number().int().min(0, "실사 수량은 0 이상이어야 합니다"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식(YYYY-MM-DD)이 아닙니다")
    .transform((s) => new Date(`${s}T00:00:00.000Z`)),
});

/** 실사 조정: 절대수량을 입력하면 현재고와의 차이를 ADJUST로 기록한다. */
export async function adjustInventory(
  formData: FormData
): Promise<ActionResult> {
  const parsed = adjustSchema.safeParse({
    itemId: formData.get("itemId"),
    actualQty: formData.get("actualQty"),
    date: formData.get("date"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const { itemId, actualQty, date } = parsed.data;
  const agg = await prisma.inventoryTx.aggregate({
    where: { itemId },
    _sum: { qty: true },
  });
  const current = agg._sum.qty ?? 0;
  const delta = actualQty - current;
  if (delta === 0) {
    return { ok: true, message: "현재고와 동일합니다 (조정 없음)" };
  }
  await prisma.inventoryTx.create({
    data: {
      itemId,
      type: "ADJUST",
      qty: delta,
      date,
      memo: `실사 조정 (${current.toLocaleString()} → ${actualQty.toLocaleString()})`,
    },
  });
  revalidatePath("/inventory");
  revalidatePath("/mrp");
  return { ok: true };
}

/** 잘못 입력한 트랜잭션 삭제 */
export async function deleteInventoryTx(id: number): Promise<ActionResult> {
  await prisma.inventoryTx.delete({ where: { id } });
  revalidatePath("/inventory");
  revalidatePath("/mrp");
  return { ok: true };
}

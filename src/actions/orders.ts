"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { ActionResult } from "./items";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식(YYYY-MM-DD)이 아닙니다")
  .transform((s) => new Date(`${s}T00:00:00.000Z`));

const orderSchema = z.object({
  orderNo: z.string().trim().min(1, "수주번호는 필수입니다"),
  customerId: z.coerce.number().int().positive("고객사를 선택하세요"),
  orderDate: dateString,
  memo: z.string().trim().optional(),
});

const orderLineSchema = z.object({
  itemId: z.coerce.number().int().positive("품목을 선택하세요"),
  qty: z.coerce.number().int().positive("수량은 1 이상이어야 합니다"),
  dueDate: dateString,
});

export async function createOrder(formData: FormData): Promise<ActionResult> {
  const parsed = orderSchema.safeParse({
    orderNo: formData.get("orderNo"),
    customerId: formData.get("customerId"),
    orderDate: formData.get("orderDate"),
    memo: formData.get("memo") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  try {
    await prisma.salesOrder.create({ data: parsed.data });
  } catch {
    return { ok: false, message: "저장 실패: 수주번호 중복 여부를 확인하세요" };
  }
  revalidatePath("/orders");
  return { ok: true };
}

export async function addOrderLine(
  orderId: number,
  formData: FormData
): Promise<ActionResult> {
  const parsed = orderLineSchema.safeParse({
    itemId: formData.get("itemId"),
    qty: formData.get("qty"),
    dueDate: formData.get("dueDate"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    include: { lines: { select: { lineNo: true } } },
  });
  if (!order) return { ok: false, message: "수주가 없습니다" };
  if (order.status !== "OPEN") {
    return { ok: false, message: "진행중(OPEN) 수주에만 라인을 추가할 수 있습니다" };
  }
  const nextLineNo =
    order.lines.reduce((max, l) => Math.max(max, l.lineNo), 0) + 1;
  await prisma.salesOrderLine.create({
    data: { orderId, lineNo: nextLineNo, ...parsed.data },
  });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { ok: true };
}

export async function removeOrderLine(id: number): Promise<ActionResult> {
  const line = await prisma.salesOrderLine.findUnique({
    where: { id },
    include: { planEntries: { select: { id: true } } },
  });
  if (!line) return { ok: false, message: "수주 라인이 없습니다" };
  // PlanEntry는 onDelete: Cascade로 함께 삭제됨 — 사용자에게 UI에서 confirm으로 고지
  await prisma.salesOrderLine.delete({ where: { id } });
  revalidatePath(`/orders/${line.orderId}`);
  revalidatePath("/orders");
  revalidatePath("/mps");
  return { ok: true };
}

export async function setOrderLineStatus(
  id: number,
  status: "OPEN" | "CLOSED" | "CANCELLED"
): Promise<ActionResult> {
  const line = await prisma.salesOrderLine.findUnique({ where: { id } });
  if (!line) return { ok: false, message: "수주 라인이 없습니다" };
  await prisma.salesOrderLine.update({ where: { id }, data: { status } });
  revalidatePath(`/orders/${line.orderId}`);
  revalidatePath("/orders");
  revalidatePath("/mps");
  return { ok: true };
}

export async function setOrderStatus(
  id: number,
  status: "OPEN" | "CLOSED" | "CANCELLED"
): Promise<ActionResult> {
  const order = await prisma.salesOrder.findUnique({ where: { id } });
  if (!order) return { ok: false, message: "수주가 없습니다" };
  await prisma.salesOrder.update({ where: { id }, data: { status } });
  revalidatePath(`/orders/${id}`);
  revalidatePath("/orders");
  revalidatePath("/mps");
  return { ok: true };
}

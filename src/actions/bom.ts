"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { wouldCreateCycle } from "@/lib/bom";
import type { ActionResult } from "./items";

const bomLineSchema = z.object({
  childItemId: z.coerce.number().int().positive("자품목을 선택하세요"),
  qtyPer: z.coerce.number().positive("소요량은 0보다 커야 합니다"),
});

export async function addBomLine(
  parentItemId: number,
  formData: FormData
): Promise<ActionResult> {
  const parsed = bomLineSchema.safeParse({
    childItemId: formData.get("childItemId"),
    qtyPer: formData.get("qtyPer"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const { childItemId, qtyPer } = parsed.data;

  const edges = await prisma.bomLine.findMany({
    select: { parentItemId: true, childItemId: true },
  });
  if (wouldCreateCycle(edges, parentItemId, childItemId)) {
    return {
      ok: false,
      message: "순환 BOM입니다: 자품목이 상위 경로에 이미 포함되어 있습니다",
    };
  }

  try {
    await prisma.bomLine.upsert({
      where: {
        parentItemId_childItemId: { parentItemId, childItemId },
      },
      update: { qtyPer },
      create: { parentItemId, childItemId, qtyPer },
    });
  } catch {
    return { ok: false, message: "BOM 저장에 실패했습니다" };
  }
  revalidatePath(`/items/${parentItemId}/bom`);
  revalidatePath("/items");
  return { ok: true };
}

export async function removeBomLine(id: number): Promise<ActionResult> {
  const line = await prisma.bomLine.findUnique({ where: { id } });
  if (!line) return { ok: false, message: "BOM 행이 없습니다" };
  await prisma.bomLine.delete({ where: { id } });
  revalidatePath(`/items/${line.parentItemId}/bom`);
  revalidatePath("/items");
  return { ok: true };
}

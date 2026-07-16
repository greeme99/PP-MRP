"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";

const itemSchema = z.object({
  code: z.string().trim().min(1, "품목코드는 필수입니다"),
  name: z.string().trim().min(1, "품명은 필수입니다"),
  type: z.enum(["FG", "SF", "RM"]),
  uom: z.string().trim().min(1).default("EA"),
  spec: z.string().trim().optional(),
  defaultLineId: z.coerce.number().int().positive().optional(),
});

export type ActionResult = { ok: boolean; message?: string };

export async function createItem(formData: FormData): Promise<ActionResult> {
  const parsed = itemSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    type: formData.get("type"),
    uom: formData.get("uom") || "EA",
    spec: formData.get("spec") || undefined,
    defaultLineId: formData.get("defaultLineId") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  try {
    await prisma.item.create({ data: parsed.data });
  } catch {
    return { ok: false, message: "저장 실패: 품목코드 중복 여부를 확인하세요" };
  }
  revalidatePath("/items");
  return { ok: true };
}

export async function updateItem(
  id: number,
  formData: FormData
): Promise<ActionResult> {
  const parsed = itemSchema.partial().safeParse({
    name: formData.get("name") ?? undefined,
    type: formData.get("type") ?? undefined,
    uom: formData.get("uom") ?? undefined,
    spec: formData.get("spec") ?? undefined,
    defaultLineId: formData.get("defaultLineId") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const defaultLineRaw = formData.get("defaultLineId");
  await prisma.item.update({
    where: { id },
    data: {
      ...parsed.data,
      // 빈 값 선택 시 기본 라인 해제
      defaultLineId: defaultLineRaw === "" ? null : parsed.data.defaultLineId,
    },
  });
  revalidatePath("/items");
  return { ok: true };
}

const masterSchema = z.object({
  moq: z.coerce.number().int().positive().optional(),
  leadTimeDays: z.coerce.number().int().min(0).optional(),
  roundingValue: z.coerce.number().int().positive().optional(),
  orderPattern: z.enum(["PO", "DO", "JIT", "KANBAN"]).optional(),
  defaultVendorId: z.coerce.number().int().positive().optional(),
  defaultLineId: z.coerce.number().int().positive().optional(),
});

/** Item Master 발주속성 갱신 (빈 값 = 해제) */
export async function updateItemMaster(
  id: number,
  formData: FormData
): Promise<ActionResult> {
  const raw = (k: string) => {
    const v = formData.get(k);
    return v === null || v === "" ? undefined : v;
  };
  const parsed = masterSchema.safeParse({
    moq: raw("moq"),
    leadTimeDays: raw("leadTimeDays"),
    roundingValue: raw("roundingValue"),
    orderPattern: raw("orderPattern"),
    defaultVendorId: raw("defaultVendorId"),
    defaultLineId: raw("defaultLineId"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  await prisma.item.update({
    where: { id },
    data: {
      moq: parsed.data.moq ?? null,
      leadTimeDays: parsed.data.leadTimeDays ?? null,
      roundingValue: parsed.data.roundingValue ?? null,
      orderPattern: parsed.data.orderPattern ?? null,
      defaultVendorId: parsed.data.defaultVendorId ?? null,
      defaultLineId: parsed.data.defaultLineId ?? null,
    },
  });
  revalidatePath("/mdm/items");
  return { ok: true };
}

/** 품목 삭제 — 수주/계획/실적/재고에서 참조 중이면 거부 */
export async function deleteItem(id: number): Promise<ActionResult> {
  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          orderLines: true,
          planEntries: true,
          results: true,
          inventoryTxs: true,
        },
      },
    },
  });
  if (!item) return { ok: false, message: "품목이 없습니다" };
  const c = item._count;
  if (c.orderLines + c.planEntries + c.results + c.inventoryTxs > 0) {
    return {
      ok: false,
      message:
        "수주/계획/실적/재고에서 사용 중이라 삭제할 수 없습니다. 대신 사용중지 처리하세요.",
    };
  }
  await prisma.item.delete({ where: { id } }); // BOM 행은 cascade 삭제
  revalidatePath("/mdm/items");
  return { ok: true };
}

export async function toggleItemActive(id: number): Promise<ActionResult> {
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return { ok: false, message: "품목이 없습니다" };
  await prisma.item.update({
    where: { id },
    data: { isActive: !item.isActive },
  });
  revalidatePath("/items");
  return { ok: true };
}

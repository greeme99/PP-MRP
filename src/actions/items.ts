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

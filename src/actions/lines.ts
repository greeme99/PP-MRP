"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { ActionResult } from "./items";

const lineSchema = z.object({
  code: z.string().trim().min(1, "라인코드는 필수입니다"),
  name: z.string().trim().min(1, "라인명은 필수입니다"),
  weeklyCapacity: z.coerce
    .number()
    .int("정수를 입력하세요")
    .positive("주간 CAPA는 1 이상이어야 합니다"),
});

export async function createLine(formData: FormData): Promise<ActionResult> {
  const parsed = lineSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    weeklyCapacity: formData.get("weeklyCapacity"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  try {
    await prisma.productionLine.create({ data: parsed.data });
  } catch {
    return { ok: false, message: "저장 실패: 라인코드 중복 여부를 확인하세요" };
  }
  revalidatePath("/lines");
  return { ok: true };
}

export async function updateLineCapacity(
  id: number,
  formData: FormData
): Promise<ActionResult> {
  const parsed = z
    .object({
      weeklyCapacity: lineSchema.shape.weeklyCapacity,
      dailyCapacity: z.coerce
        .number()
        .int("정수를 입력하세요")
        .positive("일일 CAPA는 1 이상이어야 합니다")
        .optional(),
    })
    .safeParse({
      weeklyCapacity: formData.get("weeklyCapacity"),
      dailyCapacity: formData.get("dailyCapacity") || undefined,
    });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  await prisma.productionLine.update({
    where: { id },
    data: {
      weeklyCapacity: parsed.data.weeklyCapacity,
      dailyCapacity: parsed.data.dailyCapacity ?? null,
    },
  });
  revalidatePath("/lines");
  revalidatePath("/mps");
  revalidatePath("/daily");
  return { ok: true };
}

export async function toggleLineActive(id: number): Promise<ActionResult> {
  const line = await prisma.productionLine.findUnique({ where: { id } });
  if (!line) return { ok: false, message: "라인이 없습니다" };
  await prisma.productionLine.update({
    where: { id },
    data: { isActive: !line.isActive },
  });
  revalidatePath("/lines");
  return { ok: true };
}

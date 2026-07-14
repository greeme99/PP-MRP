"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { ActionResult } from "./items";

const partnerSchema = z.object({
  code: z.string().trim().min(1, "거래처코드는 필수입니다"),
  name: z.string().trim().min(1, "거래처명은 필수입니다"),
  type: z.enum(["CUSTOMER", "VENDOR", "BOTH"]),
  contact: z.string().trim().optional(),
});

export async function createPartner(
  formData: FormData
): Promise<ActionResult> {
  const parsed = partnerSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    type: formData.get("type"),
    contact: formData.get("contact") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  try {
    await prisma.partner.create({ data: parsed.data });
  } catch {
    return { ok: false, message: "저장 실패: 거래처코드 중복 여부를 확인하세요" };
  }
  revalidatePath("/partners");
  return { ok: true };
}

export async function togglePartnerActive(id: number): Promise<ActionResult> {
  const partner = await prisma.partner.findUnique({ where: { id } });
  if (!partner) return { ok: false, message: "거래처가 없습니다" };
  await prisma.partner.update({
    where: { id },
    data: { isActive: !partner.isActive },
  });
  revalidatePath("/partners");
  return { ok: true };
}

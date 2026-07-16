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

/** 거래처 삭제 — 수주/품목 공급사로 참조 중이면 거부 */
export async function deletePartner(id: number): Promise<ActionResult> {
  const partner = await prisma.partner.findUnique({
    where: { id },
    include: { _count: { select: { orders: true, suppliedItems: true } } },
  });
  if (!partner) return { ok: false, message: "거래처가 없습니다" };
  if (partner._count.orders + partner._count.suppliedItems > 0) {
    return {
      ok: false,
      message:
        "수주 또는 품목 공급사로 사용 중이라 삭제할 수 없습니다. 대신 사용중지 처리하세요.",
    };
  }
  await prisma.partner.delete({ where: { id } });
  revalidatePath("/mdm/vendors");
  revalidatePath("/mdm/customers");
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

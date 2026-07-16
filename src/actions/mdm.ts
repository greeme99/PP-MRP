"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { ActionResult } from "./items";

const siteSchema = z.object({
  code: z.string().trim().min(1, "사업장코드는 필수입니다"),
  name: z.string().trim().min(1, "사업장명은 필수입니다"),
  address: z.string().trim().optional(),
});

export async function createSite(formData: FormData): Promise<ActionResult> {
  const parsed = siteSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    address: formData.get("address") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  try {
    await prisma.site.create({ data: parsed.data });
  } catch {
    return { ok: false, message: "저장 실패: 사업장코드 중복 여부를 확인하세요" };
  }
  revalidatePath("/mdm/sites");
  return { ok: true };
}

export async function toggleSiteActive(id: number): Promise<ActionResult> {
  const site = await prisma.site.findUnique({ where: { id } });
  if (!site) return { ok: false, message: "사업장이 없습니다" };
  await prisma.site.update({
    where: { id },
    data: { isActive: !site.isActive },
  });
  revalidatePath("/mdm/sites");
  return { ok: true };
}

export async function deleteSite(id: number): Promise<ActionResult> {
  const site = await prisma.site.findUnique({
    where: { id },
    include: { _count: { select: { lines: true, facilities: true } } },
  });
  if (!site) return { ok: false, message: "사업장이 없습니다" };
  if (site._count.lines + site._count.facilities > 0) {
    return {
      ok: false,
      message: "라인/설비가 소속되어 있어 삭제할 수 없습니다",
    };
  }
  await prisma.site.delete({ where: { id } });
  revalidatePath("/mdm/sites");
  return { ok: true };
}

const facilitySchema = z.object({
  code: z.string().trim().min(1, "설비코드는 필수입니다"),
  name: z.string().trim().min(1, "설비명은 필수입니다"),
  siteId: z.coerce.number().int().positive().optional(),
  lineId: z.coerce.number().int().positive().optional(),
});

export async function createFacility(
  formData: FormData
): Promise<ActionResult> {
  const parsed = facilitySchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    siteId: formData.get("siteId") || undefined,
    lineId: formData.get("lineId") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  try {
    await prisma.facility.create({ data: parsed.data });
  } catch {
    return { ok: false, message: "저장 실패: 설비코드 중복 여부를 확인하세요" };
  }
  revalidatePath("/mdm/facilities");
  return { ok: true };
}

/** 설비 소속(사업장/라인) 변경. 빈 값 = 해제 */
export async function updateFacility(
  id: number,
  formData: FormData
): Promise<ActionResult> {
  const siteRaw = formData.get("siteId");
  const lineRaw = formData.get("lineId");
  await prisma.facility.update({
    where: { id },
    data: {
      siteId: siteRaw ? Number(siteRaw) : null,
      lineId: lineRaw ? Number(lineRaw) : null,
    },
  });
  revalidatePath("/mdm/facilities");
  return { ok: true };
}

export async function toggleFacilityActive(id: number): Promise<ActionResult> {
  const f = await prisma.facility.findUnique({ where: { id } });
  if (!f) return { ok: false, message: "설비가 없습니다" };
  await prisma.facility.update({
    where: { id },
    data: { isActive: !f.isActive },
  });
  revalidatePath("/mdm/facilities");
  return { ok: true };
}

export async function deleteFacility(id: number): Promise<ActionResult> {
  await prisma.facility.delete({ where: { id } });
  revalidatePath("/mdm/facilities");
  return { ok: true };
}

/** 라인의 소속 사업장 변경 (Line Master용) */
export async function updateLineSite(
  id: number,
  formData: FormData
): Promise<ActionResult> {
  const siteRaw = formData.get("siteId");
  await prisma.productionLine.update({
    where: { id },
    data: { siteId: siteRaw ? Number(siteRaw) : null },
  });
  revalidatePath("/mdm/lines");
  return { ok: true };
}

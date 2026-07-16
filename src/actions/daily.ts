"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateDailyDraft } from "@/lib/daily";
import { fromDateKey, weekStartOf } from "@/lib/week";
import type { ActionResult } from "./items";

/**
 * 해당 주의 주간 계획 중 일별 계획이 없는 것을 분할한다 (멱등).
 * 일일 CAPA가 있는 라인은 납기 우선 순차 채움, 없으면 균등 분할.
 */
export async function generateDailyDraftForWeek(
  weekStartKey: string
): Promise<ActionResult> {
  const weekStart = weekStartOf(fromDateKey(weekStartKey));
  const [weekly, lines] = await Promise.all([
    prisma.planEntry.findMany({
      where: { weekStart },
      include: {
        orderLine: { select: { dueDate: true } },
        dailyEntries: { select: { date: true, qty: true } },
      },
    }),
    prisma.productionLine.findMany({
      select: { id: true, dailyCapacity: true },
    }),
  ]);

  // 이미 분할된 행(수동 포함)이 차지한 일별 부하 — CAPA에서 차감
  const existingLoad = new Map<string, number>();
  for (const e of weekly) {
    for (const d of e.dailyEntries) {
      const key = `${e.lineId}|${d.date.toISOString().slice(0, 10)}`;
      existingLoad.set(key, (existingLoad.get(key) ?? 0) + d.qty);
    }
  }

  const drafts = generateDailyDraft(
    weekly.map((e) => ({
      id: e.id,
      lineId: e.lineId,
      weekStart: e.weekStart,
      qty: e.qty,
      hasDaily: e.dailyEntries.length > 0,
      dueDate: e.orderLine?.dueDate ?? null,
    })),
    new Map(lines.map((l) => [l.id, l.dailyCapacity])),
    existingLoad
  );

  if (drafts.length > 0) {
    await prisma.dailyPlanEntry.createMany({
      data: drafts.map((d) => ({ ...d, source: "AUTO" as const })),
    });
  }
  revalidatePath("/daily");
  const splitCount = new Set(drafts.map((d) => d.planEntryId)).size;
  return { ok: true, message: `주간 계획 ${splitCount}건을 일별로 분할했습니다` };
}

const cellSchema = z.object({
  planEntryId: z.coerce.number().int().positive(),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  qty: z.coerce.number().int().min(0, "수량은 0 이상이어야 합니다"),
});

/** 일별 셀 편집: qty>0 upsert(MANUAL), qty=0 삭제. */
export async function setDailyCell(input: {
  planEntryId: number;
  dateKey: string;
  qty: number;
}): Promise<ActionResult> {
  const parsed = cellSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const { planEntryId, qty } = parsed.data;
  const date = fromDateKey(parsed.data.dateKey);

  if (qty === 0) {
    await prisma.dailyPlanEntry.deleteMany({ where: { planEntryId, date } });
  } else {
    const planEntry = await prisma.planEntry.findUnique({
      where: { id: planEntryId },
    });
    if (!planEntry) return { ok: false, message: "주간 계획이 없습니다" };
    await prisma.dailyPlanEntry.upsert({
      where: { planEntryId_date: { planEntryId, date } },
      update: { qty, source: "MANUAL" },
      create: { planEntryId, date, qty, source: "MANUAL" },
    });
  }
  revalidatePath("/daily");
  return { ok: true };
}

/** 주간 엔트리의 일별 계획 전체 삭제 → 다음 분할 대상으로 복귀. */
export async function resetDailyForPlanEntry(
  planEntryId: number
): Promise<ActionResult> {
  await prisma.dailyPlanEntry.deleteMany({ where: { planEntryId } });
  revalidatePath("/daily");
  return { ok: true };
}

import Link from "next/link";
import { prisma } from "@/lib/db";
import { explodeRequirements, roundQty } from "@/lib/mrp";
import {
  Badge,
  Card,
  ITEM_TYPE_LABEL,
  PageTitle,
  btnCls,
  btnGhostCls,
} from "@/components/ui";
import {
  addWeeks,
  currentWeekStart,
  fromDateKey,
  toDateKey,
  weekDateLabel,
  weekLabel,
  weekRange,
  weekStartOf,
} from "@/lib/week";

export const dynamic = "force-dynamic";

const DEFAULT_WEEKS = 12;

export default async function MrpPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; weeks?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const from = sp.from
    ? weekStartOf(fromDateKey(sp.from))
    : currentWeekStart();
  const weeksCount = Math.min(
    Math.max(Number(sp.weeks) || DEFAULT_WEEKS, 4),
    26
  );
  const typeFilter = sp.type === "ALL" ? "ALL" : "RM"; // 기본: 원자재만
  const weeks = weekRange(from, weeksCount);
  const weekKeys = weeks.map(toDateKey);
  const fromKey = toDateKey(from);
  const toKeyExclusive = toDateKey(addWeeks(from, weeksCount));

  const [entries, edges] = await Promise.all([
    prisma.planEntry.findMany({
      where: {
        weekStart: {
          gte: fromDateKey(fromKey),
          lt: fromDateKey(toKeyExclusive),
        },
      },
      select: { itemId: true, weekStart: true, qty: true },
    }),
    prisma.bomLine.findMany({
      select: { parentItemId: true, childItemId: true, qtyPer: true },
    }),
  ]);

  const req = explodeRequirements(entries, edges);

  const items = await prisma.item.findMany({
    where: { id: { in: [...req.keys()] } },
  });
  const rows = items
    .filter((i) => typeFilter === "ALL" || i.type === "RM")
    .sort((a, b) => a.type.localeCompare(b.type) || a.code.localeCompare(b.code))
    .map((item) => {
      const weekMap = req.get(item.id)!;
      const total = roundQty(
        [...weekMap.values()].reduce((s, q) => s + q, 0)
      );
      return { item, weekMap, total };
    });

  const prevKey = toDateKey(addWeeks(from, -4));
  const nextKey = toDateKey(addWeeks(from, 4));
  const todayKey = toDateKey(currentWeekStart());
  const qs = (f: string) => `/mrp?from=${f}&weeks=${weeksCount}&type=${typeFilter}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <PageTitle>자재소요 (MRP) — 총소요량</PageTitle>
        <div className="flex gap-2 items-center">
          <Link href={qs(prevKey)} className={btnGhostCls}>← 4주 이전</Link>
          <Link href={qs(todayKey)} className={btnGhostCls}>이번 주</Link>
          <Link href={qs(nextKey)} className={btnGhostCls}>4주 이후 →</Link>
          <Link
            href={`/mrp?from=${fromKey}&weeks=${weeksCount}&type=${typeFilter === "ALL" ? "RM" : "ALL"}`}
            className={btnGhostCls}
          >
            {typeFilter === "ALL" ? "원자재만 보기" : "반제품 포함 보기"}
          </Link>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        생산계획(MPS) × BOM 전개로 계산한 <b>총소요량</b>입니다. 재고 차감과
        리드타임 오프셋은 하지 않으며(소요 주차 = 생산 주차), 발주 시점은
        구매 리드타임을 감안해 판단하세요.
      </p>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-xs font-semibold text-gray-500 px-2 py-1 border-b min-w-56 sticky left-0 bg-white">
                  품목
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 px-2 py-1 border-b">유형</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-2 py-1 border-b">단위</th>
                {weeks.map((w) => (
                  <th
                    key={toDateKey(w)}
                    className={`text-center text-xs px-1 py-1 border-b min-w-16 ${
                      toDateKey(w) === todayKey ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="font-semibold text-gray-600">{weekLabel(w)}</div>
                    <div className="text-gray-400">{weekDateLabel(w)}</div>
                  </th>
                ))}
                <th className="text-center text-xs font-semibold text-gray-500 px-2 py-1 border-b">합계</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ item, weekMap, total }) => (
                <tr key={item.id}>
                  <td className="px-2 py-1 border-b text-sm sticky left-0 bg-white">
                    <span className="font-mono text-xs">{item.code}</span>{" "}
                    <span className="text-gray-700 text-xs">{item.name}</span>
                  </td>
                  <td className="px-2 py-1 border-b">
                    <Badge color={item.type === "SF" ? "amber" : "gray"}>
                      {ITEM_TYPE_LABEL[item.type]}
                    </Badge>
                  </td>
                  <td className="px-2 py-1 border-b text-xs text-gray-500">{item.uom}</td>
                  {weekKeys.map((wk) => {
                    const q = weekMap.get(wk);
                    return (
                      <td
                        key={wk}
                        className={`border-b text-right text-xs px-1.5 py-1 ${
                          wk === todayKey ? "bg-blue-50" : ""
                        } ${q ? "text-gray-800" : "text-gray-300"}`}
                      >
                        {q ? roundQty(q).toLocaleString() : "·"}
                      </td>
                    );
                  })}
                  <td className="border-b text-right text-xs px-2 py-1 font-medium">
                    {total.toLocaleString()}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={weeksCount + 4} className="text-center text-gray-400 py-8 text-sm">
                    이 기간에 자재소요가 없습니다 — MPS에 계획이 있는지 확인하세요
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="text-right">
        <a
          href={`/api/export/mrp?from=${fromKey}&weeks=${weeksCount}&type=${typeFilter}`}
          className={btnCls}
        >
          엑셀로 내보내기
        </a>
      </div>
    </div>
  );
}

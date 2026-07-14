import Link from "next/link";
import { prisma } from "@/lib/db";
import { createItem, toggleItemActive, updateItem } from "@/actions/items";
import { ActionForm, ActionButton } from "@/components/action-form";
import {
  Badge,
  Card,
  ITEM_TYPE_LABEL,
  PageTitle,
  btnCls,
  btnGhostCls,
  inputCls,
  tdCls,
  thCls,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  const [items, lines] = await Promise.all([
    prisma.item.findMany({
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
      include: { defaultLine: true, parentBoms: { select: { id: true } } },
    }),
    prisma.productionLine.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <div>
      <PageTitle>품목 관리</PageTitle>

      <Card>
        <h2 className="font-semibold text-sm mb-2">품목 등록</h2>
        <ActionForm action={createItem} className="flex flex-wrap gap-2 items-end">
          <input name="code" placeholder="품목코드 *" className={inputCls} required />
          <input name="name" placeholder="품명 *" className={`${inputCls} w-56`} required />
          <select name="type" className={inputCls} defaultValue="FG">
            <option value="FG">완제품</option>
            <option value="SF">반제품</option>
            <option value="RM">원자재</option>
          </select>
          <input name="uom" placeholder="단위" defaultValue="EA" className={`${inputCls} w-20`} />
          <input name="spec" placeholder="규격" className={`${inputCls} w-40`} />
          <select name="defaultLineId" className={inputCls} defaultValue="">
            <option value="">기본 라인 없음</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} {l.name}
              </option>
            ))}
          </select>
          <button type="submit" className={btnCls}>등록</button>
        </ActionForm>
      </Card>

      <Card>
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>코드</th>
              <th className={thCls}>품명</th>
              <th className={thCls}>유형</th>
              <th className={thCls}>단위</th>
              <th className={thCls}>규격</th>
              <th className={thCls}>기본 라인</th>
              <th className={thCls}>BOM</th>
              <th className={thCls}>상태</th>
              <th className={thCls}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={item.isActive ? "" : "opacity-50"}>
                <td className={`${tdCls} font-mono`}>{item.code}</td>
                <td className={tdCls}>{item.name}</td>
                <td className={tdCls}>
                  <Badge color={item.type === "FG" ? "blue" : item.type === "SF" ? "amber" : "gray"}>
                    {ITEM_TYPE_LABEL[item.type]}
                  </Badge>
                </td>
                <td className={tdCls}>{item.uom}</td>
                <td className={tdCls}>{item.spec ?? "-"}</td>
                <td className={tdCls}>
                  <ActionForm
                    action={updateItem.bind(null, item.id)}
                    className="flex gap-1 items-center"
                  >
                    <select
                      name="defaultLineId"
                      defaultValue={item.defaultLineId ?? ""}
                      className={`${inputCls} text-xs`}
                    >
                      <option value="">없음</option>
                      {lines.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.code}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className={btnGhostCls}>저장</button>
                  </ActionForm>
                </td>
                <td className={tdCls}>
                  {item.type !== "RM" ? (
                    <Link href={`/items/${item.id}/bom`} className="text-blue-600 hover:underline text-sm">
                      BOM ({item.parentBoms.length})
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>
                <td className={tdCls}>
                  <Badge color={item.isActive ? "green" : "gray"}>
                    {item.isActive ? "사용" : "중지"}
                  </Badge>
                </td>
                <td className={tdCls}>
                  <ActionButton
                    action={toggleItemActive.bind(null, item.id)}
                    className={btnGhostCls}
                  >
                    {item.isActive ? "사용중지" : "재사용"}
                  </ActionButton>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-gray-400 py-8 text-sm">
                  등록된 품목이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

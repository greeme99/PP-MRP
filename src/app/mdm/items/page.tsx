import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  createItem,
  deleteItem,
  toggleItemActive,
  updateItemMaster,
} from "@/actions/items";
import { ActionForm, ActionButton } from "@/components/action-form";
import {
  Badge,
  Card,
  ITEM_TYPE_LABEL,
  ORDER_PATTERN_LABEL,
  PageTitle,
  btnCls,
  btnGhostCls,
  inputCls,
  tdCls,
  thCls,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ItemMasterPage() {
  const [items, lines, vendors] = await Promise.all([
    prisma.item.findMany({
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
      include: { defaultLine: true, defaultVendor: true, parentBoms: { select: { id: true } } },
    }),
    prisma.productionLine.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
    }),
    prisma.partner.findMany({
      where: { isActive: true, type: { in: ["VENDOR", "BOTH"] } },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <div>
      <PageTitle>Item Master — 품목 기준정보</PageTitle>

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
          <button type="submit" className={btnCls}>등록</button>
        </ActionForm>
        <p className="text-xs text-gray-500 mt-2">
          발주속성(MOQ, 리드타임, Rounding, 발주패턴, 공급사)과 기본 라인은
          등록 후 아래 표에서 행 단위로 입력·수정합니다.
        </p>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead>
              <tr>
                <th className={thCls}>코드</th>
                <th className={thCls}>품명</th>
                <th className={thCls}>유형</th>
                <th className={thCls}>BOM</th>
                <th className={thCls}>
                  발주속성 (기본라인 / MOQ / L/T일 / Rounding / 패턴 / 공급사)
                </th>
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
                    <ActionForm
                      action={updateItemMaster.bind(null, item.id)}
                      className="flex gap-1 items-center flex-nowrap"
                    >
                      <select name="defaultLineId" defaultValue={item.defaultLineId ?? ""} className={`${inputCls} text-xs w-20`} title="기본 라인">
                        <option value="">라인-</option>
                        {lines.map((l) => (
                          <option key={l.id} value={l.id}>{l.code}</option>
                        ))}
                      </select>
                      <input name="moq" type="number" min={1} defaultValue={item.moq ?? ""} placeholder="MOQ" className={`${inputCls} text-xs w-20 text-right`} title="최소발주수량" />
                      <input name="leadTimeDays" type="number" min={0} defaultValue={item.leadTimeDays ?? ""} placeholder="L/T" className={`${inputCls} text-xs w-14 text-right`} title="구매 리드타임(일)" />
                      <input name="roundingValue" type="number" min={1} defaultValue={item.roundingValue ?? ""} placeholder="Rnd" className={`${inputCls} text-xs w-16 text-right`} title="발주 배수(Rounding Value)" />
                      <select name="orderPattern" defaultValue={item.orderPattern ?? ""} className={`${inputCls} text-xs`} title="발주패턴">
                        <option value="">패턴-</option>
                        {Object.entries(ORDER_PATTERN_LABEL).map(([v, label]) => (
                          <option key={v} value={v}>{label}</option>
                        ))}
                      </select>
                      <select name="defaultVendorId" defaultValue={item.defaultVendorId ?? ""} className={`${inputCls} text-xs w-28`} title="기본 공급사">
                        <option value="">공급사-</option>
                        {vendors.map((v) => (
                          <option key={v.id} value={v.id}>{v.code} {v.name}</option>
                        ))}
                      </select>
                      <button type="submit" className={btnGhostCls}>저장</button>
                    </ActionForm>
                  </td>
                  <td className={tdCls}>
                    <Badge color={item.isActive ? "green" : "gray"}>
                      {item.isActive ? "사용" : "중지"}
                    </Badge>
                  </td>
                  <td className={`${tdCls} whitespace-nowrap`}>
                    <span className="flex gap-1">
                      <ActionButton action={toggleItemActive.bind(null, item.id)} className={btnGhostCls}>
                        {item.isActive ? "중지" : "재사용"}
                      </ActionButton>
                      <ActionButton
                        action={deleteItem.bind(null, item.id)}
                        className={btnGhostCls}
                        confirmMessage={`${item.code} 품목을 삭제할까요? (BOM 행도 함께 삭제됩니다)`}
                      >
                        삭제
                      </ActionButton>
                    </span>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 py-8 text-sm">
                    등록된 품목이 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

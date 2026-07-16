import { prisma } from "@/lib/db";
import {
  addInventoryTx,
  adjustInventory,
  deleteInventoryTx,
} from "@/actions/inventory";
import { ActionForm, ActionButton } from "@/components/action-form";
import { onHandByItem } from "@/lib/inventory";
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
import { toDateKey } from "@/lib/week";

export const dynamic = "force-dynamic";

const TX_TYPE_LABEL: Record<string, string> = {
  IN: "입고",
  OUT: "출고",
  ADJUST: "실사조정",
};
const TX_TYPE_COLOR: Record<string, "green" | "amber" | "blue"> = {
  IN: "green",
  OUT: "amber",
  ADJUST: "blue",
};

export default async function InventoryPage() {
  const [items, txs, recent] = await Promise.all([
    prisma.item.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { code: "asc" }],
    }),
    prisma.inventoryTx.findMany({ select: { itemId: true, qty: true } }),
    prisma.inventoryTx.findMany({
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: 20,
      include: { item: true },
    }),
  ]);
  const onHand = onHandByItem(txs);
  const today = toDateKey(new Date());
  const stocked = items.filter((i) => (onHand.get(i.id) ?? 0) !== 0);

  return (
    <div>
      <PageTitle>재고 관리</PageTitle>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-sm mb-2">입고 / 출고</h2>
          <ActionForm action={addInventoryTx} className="flex flex-wrap gap-2 items-end">
            <select name="itemId" className={`${inputCls} w-72`} required>
              <option value="">품목 선택 *</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  [{ITEM_TYPE_LABEL[i.type]}] {i.code} — {i.name}
                </option>
              ))}
            </select>
            <select name="type" className={inputCls} defaultValue="IN">
              <option value="IN">입고</option>
              <option value="OUT">출고</option>
            </select>
            <input name="qty" type="number" min={1} placeholder="수량 *" className={`${inputCls} w-28`} required />
            <input name="date" type="date" defaultValue={today} className={inputCls} required />
            <input name="memo" placeholder="비고" className={`${inputCls} w-40`} />
            <button type="submit" className={btnCls}>등록</button>
          </ActionForm>
        </Card>

        <Card>
          <h2 className="font-semibold text-sm mb-2">실사 조정 (절대수량 입력)</h2>
          <ActionForm action={adjustInventory} className="flex flex-wrap gap-2 items-end">
            <select name="itemId" className={`${inputCls} w-72`} required>
              <option value="">품목 선택 *</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  [{ITEM_TYPE_LABEL[i.type]}] {i.code} — {i.name} (현재{" "}
                  {(onHand.get(i.id) ?? 0).toLocaleString()})
                </option>
              ))}
            </select>
            <input name="actualQty" type="number" min={0} placeholder="실사 수량 *" className={`${inputCls} w-32`} required />
            <input name="date" type="date" defaultValue={today} className={inputCls} required />
            <button type="submit" className={btnCls}>조정</button>
          </ActionForm>
          <p className="text-xs text-gray-500 mt-2">
            현재고와의 차이가 실사조정 트랜잭션으로 기록됩니다. 초기 재고 일괄
            등록은 엑셀 가져오기의 &quot;재고&quot; 시트를 사용하세요.
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold text-sm mb-2">
          현재고 <span className="text-gray-400 font-normal">(0인 품목 제외)</span>
        </h2>
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>품목코드</th>
              <th className={thCls}>품명</th>
              <th className={thCls}>유형</th>
              <th className={thCls}>단위</th>
              <th className={`${thCls} text-right`}>현재고</th>
            </tr>
          </thead>
          <tbody>
            {stocked.map((i) => {
              const q = onHand.get(i.id) ?? 0;
              return (
                <tr key={i.id}>
                  <td className={`${tdCls} font-mono`}>{i.code}</td>
                  <td className={tdCls}>{i.name}</td>
                  <td className={tdCls}>
                    <Badge color={i.type === "FG" ? "blue" : i.type === "SF" ? "amber" : "gray"}>
                      {ITEM_TYPE_LABEL[i.type]}
                    </Badge>
                  </td>
                  <td className={tdCls}>{i.uom}</td>
                  <td className={`${tdCls} text-right font-medium ${q < 0 ? "text-red-600" : ""}`}>
                    {q.toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {stocked.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-gray-400 py-8 text-sm">
                  재고가 없습니다 — 입고를 등록하거나 엑셀 &quot;재고&quot; 시트로 실사 데이터를 가져오세요
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className="font-semibold text-sm mb-2">최근 입출고 이력 (20건)</h2>
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>일자</th>
              <th className={thCls}>구분</th>
              <th className={thCls}>품목</th>
              <th className={`${thCls} text-right`}>증감</th>
              <th className={thCls}>비고</th>
              <th className={thCls}></th>
            </tr>
          </thead>
          <tbody>
            {recent.map((t) => (
              <tr key={t.id}>
                <td className={tdCls}>{toDateKey(t.date)}</td>
                <td className={tdCls}>
                  <Badge color={TX_TYPE_COLOR[t.type]}>{TX_TYPE_LABEL[t.type]}</Badge>
                </td>
                <td className={tdCls}>
                  <span className="font-mono text-xs">{t.item.code}</span> {t.item.name}
                </td>
                <td className={`${tdCls} text-right font-mono ${t.qty < 0 ? "text-red-600" : "text-green-700"}`}>
                  {t.qty > 0 ? "+" : ""}
                  {t.qty.toLocaleString()}
                </td>
                <td className={`${tdCls} text-gray-500 text-xs`}>{t.memo ?? ""}</td>
                <td className={tdCls}>
                  <ActionButton
                    action={deleteInventoryTx.bind(null, t.id)}
                    className={btnGhostCls}
                    confirmMessage="이 트랜잭션을 삭제할까요? 현재고가 되돌아갑니다."
                  >
                    삭제
                  </ActionButton>
                </td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-gray-400 py-8 text-sm">
                  이력이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

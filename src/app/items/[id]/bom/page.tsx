import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { addBomLine, removeBomLine } from "@/actions/bom";
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

export default async function BomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) notFound();

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: {
      parentBoms: {
        include: { childItem: { include: { parentBoms: { select: { id: true } } } } },
        orderBy: { childItem: { code: "asc" } },
      },
    },
  });
  if (!item) notFound();

  const candidates = await prisma.item.findMany({
    where: { isActive: true, id: { not: itemId } },
    orderBy: { code: "asc" },
  });

  return (
    <div>
      <PageTitle>
        BOM — <span className="font-mono">{item.code}</span> {item.name}{" "}
        <Badge color="blue">{ITEM_TYPE_LABEL[item.type]}</Badge>
      </PageTitle>
      <p className="text-sm mb-4">
        <Link href="/mdm/items" className="text-blue-600 hover:underline">
          ← Item Master로
        </Link>
      </p>

      <Card>
        <h2 className="font-semibold text-sm mb-2">자품목 추가</h2>
        <ActionForm
          action={addBomLine.bind(null, item.id)}
          className="flex flex-wrap gap-2 items-end"
        >
          <select name="childItemId" className={`${inputCls} w-80`} required>
            <option value="">자품목 선택 *</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                [{ITEM_TYPE_LABEL[c.type]}] {c.code} — {c.name}
              </option>
            ))}
          </select>
          <input
            name="qtyPer"
            type="number"
            step="any"
            min={0.000001}
            placeholder="소요량 (모품목 1개당) *"
            className={`${inputCls} w-48`}
            required
          />
          <button type="submit" className={btnCls}>추가</button>
        </ActionForm>
        <p className="text-xs text-gray-500 mt-2">
          이미 있는 자품목을 다시 추가하면 소요량이 갱신됩니다. 순환 구조는
          저장 시 자동으로 차단됩니다.
        </p>
      </Card>

      <Card>
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>자품목 코드</th>
              <th className={thCls}>품명</th>
              <th className={thCls}>유형</th>
              <th className={thCls}>단위</th>
              <th className={thCls}>소요량</th>
              <th className={thCls}>하위 BOM</th>
              <th className={thCls}></th>
            </tr>
          </thead>
          <tbody>
            {item.parentBoms.map((b) => (
              <tr key={b.id}>
                <td className={`${tdCls} font-mono`}>{b.childItem.code}</td>
                <td className={tdCls}>{b.childItem.name}</td>
                <td className={tdCls}>
                  <Badge
                    color={
                      b.childItem.type === "FG"
                        ? "blue"
                        : b.childItem.type === "SF"
                          ? "amber"
                          : "gray"
                    }
                  >
                    {ITEM_TYPE_LABEL[b.childItem.type]}
                  </Badge>
                </td>
                <td className={tdCls}>{b.childItem.uom}</td>
                <td className={`${tdCls} text-right font-mono`}>{b.qtyPer}</td>
                <td className={tdCls}>
                  {b.childItem.parentBoms.length > 0 ? (
                    <Link
                      href={`/items/${b.childItem.id}/bom`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      BOM ({b.childItem.parentBoms.length})
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>
                <td className={tdCls}>
                  <ActionButton
                    action={removeBomLine.bind(null, b.id)}
                    className={btnGhostCls}
                    confirmMessage={`${b.childItem.code} 자품목을 BOM에서 삭제할까요?`}
                  >
                    삭제
                  </ActionButton>
                </td>
              </tr>
            ))}
            {item.parentBoms.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-gray-400 py-8 text-sm">
                  등록된 자품목이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

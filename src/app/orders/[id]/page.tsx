import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  addOrderLine,
  removeOrderLine,
  setOrderLineStatus,
  setOrderStatus,
} from "@/actions/orders";
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
import { toDateKey } from "@/lib/week";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "진행중",
  CLOSED: "완료",
  CANCELLED: "취소",
};
const STATUS_COLOR: Record<string, "green" | "gray" | "red"> = {
  OPEN: "green",
  CLOSED: "gray",
  CANCELLED: "red",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();

  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      lines: {
        orderBy: { lineNo: "asc" },
        include: { item: true, planEntries: true },
      },
    },
  });
  if (!order) notFound();

  const items = await prisma.item.findMany({
    where: { isActive: true, type: { in: ["FG", "SF"] } },
    orderBy: { code: "asc" },
  });

  return (
    <div>
      <PageTitle>
        수주 <span className="font-mono">{order.orderNo}</span>{" "}
        <Badge color={STATUS_COLOR[order.status]}>
          {STATUS_LABEL[order.status]}
        </Badge>
      </PageTitle>
      <p className="text-sm mb-4 flex gap-4 items-center">
        <Link href="/orders" className="text-blue-600 hover:underline">
          ← 수주 목록으로
        </Link>
        <span className="text-gray-600">
          고객사: {order.customer.name} · 수주일: {toDateKey(order.orderDate)}
          {order.memo ? ` · ${order.memo}` : ""}
        </span>
        {order.status === "OPEN" ? (
          <>
            <ActionButton
              action={setOrderStatus.bind(null, order.id, "CLOSED")}
              className={btnGhostCls}
              confirmMessage="이 수주를 완료 처리할까요?"
            >
              수주 완료
            </ActionButton>
            <ActionButton
              action={setOrderStatus.bind(null, order.id, "CANCELLED")}
              className={btnGhostCls}
              confirmMessage="이 수주를 취소 처리할까요?"
            >
              수주 취소
            </ActionButton>
          </>
        ) : (
          <ActionButton
            action={setOrderStatus.bind(null, order.id, "OPEN")}
            className={btnGhostCls}
          >
            진행중으로 되돌리기
          </ActionButton>
        )}
      </p>

      {order.status === "OPEN" && (
        <Card>
          <h2 className="font-semibold text-sm mb-2">품목 라인 추가</h2>
          <ActionForm
            action={addOrderLine.bind(null, order.id)}
            className="flex flex-wrap gap-2 items-end"
          >
            <select name="itemId" className={`${inputCls} w-80`} required>
              <option value="">품목 선택 *</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  [{ITEM_TYPE_LABEL[i.type]}] {i.code} — {i.name}
                </option>
              ))}
            </select>
            <input
              name="qty"
              type="number"
              min={1}
              placeholder="수량 *"
              className={`${inputCls} w-32`}
              required
            />
            <label className="text-xs text-gray-500">
              납기일
              <input
                name="dueDate"
                type="date"
                className={`${inputCls} block`}
                required
              />
            </label>
            <button type="submit" className={btnCls}>추가</button>
          </ActionForm>
        </Card>
      )}

      <Card>
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>#</th>
              <th className={thCls}>품목</th>
              <th className={thCls}>수량</th>
              <th className={thCls}>납기일</th>
              <th className={thCls}>계획 수량 합계</th>
              <th className={thCls}>상태</th>
              <th className={thCls}></th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l) => {
              const planned = l.planEntries.reduce((s, p) => s + p.qty, 0);
              const mismatch = l.status === "OPEN" && planned !== 0 && planned !== l.qty;
              return (
                <tr key={l.id}>
                  <td className={tdCls}>{l.lineNo}</td>
                  <td className={tdCls}>
                    <span className="font-mono">{l.item.code}</span>{" "}
                    {l.item.name}
                  </td>
                  <td className={`${tdCls} text-right`}>
                    {l.qty.toLocaleString()}
                  </td>
                  <td className={tdCls}>{toDateKey(l.dueDate)}</td>
                  <td className={`${tdCls} text-right`}>
                    {planned.toLocaleString()}{" "}
                    {mismatch && <Badge color="amber">수량 불일치</Badge>}
                    {l.status === "OPEN" && planned === 0 && (
                      <Badge color="gray">미계획</Badge>
                    )}
                  </td>
                  <td className={tdCls}>
                    <Badge color={STATUS_COLOR[l.status]}>
                      {STATUS_LABEL[l.status]}
                    </Badge>
                  </td>
                  <td className={`${tdCls} whitespace-nowrap`}>
                    {l.status === "OPEN" ? (
                      <span className="flex gap-1">
                        <ActionButton
                          action={setOrderLineStatus.bind(null, l.id, "CLOSED")}
                          className={btnGhostCls}
                        >
                          완료
                        </ActionButton>
                        <ActionButton
                          action={removeOrderLine.bind(null, l.id)}
                          className={btnGhostCls}
                          confirmMessage="라인을 삭제하면 연결된 생산계획도 함께 삭제됩니다. 계속할까요?"
                        >
                          삭제
                        </ActionButton>
                      </span>
                    ) : (
                      <ActionButton
                        action={setOrderLineStatus.bind(null, l.id, "OPEN")}
                        className={btnGhostCls}
                      >
                        진행중
                      </ActionButton>
                    )}
                  </td>
                </tr>
              );
            })}
            {order.lines.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-gray-400 py-8 text-sm">
                  품목 라인이 없습니다 — 위에서 추가하세요
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/db";
import { createOrder } from "@/actions/orders";
import { ActionForm } from "@/components/action-form";
import {
  Badge,
  Card,
  PageTitle,
  btnCls,
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

export default async function OrdersPage() {
  const [orders, customers] = await Promise.all([
    prisma.salesOrder.findMany({
      orderBy: [{ orderDate: "desc" }, { orderNo: "desc" }],
      include: { customer: true, lines: true },
    }),
    prisma.partner.findMany({
      where: { isActive: true, type: { in: ["CUSTOMER", "BOTH"] } },
      orderBy: { code: "asc" },
    }),
  ]);

  const today = toDateKey(new Date());

  return (
    <div>
      <PageTitle>수주 관리</PageTitle>

      <Card>
        <h2 className="font-semibold text-sm mb-2">수주 등록</h2>
        <ActionForm action={createOrder} className="flex flex-wrap gap-2 items-end">
          <input name="orderNo" placeholder="수주번호 *" className={inputCls} required />
          <select name="customerId" className={`${inputCls} w-56`} required>
            <option value="">고객사 선택 *</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
          <label className="text-xs text-gray-500">
            수주일
            <input
              name="orderDate"
              type="date"
              defaultValue={today}
              className={`${inputCls} block`}
              required
            />
          </label>
          <input name="memo" placeholder="비고" className={`${inputCls} w-56`} />
          <button type="submit" className={btnCls}>등록</button>
        </ActionForm>
        <p className="text-xs text-gray-500 mt-2">
          등록 후 수주번호를 눌러 품목 라인(품목·수량·납기)을 추가하세요.
        </p>
      </Card>

      <Card>
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>수주번호</th>
              <th className={thCls}>고객사</th>
              <th className={thCls}>수주일</th>
              <th className={thCls}>라인 수</th>
              <th className={thCls}>총 수량</th>
              <th className={thCls}>최단 납기</th>
              <th className={thCls}>상태</th>
              <th className={thCls}>비고</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const openLines = o.lines.filter((l) => l.status === "OPEN");
              const earliestDue =
                openLines.length > 0
                  ? toDateKey(
                      new Date(
                        Math.min(...openLines.map((l) => l.dueDate.getTime()))
                      )
                    )
                  : "-";
              return (
                <tr key={o.id}>
                  <td className={`${tdCls} font-mono`}>
                    <Link
                      href={`/orders/${o.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {o.orderNo}
                    </Link>
                  </td>
                  <td className={tdCls}>{o.customer.name}</td>
                  <td className={tdCls}>{toDateKey(o.orderDate)}</td>
                  <td className={tdCls}>{o.lines.length}</td>
                  <td className={`${tdCls} text-right`}>
                    {o.lines
                      .reduce((s, l) => s + l.qty, 0)
                      .toLocaleString()}
                  </td>
                  <td className={tdCls}>{earliestDue}</td>
                  <td className={tdCls}>
                    <Badge color={STATUS_COLOR[o.status]}>
                      {STATUS_LABEL[o.status]}
                    </Badge>
                  </td>
                  <td className={`${tdCls} text-gray-500`}>{o.memo ?? ""}</td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-gray-400 py-8 text-sm">
                  등록된 수주가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

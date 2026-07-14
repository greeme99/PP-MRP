import { prisma } from "@/lib/db";
import { createPartner, togglePartnerActive } from "@/actions/partners";
import { ActionForm, ActionButton } from "@/components/action-form";
import {
  Badge,
  Card,
  PARTNER_TYPE_LABEL,
  PageTitle,
  btnCls,
  btnGhostCls,
  inputCls,
  tdCls,
  thCls,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PartnersPage() {
  const partners = await prisma.partner.findMany({
    orderBy: [{ isActive: "desc" }, { code: "asc" }],
    include: { orders: { select: { id: true } } },
  });

  return (
    <div>
      <PageTitle>거래처 관리</PageTitle>

      <Card>
        <h2 className="font-semibold text-sm mb-2">거래처 등록</h2>
        <ActionForm action={createPartner} className="flex flex-wrap gap-2 items-end">
          <input name="code" placeholder="거래처코드 *" className={inputCls} required />
          <input name="name" placeholder="거래처명 *" className={`${inputCls} w-56`} required />
          <select name="type" className={inputCls} defaultValue="CUSTOMER">
            <option value="CUSTOMER">고객사</option>
            <option value="VENDOR">공급사</option>
            <option value="BOTH">고객+공급</option>
          </select>
          <input name="contact" placeholder="담당자/연락처" className={`${inputCls} w-48`} />
          <button type="submit" className={btnCls}>등록</button>
        </ActionForm>
      </Card>

      <Card>
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>코드</th>
              <th className={thCls}>거래처명</th>
              <th className={thCls}>구분</th>
              <th className={thCls}>담당자/연락처</th>
              <th className={thCls}>수주 건수</th>
              <th className={thCls}>상태</th>
              <th className={thCls}></th>
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => (
              <tr key={p.id} className={p.isActive ? "" : "opacity-50"}>
                <td className={`${tdCls} font-mono`}>{p.code}</td>
                <td className={tdCls}>{p.name}</td>
                <td className={tdCls}>
                  <Badge color={p.type === "CUSTOMER" ? "blue" : p.type === "VENDOR" ? "amber" : "green"}>
                    {PARTNER_TYPE_LABEL[p.type]}
                  </Badge>
                </td>
                <td className={tdCls}>{p.contact ?? "-"}</td>
                <td className={tdCls}>{p.orders.length}</td>
                <td className={tdCls}>
                  <Badge color={p.isActive ? "green" : "gray"}>
                    {p.isActive ? "사용" : "중지"}
                  </Badge>
                </td>
                <td className={tdCls}>
                  <ActionButton
                    action={togglePartnerActive.bind(null, p.id)}
                    className={btnGhostCls}
                  >
                    {p.isActive ? "사용중지" : "재사용"}
                  </ActionButton>
                </td>
              </tr>
            ))}
            {partners.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-gray-400 py-8 text-sm">
                  등록된 거래처가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

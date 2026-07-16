import { prisma } from "@/lib/db";
import {
  createPartner,
  deletePartner,
  togglePartnerActive,
} from "@/actions/partners";
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

/** Vendor/Customer Master 공용 화면. BOTH 타입은 양쪽에 표시된다. */
export async function PartnerMaster({
  role,
}: {
  role: "VENDOR" | "CUSTOMER";
}) {
  const isVendor = role === "VENDOR";
  const partners = await prisma.partner.findMany({
    where: { type: { in: [role, "BOTH"] } },
    orderBy: [{ isActive: "desc" }, { code: "asc" }],
    include: { _count: { select: { orders: true, suppliedItems: true } } },
  });

  return (
    <div>
      <PageTitle>
        {isVendor ? "Vendor Master — 공급사" : "Customer Master — 고객사"}
      </PageTitle>

      <Card>
        <h2 className="font-semibold text-sm mb-2">
          {isVendor ? "공급사" : "고객사"} 등록
        </h2>
        <ActionForm action={createPartner} className="flex flex-wrap gap-2 items-end">
          <input name="code" placeholder="거래처코드 *" className={inputCls} required />
          <input name="name" placeholder="거래처명 *" className={`${inputCls} w-56`} required />
          <select name="type" className={inputCls} defaultValue={role}>
            <option value={role}>{PARTNER_TYPE_LABEL[role]}</option>
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
              <th className={thCls}>{isVendor ? "공급 품목 수" : "수주 건수"}</th>
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
                  <Badge color={p.type === "BOTH" ? "green" : isVendor ? "amber" : "blue"}>
                    {PARTNER_TYPE_LABEL[p.type]}
                  </Badge>
                </td>
                <td className={tdCls}>{p.contact ?? "-"}</td>
                <td className={tdCls}>
                  {isVendor ? p._count.suppliedItems : p._count.orders}
                </td>
                <td className={tdCls}>
                  <Badge color={p.isActive ? "green" : "gray"}>
                    {p.isActive ? "사용" : "중지"}
                  </Badge>
                </td>
                <td className={`${tdCls} whitespace-nowrap`}>
                  <span className="flex gap-1">
                    <ActionButton action={togglePartnerActive.bind(null, p.id)} className={btnGhostCls}>
                      {p.isActive ? "중지" : "재사용"}
                    </ActionButton>
                    <ActionButton
                      action={deletePartner.bind(null, p.id)}
                      className={btnGhostCls}
                      confirmMessage={`${p.code} 거래처를 삭제할까요?`}
                    >
                      삭제
                    </ActionButton>
                  </span>
                </td>
              </tr>
            ))}
            {partners.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-gray-400 py-8 text-sm">
                  등록된 {isVendor ? "공급사" : "고객사"}가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

import { prisma } from "@/lib/db";
import { createSite, deleteSite, toggleSiteActive } from "@/actions/mdm";
import { ActionForm, ActionButton } from "@/components/action-form";
import {
  Badge,
  Card,
  PageTitle,
  btnCls,
  btnGhostCls,
  inputCls,
  tdCls,
  thCls,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SiteMasterPage() {
  const sites = await prisma.site.findMany({
    orderBy: [{ isActive: "desc" }, { code: "asc" }],
    include: {
      lines: { select: { code: true } },
      _count: { select: { facilities: true } },
    },
  });

  return (
    <div>
      <PageTitle>Site Master — 사업장</PageTitle>

      <Card>
        <h2 className="font-semibold text-sm mb-2">사업장 등록</h2>
        <ActionForm action={createSite} className="flex flex-wrap gap-2 items-end">
          <input name="code" placeholder="사업장코드 *" className={inputCls} required />
          <input name="name" placeholder="사업장명 *" className={`${inputCls} w-56`} required />
          <input name="address" placeholder="주소" className={`${inputCls} w-72`} />
          <button type="submit" className={btnCls}>등록</button>
        </ActionForm>
        <p className="text-xs text-gray-500 mt-2">
          라인의 소속 사업장은 Line Master에서, 설비의 소속은 Facility
          Master에서 지정합니다 (Site &gt; Line &gt; Facility 계층).
        </p>
      </Card>

      <Card>
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>코드</th>
              <th className={thCls}>사업장명</th>
              <th className={thCls}>주소</th>
              <th className={thCls}>소속 라인</th>
              <th className={thCls}>설비 수</th>
              <th className={thCls}>상태</th>
              <th className={thCls}></th>
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id} className={s.isActive ? "" : "opacity-50"}>
                <td className={`${tdCls} font-mono`}>{s.code}</td>
                <td className={tdCls}>{s.name}</td>
                <td className={`${tdCls} text-gray-500`}>{s.address ?? "-"}</td>
                <td className={`${tdCls} text-xs`}>
                  {s.lines.length > 0 ? s.lines.map((l) => l.code).join(", ") : "-"}
                </td>
                <td className={tdCls}>{s._count.facilities}</td>
                <td className={tdCls}>
                  <Badge color={s.isActive ? "green" : "gray"}>
                    {s.isActive ? "사용" : "중지"}
                  </Badge>
                </td>
                <td className={`${tdCls} whitespace-nowrap`}>
                  <span className="flex gap-1">
                    <ActionButton action={toggleSiteActive.bind(null, s.id)} className={btnGhostCls}>
                      {s.isActive ? "중지" : "재사용"}
                    </ActionButton>
                    <ActionButton
                      action={deleteSite.bind(null, s.id)}
                      className={btnGhostCls}
                      confirmMessage={`${s.code} 사업장을 삭제할까요?`}
                    >
                      삭제
                    </ActionButton>
                  </span>
                </td>
              </tr>
            ))}
            {sites.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-gray-400 py-8 text-sm">
                  등록된 사업장이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

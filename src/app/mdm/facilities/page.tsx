import { prisma } from "@/lib/db";
import {
  createFacility,
  deleteFacility,
  toggleFacilityActive,
  updateFacility,
} from "@/actions/mdm";
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

export default async function FacilityMasterPage() {
  const [facilities, sites, lines] = await Promise.all([
    prisma.facility.findMany({
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
      include: { site: true, line: true },
    }),
    prisma.site.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.productionLine.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <div>
      <PageTitle>Facility Master — 설비</PageTitle>

      <Card>
        <h2 className="font-semibold text-sm mb-2">설비 등록</h2>
        <ActionForm action={createFacility} className="flex flex-wrap gap-2 items-end">
          <input name="code" placeholder="설비코드 *" className={inputCls} required />
          <input name="name" placeholder="설비명 *" className={`${inputCls} w-56`} required />
          <select name="siteId" className={inputCls} defaultValue="">
            <option value="">사업장 없음</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.code} {s.name}</option>
            ))}
          </select>
          <select name="lineId" className={inputCls} defaultValue="">
            <option value="">라인 없음</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>{l.code} {l.name}</option>
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
              <th className={thCls}>설비명</th>
              <th className={thCls}>소속 (사업장 / 라인)</th>
              <th className={thCls}>상태</th>
              <th className={thCls}></th>
            </tr>
          </thead>
          <tbody>
            {facilities.map((f) => (
              <tr key={f.id} className={f.isActive ? "" : "opacity-50"}>
                <td className={`${tdCls} font-mono`}>{f.code}</td>
                <td className={tdCls}>{f.name}</td>
                <td className={tdCls}>
                  <ActionForm
                    action={updateFacility.bind(null, f.id)}
                    className="flex gap-1 items-center"
                  >
                    <select name="siteId" defaultValue={f.siteId ?? ""} className={`${inputCls} text-xs`}>
                      <option value="">사업장-</option>
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>{s.code}</option>
                      ))}
                    </select>
                    <select name="lineId" defaultValue={f.lineId ?? ""} className={`${inputCls} text-xs`}>
                      <option value="">라인-</option>
                      {lines.map((l) => (
                        <option key={l.id} value={l.id}>{l.code}</option>
                      ))}
                    </select>
                    <button type="submit" className={btnGhostCls}>저장</button>
                  </ActionForm>
                </td>
                <td className={tdCls}>
                  <Badge color={f.isActive ? "green" : "gray"}>
                    {f.isActive ? "가동" : "중지"}
                  </Badge>
                </td>
                <td className={`${tdCls} whitespace-nowrap`}>
                  <span className="flex gap-1">
                    <ActionButton action={toggleFacilityActive.bind(null, f.id)} className={btnGhostCls}>
                      {f.isActive ? "중지" : "재가동"}
                    </ActionButton>
                    <ActionButton
                      action={deleteFacility.bind(null, f.id)}
                      className={btnGhostCls}
                      confirmMessage={`${f.code} 설비를 삭제할까요?`}
                    >
                      삭제
                    </ActionButton>
                  </span>
                </td>
              </tr>
            ))}
            {facilities.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-gray-400 py-8 text-sm">
                  등록된 설비가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

import { prisma } from "@/lib/db";
import {
  createLine,
  toggleLineActive,
  updateLineCapacity,
} from "@/actions/lines";
import { updateLineSite } from "@/actions/mdm";
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

export default async function LinesPage() {
  const [lines, sites] = await Promise.all([
    prisma.productionLine.findMany({
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
      include: { defaultItems: { select: { id: true } } },
    }),
    prisma.site.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <div>
      <PageTitle>Line Master — 생산 라인</PageTitle>

      <Card>
        <h2 className="font-semibold text-sm mb-2">라인 등록</h2>
        <ActionForm action={createLine} className="flex flex-wrap gap-2 items-end">
          <input name="code" placeholder="라인코드 *" className={inputCls} required />
          <input name="name" placeholder="라인명 *" className={`${inputCls} w-64`} required />
          <input
            name="weeklyCapacity"
            type="number"
            min={1}
            placeholder="주간 CAPA (개/주) *"
            className={`${inputCls} w-44`}
            required
          />
          <button type="submit" className={btnCls}>등록</button>
        </ActionForm>
        <p className="text-xs text-gray-500 mt-2">
          주간 CAPA는 해당 라인이 1주에 생산 가능한 수량(개)입니다. MPS 화면의
          부하율 계산에 사용됩니다.
        </p>
      </Card>

      <Card>
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>코드</th>
              <th className={thCls}>라인명</th>
              <th className={thCls}>주간 CAPA</th>
              <th className={thCls}>소속 사업장</th>
              <th className={thCls}>기본 배정 품목 수</th>
              <th className={thCls}>상태</th>
              <th className={thCls}></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className={line.isActive ? "" : "opacity-50"}>
                <td className={`${tdCls} font-mono`}>{line.code}</td>
                <td className={tdCls}>{line.name}</td>
                <td className={tdCls}>
                  <ActionForm
                    action={updateLineCapacity.bind(null, line.id)}
                    className="flex gap-1 items-center"
                  >
                    <input
                      name="weeklyCapacity"
                      type="number"
                      min={1}
                      defaultValue={line.weeklyCapacity}
                      className={`${inputCls} w-24 text-right`}
                    />
                    <span className="text-xs text-gray-500">개/주</span>
                    <input
                      name="dailyCapacity"
                      type="number"
                      min={1}
                      defaultValue={line.dailyCapacity ?? ""}
                      placeholder="일일"
                      className={`${inputCls} w-20 text-right`}
                    />
                    <span className="text-xs text-gray-500">개/일</span>
                    <button type="submit" className={btnGhostCls}>저장</button>
                  </ActionForm>
                </td>
                <td className={tdCls}>
                  <ActionForm
                    action={updateLineSite.bind(null, line.id)}
                    className="flex gap-1 items-center"
                  >
                    <select name="siteId" defaultValue={line.siteId ?? ""} className={`${inputCls} text-xs`}>
                      <option value="">없음</option>
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>{s.code} {s.name}</option>
                      ))}
                    </select>
                    <button type="submit" className={btnGhostCls}>저장</button>
                  </ActionForm>
                </td>
                <td className={tdCls}>{line.defaultItems.length}</td>
                <td className={tdCls}>
                  <Badge color={line.isActive ? "green" : "gray"}>
                    {line.isActive ? "가동" : "중지"}
                  </Badge>
                </td>
                <td className={tdCls}>
                  <ActionButton
                    action={toggleLineActive.bind(null, line.id)}
                    className={btnGhostCls}
                  >
                    {line.isActive ? "가동중지" : "재가동"}
                  </ActionButton>
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-gray-400 py-8 text-sm">
                  등록된 라인이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

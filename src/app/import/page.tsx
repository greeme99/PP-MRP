"use client";

import { useState, useTransition } from "react";
import { Badge, Card, PageTitle, btnCls, tdCls, thCls } from "@/components/ui";

type ImportError = {
  sheet: string;
  row: number;
  column: string;
  message: string;
};
type SheetResult = { sheet: string; imported: number; errors: ImportError[] };

export default function ImportPage() {
  const [results, setResults] = useState<SheetResult[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setResults(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/import", {
          method: "POST",
          body: formData,
        });
        const json = await res.json();
        if (!json.ok) {
          setMessage(json.message ?? "가져오기에 실패했습니다");
        } else {
          setResults(json.results);
        }
      } catch {
        setMessage("서버 요청에 실패했습니다");
      }
    });
  };

  return (
    <div>
      <PageTitle>엑셀 가져오기</PageTitle>

      <Card>
        <ol className="text-sm text-gray-700 list-decimal ml-5 space-y-1 mb-4">
          <li>
            <a href="/api/template" className="text-blue-600 hover:underline">
              가져오기 템플릿 다운로드
            </a>
            — 시트: 품목 / 거래처 / BOM / 수주 (필요한 시트만 채워도 됩니다)
          </li>
          <li>기존 엑셀 데이터를 템플릿 형식에 맞춰 붙여넣기</li>
          <li>아래에서 파일을 선택하고 업로드</li>
        </ol>
        <form onSubmit={onSubmit} className="flex gap-2 items-center">
          <input
            type="file"
            name="file"
            accept=".xlsx"
            required
            className="text-sm"
          />
          <button type="submit" disabled={pending} className={btnCls}>
            {pending ? "가져오는 중..." : "업로드"}
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-2">
          같은 코드(품목코드/거래처코드/수주번호+행번호)는 덮어쓰기(upsert)되고,
          에러가 있는 시트는 통째로 반영되지 않습니다.
        </p>
      </Card>

      {message && (
        <Card>
          <p className="text-red-600 text-sm">{message}</p>
        </Card>
      )}

      {results && <ImportResults results={results} />}
    </div>
  );
}

/** 같은 원인끼리 묶은 에러 요약. 가변 부분(": FG-1" 등)은 원인 그룹에서 제거. */
function groupErrors(errors: ImportError[]) {
  const groups = new Map<
    string,
    { sheet: string; column: string; cause: string; rows: number[] }
  >();
  for (const e of errors) {
    const cause = e.message.replace(/: .*$/, "").replace(/\s*\(현재:.*\)$/, "");
    const key = `${e.sheet}|${e.column}|${cause}`;
    let g = groups.get(key);
    if (!g) {
      g = { sheet: e.sheet, column: e.column, cause, rows: [] };
      groups.set(key, g);
    }
    g.rows.push(e.row);
  }
  return [...groups.values()].sort((a, b) => b.rows.length - a.rows.length);
}

function ImportResults({ results }: { results: SheetResult[] }) {
  const errorSheets = new Set(
    results.filter((r) => r.errors.length > 0).map((r) => r.sheet)
  );
  const allErrors = results.flatMap((r) => r.errors);
  // 연쇄 에러: 품목/거래처 시트가 미반영이면 BOM/수주의 "등록되지 않은 코드" 에러는 대부분 따라 해소됨
  const cascade =
    (errorSheets.has("품목") || errorSheets.has("거래처")) &&
    allErrors.some(
      (e) =>
        (e.sheet === "BOM" || e.sheet === "수주") &&
        e.message.startsWith("등록되지 않은")
    );
  const groups = groupErrors(allErrors);

  return (
    <Card>
      <h2 className="font-semibold text-sm mb-2">가져오기 결과</h2>
      <ul className="text-sm space-y-1 mb-3">
        {results.map((r) => (
          <li key={r.sheet}>
            <span className="font-medium">{r.sheet}</span>:{" "}
            {r.errors.length === 0 ? (
              <Badge color="green">{r.imported}행 반영</Badge>
            ) : (
              <Badge color="red">에러 {r.errors.length}건 — 미반영</Badge>
            )}
          </li>
        ))}
      </ul>

      {cascade && (
        <p className="text-sm bg-amber-50 border border-amber-200 rounded p-2 mb-3 text-amber-800">
          BOM/수주의 &quot;등록되지 않은 코드&quot; 에러는 대부분{" "}
          {errorSheets.has("품목") ? "품목" : "거래처"} 시트가 반영되지 않아
          생긴 <b>연쇄 에러</b>입니다. 해당 시트의 에러를 먼저 해결한 뒤{" "}
          <b>같은 파일을 통째로 재업로드</b>하면 함께 해소됩니다 (이미 반영된
          시트는 덮어쓰기라 안전합니다).
        </p>
      )}

      {groups.length > 0 && (
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>시트</th>
              <th className={thCls}>열</th>
              <th className={thCls}>원인</th>
              <th className={thCls}>건수</th>
              <th className={thCls}>해당 행 (예시)</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g, i) => (
              <tr key={i}>
                <td className={tdCls}>{g.sheet}</td>
                <td className={tdCls}>{g.column || "-"}</td>
                <td className={`${tdCls} text-red-700`}>{g.cause}</td>
                <td className={`${tdCls} text-right`}>{g.rows.length}</td>
                <td className={`${tdCls} text-gray-500`}>
                  {g.rows.slice(0, 8).join(", ")}
                  {g.rows.length > 8 && ` 외 ${g.rows.length - 8}행`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

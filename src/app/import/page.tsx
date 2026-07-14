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

      {results && (
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
          {results.some((r) => r.errors.length > 0) && (
            <table className="w-full">
              <thead>
                <tr>
                  <th className={thCls}>시트</th>
                  <th className={thCls}>행</th>
                  <th className={thCls}>열</th>
                  <th className={thCls}>메시지</th>
                </tr>
              </thead>
              <tbody>
                {results
                  .flatMap((r) => r.errors)
                  .map((e, i) => (
                    <tr key={i}>
                      <td className={tdCls}>{e.sheet}</td>
                      <td className={tdCls}>{e.row || "-"}</td>
                      <td className={tdCls}>{e.column || "-"}</td>
                      <td className={`${tdCls} text-red-700`}>{e.message}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}

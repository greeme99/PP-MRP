import ExcelJS from "exceljs";
import { SHEET_HEADERS } from "@/lib/excel/import";

export const runtime = "nodejs";

const EXAMPLE_ROWS: Record<string, (string | number)[][]> = {
  품목: [
    ["FG-EXAMPLE-01", "예시 완제품", "완제품", "EA", "규격 예시", "L1"],
    ["RM-EXAMPLE-01", "예시 원자재", "원자재", "EA", "", ""],
  ],
  거래처: [["C-EXAMPLE", "예시 고객사(주)", "고객사", "홍길동 010-0000-0000"]],
  BOM: [["FG-EXAMPLE-01", "RM-EXAMPLE-01", 2]],
  수주: [
    ["SO-EXAMPLE-1", "C-EXAMPLE", "2026-07-01", 1, "FG-EXAMPLE-01", 500, "2026-08-31"],
  ],
  재고: [["RM-EXAMPLE-01", 1000, "2026-07-14"]],
};

export async function GET() {
  const workbook = new ExcelJS.Workbook();
  for (const [sheetName, headers] of Object.entries(SHEET_HEADERS)) {
    const ws = workbook.addWorksheet(sheetName);
    ws.addRow([...headers]);
    ws.getRow(1).font = { bold: true };
    for (const row of EXAMPLE_ROWS[sheetName] ?? []) {
      ws.addRow(row);
    }
    ws.columns.forEach((col) => {
      col.width = 18;
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = encodeURIComponent("가져오기_템플릿.xlsx");
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
    },
  });
}

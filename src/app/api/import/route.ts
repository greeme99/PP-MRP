import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import {
  SHEET_HEADERS,
  parseBomSheet,
  parseItemsSheet,
  parseOrdersSheet,
  parsePartnersSheet,
  type CellValue,
  type SheetName,
} from "@/lib/excel/import";
import {
  applyBom,
  applyItems,
  applyOrders,
  applyPartners,
  type SheetApplyResult,
} from "@/lib/excel/apply";

export const runtime = "nodejs";

/** ExcelJS 셀 값(formula/richText 등)을 단순 값으로 정규화한다. */
function normalizeCell(v: ExcelJS.CellValue): CellValue {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    if (v instanceof Date) return v;
    if ("result" in v) return normalizeCell(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return typeof v.text === "string" ? v.text : String(v.text);
    if ("error" in v) return null;
    return String(v);
  }
  return v as CellValue;
}

function sheetToRows(ws: ExcelJS.Worksheet): CellValue[][] {
  const rows: CellValue[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const values: CellValue[] = [];
    // row.values는 1-base 배열
    for (let c = 1; c <= ws.columnCount; c++) {
      values.push(normalizeCell(row.getCell(c).value));
    }
    rows.push(values);
  }
  return rows;
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, message: "파일이 없습니다" },
      { status: 400 }
    );
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    return NextResponse.json(
      { ok: false, message: "xlsx 파일을 읽을 수 없습니다. 형식을 확인하세요." },
      { status: 400 }
    );
  }

  const found = (Object.keys(SHEET_HEADERS) as SheetName[]).filter((name) =>
    workbook.getWorksheet(name)
  );
  if (found.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message: `인식 가능한 시트가 없습니다. 시트 이름은 ${Object.keys(SHEET_HEADERS).join(", ")} 중 하나여야 합니다. 템플릿을 내려받아 사용하세요.`,
      },
      { status: 400 }
    );
  }

  // 참조 순서 보장: 거래처 → 품목 → BOM → 수주
  const results: SheetApplyResult[] = [];
  for (const name of ["거래처", "품목", "BOM", "수주"] as const) {
    const ws = workbook.getWorksheet(name);
    if (!ws) continue;
    const rows = sheetToRows(ws);
    const parsed =
      name === "거래처"
        ? parsePartnersSheet(rows)
        : name === "품목"
          ? parseItemsSheet(rows)
          : name === "BOM"
            ? parseBomSheet(rows)
            : parseOrdersSheet(rows);

    if (parsed.errors.length > 0) {
      results.push({ sheet: name, imported: 0, errors: parsed.errors });
      continue; // 시트 단위 all-or-nothing: 파싱 에러가 있으면 미반영
    }
    try {
      const applied =
        name === "거래처"
          ? await applyPartners(parsed.rows as never)
          : name === "품목"
            ? await applyItems(parsed.rows as never)
            : name === "BOM"
              ? await applyBom(parsed.rows as never)
              : await applyOrders(parsed.rows as never);
      results.push(applied);
    } catch (e) {
      results.push({
        sheet: name,
        imported: 0,
        errors: [
          {
            sheet: name,
            row: 0,
            column: "",
            message: `저장 중 오류가 발생해 이 시트는 반영되지 않았습니다: ${e instanceof Error ? e.message : String(e)}`,
          },
        ],
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}

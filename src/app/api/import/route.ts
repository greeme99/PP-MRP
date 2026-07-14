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

/**
 * xlsx가 아닌 파일을 시그니처로 감지해 원인별 안내 메시지를 반환한다.
 * xlsx는 ZIP 컨테이너라 항상 "PK"로 시작한다.
 */
function detectNonXlsx(bytes: Uint8Array): string | null {
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return null; // ZIP(PK) → xlsx일 가능성, exceljs에 넘긴다
  }
  // 구형 Excel(.xls)의 OLE2 시그니처: D0 CF 11 E0
  if (
    bytes.length >= 4 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  ) {
    return '구형 Excel(.xls) 형식입니다. Excel에서 파일을 연 뒤 "다른 이름으로 저장 → Excel 통합 문서(.xlsx)"로 저장해 다시 업로드하세요.';
  }
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.slice(0, 256))
    .trimStart()
    .toLowerCase();
  // 일부 ERP/그룹웨어는 HTML 표를 .xls/.xlsx 확장자로 내보낸다
  if (head.startsWith("<") || head.includes("<html") || head.includes("<table")) {
    return "엑셀 파일이 아니라 HTML로 내보낸 표입니다(일부 시스템의 엑셀 내보내기가 이 형식입니다). Excel에서 파일을 연 뒤 .xlsx로 다시 저장해 업로드하세요.";
  }
  return '엑셀 통합 문서(.xlsx)가 아닙니다. Excel에서 "다른 이름으로 저장 → Excel 통합 문서(.xlsx)"로 저장한 파일을 업로드하세요.';
}

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

  const buffer = await file.arrayBuffer();
  const formatError = detectNonXlsx(new Uint8Array(buffer));
  if (formatError) {
    return NextResponse.json({ ok: false, message: formatError }, { status: 400 });
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch (e) {
    console.error("[import] xlsx 읽기 실패:", file.name, e);
    return NextResponse.json(
      {
        ok: false,
        message: `xlsx 파일을 읽을 수 없습니다 (${e instanceof Error ? e.message : String(e)}). Excel에서 "다른 이름으로 저장 → Excel 통합 문서(.xlsx)"로 다시 저장해 업로드해 보세요.`,
      },
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

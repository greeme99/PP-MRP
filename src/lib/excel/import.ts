// Excel import 파싱 (DB 비의존 — 2차원 셀 배열을 받아 구조화한다)
// 시트: 품목 / 거래처 / BOM / 수주

export type CellValue = string | number | boolean | Date | null | undefined;

export type ImportError = {
  sheet: string;
  row: number; // 엑셀 기준 1-base 행 번호
  column: string;
  message: string;
};

export const SHEET_HEADERS = {
  품목: ["품목코드", "품명", "유형", "단위", "규격", "기본라인코드"],
  거래처: ["거래처코드", "거래처명", "구분", "담당자"],
  BOM: ["모품목코드", "자품목코드", "소요량"],
  수주: ["수주번호", "고객사코드", "수주일", "행번호", "품목코드", "수량", "납기일"],
  재고: ["품목코드", "실사수량", "기준일"],
} as const;

export type SheetName = keyof typeof SHEET_HEADERS;

export const ITEM_TYPE_FROM_LABEL: Record<string, "FG" | "SF" | "RM"> = {
  완제품: "FG",
  반제품: "SF",
  원자재: "RM",
  FG: "FG",
  SF: "SF",
  RM: "RM",
};

export const PARTNER_TYPE_FROM_LABEL: Record<
  string,
  "CUSTOMER" | "VENDOR" | "BOTH"
> = {
  고객사: "CUSTOMER",
  공급사: "VENDOR",
  "고객+공급": "BOTH",
  CUSTOMER: "CUSTOMER",
  VENDOR: "VENDOR",
  BOTH: "BOTH",
};

export type ItemRow = {
  row: number;
  code: string;
  name: string;
  type: "FG" | "SF" | "RM";
  uom: string;
  spec?: string;
  defaultLineCode?: string;
};

export type PartnerRow = {
  row: number;
  code: string;
  name: string;
  type: "CUSTOMER" | "VENDOR" | "BOTH";
  contact?: string;
};

export type BomRow = {
  row: number;
  parentCode: string;
  childCode: string;
  qtyPer: number;
};

export type OrderRow = {
  row: number;
  orderNo: string;
  customerCode: string;
  orderDate: Date;
  lineNo: number;
  itemCode: string;
  qty: number;
  dueDate: Date;
};

// ---- 셀 값 정규화 ----

function cellString(v: CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function cellNumber(v: CellValue): number | null {
  if (typeof v === "number") return v;
  const s = cellString(v).replace(/,/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Excel 날짜 serial(1900 기준)을 UTC Date로 변환한다. */
export function excelSerialToDate(serial: number): Date {
  // Excel serial 1 = 1900-01-01, 1900 윤년 버그 포함 → 1899-12-30 기준
  const base = Date.UTC(1899, 11, 30);
  return new Date(base + Math.round(serial) * 24 * 60 * 60 * 1000);
}

function cellDate(v: CellValue): Date | null {
  if (v instanceof Date) {
    // ExcelJS가 로컬타임 Date를 줄 수 있으므로 날짜부만 취해 UTC 정규화
    return new Date(
      Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate())
    );
  }
  if (typeof v === "number") return excelSerialToDate(v);
  const s = cellString(v);
  const m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  // Date.UTC의 월/일 롤오버(예: 13월 45일) 차단
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

// ---- 공통 파서 골격 ----

export function validateHeader(
  sheet: SheetName,
  headerRow: CellValue[]
): ImportError[] {
  const expected = SHEET_HEADERS[sheet];
  const errors: ImportError[] = [];
  expected.forEach((h, i) => {
    if (cellString(headerRow[i]) !== h) {
      errors.push({
        sheet,
        row: 1,
        column: h,
        message: `1행 ${i + 1}번째 열은 "${h}"여야 합니다 (현재: "${cellString(headerRow[i])}")`,
      });
    }
  });
  return errors;
}

function isEmptyRow(row: CellValue[]): boolean {
  return row.every((c) => cellString(c) === "");
}

type ParseResult<T> = { rows: T[]; errors: ImportError[] };

/**
 * rows[0]은 헤더, rows[1..]은 데이터. 엑셀 행 번호 = 배열 인덱스 + 1.
 */
export function parseItemsSheet(rows: CellValue[][]): ParseResult<ItemRow> {
  const errors = validateHeader("품목", rows[0] ?? []);
  if (errors.length > 0) return { rows: [], errors };
  const out: ItemRow[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (isEmptyRow(r)) continue;
    const rowNo = i + 1;
    const code = cellString(r[0]);
    const name = cellString(r[1]);
    const typeLabel = cellString(r[2]);
    const type = ITEM_TYPE_FROM_LABEL[typeLabel];
    const dup = !!code && seen.has(code);
    if (!code) errors.push({ sheet: "품목", row: rowNo, column: "품목코드", message: "필수입니다" });
    else if (dup)
      errors.push({ sheet: "품목", row: rowNo, column: "품목코드", message: `중복된 품목코드입니다: ${code}` });
    if (!name) errors.push({ sheet: "품목", row: rowNo, column: "품명", message: "필수입니다" });
    if (!type)
      errors.push({ sheet: "품목", row: rowNo, column: "유형", message: `완제품/반제품/원자재 중 하나여야 합니다 (현재: "${typeLabel}")` });
    if (!code || dup || !name || !type) continue;
    seen.add(code);
    out.push({
      row: rowNo,
      code,
      name,
      type,
      uom: cellString(r[3]) || "EA",
      spec: cellString(r[4]) || undefined,
      defaultLineCode: cellString(r[5]) || undefined,
    });
  }
  return { rows: out, errors };
}

export function parsePartnersSheet(
  rows: CellValue[][]
): ParseResult<PartnerRow> {
  const errors = validateHeader("거래처", rows[0] ?? []);
  if (errors.length > 0) return { rows: [], errors };
  const out: PartnerRow[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (isEmptyRow(r)) continue;
    const rowNo = i + 1;
    const code = cellString(r[0]);
    const name = cellString(r[1]);
    const typeLabel = cellString(r[2]);
    const type = PARTNER_TYPE_FROM_LABEL[typeLabel];
    const dup = !!code && seen.has(code);
    if (!code) errors.push({ sheet: "거래처", row: rowNo, column: "거래처코드", message: "필수입니다" });
    else if (dup)
      errors.push({ sheet: "거래처", row: rowNo, column: "거래처코드", message: `중복된 거래처코드입니다: ${code}` });
    if (!name) errors.push({ sheet: "거래처", row: rowNo, column: "거래처명", message: "필수입니다" });
    if (!type)
      errors.push({ sheet: "거래처", row: rowNo, column: "구분", message: `고객사/공급사/고객+공급 중 하나여야 합니다 (현재: "${typeLabel}")` });
    if (!code || dup || !name || !type) continue;
    seen.add(code);
    out.push({ row: rowNo, code, name, type, contact: cellString(r[3]) || undefined });
  }
  return { rows: out, errors };
}

export function parseBomSheet(rows: CellValue[][]): ParseResult<BomRow> {
  const errors = validateHeader("BOM", rows[0] ?? []);
  if (errors.length > 0) return { rows: [], errors };
  const out: BomRow[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (isEmptyRow(r)) continue;
    const rowNo = i + 1;
    const parentCode = cellString(r[0]);
    const childCode = cellString(r[1]);
    const qtyPer = cellNumber(r[2]);
    if (!parentCode) errors.push({ sheet: "BOM", row: rowNo, column: "모품목코드", message: "필수입니다" });
    if (!childCode) errors.push({ sheet: "BOM", row: rowNo, column: "자품목코드", message: "필수입니다" });
    if (parentCode && childCode && parentCode === childCode)
      errors.push({ sheet: "BOM", row: rowNo, column: "자품목코드", message: "모품목과 자품목이 같을 수 없습니다" });
    if (qtyPer === null || qtyPer <= 0)
      errors.push({ sheet: "BOM", row: rowNo, column: "소요량", message: "0보다 큰 숫자여야 합니다" });
    const key = `${parentCode}|${childCode}`;
    if (parentCode && childCode && seen.has(key))
      errors.push({ sheet: "BOM", row: rowNo, column: "자품목코드", message: `중복된 BOM 행입니다: ${key}` });
    if (!parentCode || !childCode || parentCode === childCode || qtyPer === null || qtyPer <= 0 || seen.has(key))
      continue;
    seen.add(key);
    out.push({ row: rowNo, parentCode, childCode, qtyPer });
  }
  return { rows: out, errors };
}

export function parseOrdersSheet(rows: CellValue[][]): ParseResult<OrderRow> {
  const errors = validateHeader("수주", rows[0] ?? []);
  if (errors.length > 0) return { rows: [], errors };
  const out: OrderRow[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (isEmptyRow(r)) continue;
    const rowNo = i + 1;
    const orderNo = cellString(r[0]);
    const customerCode = cellString(r[1]);
    const orderDate = cellDate(r[2]);
    const lineNo = cellNumber(r[3]);
    const itemCode = cellString(r[4]);
    const qty = cellNumber(r[5]);
    const dueDate = cellDate(r[6]);

    if (!orderNo) errors.push({ sheet: "수주", row: rowNo, column: "수주번호", message: "필수입니다" });
    if (!customerCode) errors.push({ sheet: "수주", row: rowNo, column: "고객사코드", message: "필수입니다" });
    if (!orderDate) errors.push({ sheet: "수주", row: rowNo, column: "수주일", message: "날짜(YYYY-MM-DD 또는 엑셀 날짜)여야 합니다" });
    if (lineNo === null || !Number.isInteger(lineNo) || lineNo <= 0)
      errors.push({ sheet: "수주", row: rowNo, column: "행번호", message: "1 이상의 정수여야 합니다" });
    if (!itemCode) errors.push({ sheet: "수주", row: rowNo, column: "품목코드", message: "필수입니다" });
    if (qty === null || !Number.isInteger(qty) || qty <= 0)
      errors.push({ sheet: "수주", row: rowNo, column: "수량", message: "1 이상의 정수여야 합니다" });
    if (!dueDate) errors.push({ sheet: "수주", row: rowNo, column: "납기일", message: "날짜(YYYY-MM-DD 또는 엑셀 날짜)여야 합니다" });

    const key = `${orderNo}|${lineNo}`;
    if (orderNo && lineNo !== null && seen.has(key))
      errors.push({ sheet: "수주", row: rowNo, column: "행번호", message: `수주번호+행번호가 중복입니다: ${key}` });

    if (!orderNo || !customerCode || !orderDate || lineNo === null || !Number.isInteger(lineNo) || lineNo <= 0 || !itemCode || qty === null || !Number.isInteger(qty) || qty <= 0 || !dueDate || seen.has(key))
      continue;
    seen.add(key);
    out.push({ row: rowNo, orderNo, customerCode, orderDate, lineNo, itemCode, qty, dueDate });
  }
  return { rows: out, errors };
}

export type InventoryRow = {
  row: number;
  itemCode: string;
  actualQty: number; // 실사 절대수량
  date: Date | null; // 기준일 (없으면 반영 시점의 오늘)
};

export function parseInventorySheet(
  rows: CellValue[][]
): ParseResult<InventoryRow> {
  const errors = validateHeader("재고", rows[0] ?? []);
  if (errors.length > 0) return { rows: [], errors };
  const out: InventoryRow[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (isEmptyRow(r)) continue;
    const rowNo = i + 1;
    const itemCode = cellString(r[0]);
    const actualQty = cellNumber(r[1]);
    const dateRaw = cellString(r[2]);
    const date = dateRaw === "" ? null : cellDate(r[2]);
    const dup = !!itemCode && seen.has(itemCode);

    if (!itemCode) errors.push({ sheet: "재고", row: rowNo, column: "품목코드", message: "필수입니다" });
    else if (dup)
      errors.push({ sheet: "재고", row: rowNo, column: "품목코드", message: `중복된 품목코드입니다: ${itemCode}` });
    if (actualQty === null || !Number.isInteger(actualQty) || actualQty < 0)
      errors.push({ sheet: "재고", row: rowNo, column: "실사수량", message: "0 이상의 정수여야 합니다" });
    if (dateRaw !== "" && date === null)
      errors.push({ sheet: "재고", row: rowNo, column: "기준일", message: "날짜(YYYY-MM-DD 또는 엑셀 날짜)여야 합니다" });

    if (!itemCode || dup || actualQty === null || !Number.isInteger(actualQty) || actualQty < 0 || (dateRaw !== "" && date === null))
      continue;
    seen.add(itemCode);
    out.push({ row: rowNo, itemCode, actualQty, date });
  }
  return { rows: out, errors };
}

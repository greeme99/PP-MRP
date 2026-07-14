import { describe, expect, it } from "vitest";
import {
  SHEET_HEADERS,
  excelSerialToDate,
  parseBomSheet,
  parseItemsSheet,
  parseOrdersSheet,
  parsePartnersSheet,
} from "./import";

const H = SHEET_HEADERS;

describe("excelSerialToDate", () => {
  it("serial 45000 = 2023-03-15", () => {
    expect(excelSerialToDate(45000).toISOString().slice(0, 10)).toBe("2023-03-15");
  });
});

describe("parseItemsSheet", () => {
  it("정상 행 파싱 + 트리밍 + 기본 단위", () => {
    const { rows, errors } = parseItemsSheet([
      [...H.품목],
      [" A-1 ", " 모니터 ", "완제품", "", "", "L1"],
      ["A-2", "패널", "원자재", "BOX", "21.5인치", ""],
    ]);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { row: 2, code: "A-1", name: "모니터", type: "FG", uom: "EA", spec: undefined, defaultLineCode: "L1" },
      { row: 3, code: "A-2", name: "패널", type: "RM", uom: "BOX", spec: "21.5인치", defaultLineCode: undefined },
    ]);
  });

  it("헤더가 다르면 즉시 에러", () => {
    const { errors } = parseItemsSheet([["코드", "이름"]]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].row).toBe(1);
  });

  it("필수값 누락/잘못된 유형은 행 번호와 함께 에러", () => {
    const { rows, errors } = parseItemsSheet([
      [...H.품목],
      ["", "이름만", "완제품", "", "", ""],
      ["B-1", "", "완제품", "", "", ""],
      ["B-2", "이름", "완성품", "", "", ""],
    ]);
    expect(rows).toEqual([]);
    expect(errors).toHaveLength(3);
    expect(errors[0]).toMatchObject({ sheet: "품목", row: 2, column: "품목코드" });
    expect(errors[1]).toMatchObject({ row: 3, column: "품명" });
    expect(errors[2]).toMatchObject({ row: 4, column: "유형" });
  });

  it("중복 품목코드 검출, 빈 행 무시", () => {
    const { rows, errors } = parseItemsSheet([
      [...H.품목],
      ["C-1", "a", "FG", "", "", ""],
      ["", "", "", "", "", ""],
      ["C-1", "b", "SF", "", "", ""],
    ]);
    expect(rows).toHaveLength(1);
    expect(errors[0]).toMatchObject({ row: 4, column: "품목코드" });
  });
});

describe("parsePartnersSheet", () => {
  it("한국어/영문 구분 라벨 모두 허용", () => {
    const { rows, errors } = parsePartnersSheet([
      [...H.거래처],
      ["P-1", "고객", "고객사", "김담당"],
      ["P-2", "벤더", "VENDOR", ""],
    ]);
    expect(errors).toEqual([]);
    expect(rows[0].type).toBe("CUSTOMER");
    expect(rows[1].type).toBe("VENDOR");
  });
});

describe("parseBomSheet", () => {
  it("정상 파싱 + 소수 소요량", () => {
    const { rows, errors } = parseBomSheet([
      [...H.BOM],
      ["P", "C1", 2],
      ["P", "C2", "0.5"],
    ]);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { row: 2, parentCode: "P", childCode: "C1", qtyPer: 2 },
      { row: 3, parentCode: "P", childCode: "C2", qtyPer: 0.5 },
    ]);
  });

  it("자기참조/0 이하 소요량/중복 행 에러", () => {
    const { errors } = parseBomSheet([
      [...H.BOM],
      ["P", "P", 1],
      ["P", "C", 0],
      ["P", "D", 1],
      ["P", "D", 2],
    ]);
    expect(errors).toHaveLength(3);
    expect(errors[0]).toMatchObject({ row: 2, message: "모품목과 자품목이 같을 수 없습니다" });
    expect(errors[1]).toMatchObject({ row: 3, column: "소요량" });
    expect(errors[2]).toMatchObject({ row: 5 });
  });
});

describe("parseOrdersSheet", () => {
  it("문자열/Date/serial 날짜 모두 허용", () => {
    const { rows, errors } = parseOrdersSheet([
      [...H.수주],
      ["SO-1", "P-1", "2026-07-01", 1, "A-1", 100, new Date("2026-07-27T00:00:00Z")],
      ["SO-1", "P-1", "2026.07.01", 2, "A-2", "1,000", 46247], // serial 46247 = 2026-08-10 근방
    ]);
    expect(errors).toEqual([]);
    expect(rows[0].orderDate.toISOString().slice(0, 10)).toBe("2026-07-01");
    expect(rows[0].dueDate.toISOString().slice(0, 10)).toBe("2026-07-27");
    expect(rows[1].qty).toBe(1000);
    expect(rows[1].dueDate.getUTCFullYear()).toBe(2026);
  });

  it("수주번호+행번호 중복 검출", () => {
    const { rows, errors } = parseOrdersSheet([
      [...H.수주],
      ["SO-1", "P-1", "2026-07-01", 1, "A-1", 100, "2026-07-27"],
      ["SO-1", "P-1", "2026-07-01", 1, "A-2", 200, "2026-07-27"],
    ]);
    expect(rows).toHaveLength(1);
    expect(errors[0]).toMatchObject({ row: 3, column: "행번호" });
  });

  it("잘못된 날짜/수량 에러", () => {
    const { errors } = parseOrdersSheet([
      [...H.수주],
      ["SO-1", "P-1", "7월1일", 1, "A-1", -5, "2026-13-45"],
    ]);
    const cols = errors.map((e) => e.column);
    expect(cols).toContain("수주일");
    expect(cols).toContain("수량");
    expect(cols).toContain("납기일");
  });
});

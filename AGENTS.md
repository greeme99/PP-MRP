<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Prod.Plan — 생산계획시스템 (MPS MVP)

중견 전자제조업체(OEM/ODM 소형 가전 + 대기업 납품용 조립 전자부품, MTO)의
엑셀 수작업을 대체하는 주 단위 생산계획(MPS) 웹앱. 사내망, 소수 사용자, 한국어 UI.

## Stack
- Next.js 16 (App Router, `src/` 디렉터리) + TypeScript + Tailwind 4
- SQLite + Prisma 6 (`prisma/dev.db`, 스키마 `prisma/schema.prisma`)
- exceljs (xlsx 읽기/쓰기), zod (입력 검증), Vitest (단위 테스트)
- CRUD·계획 편집은 Server Actions(`src/actions/`), 파일 업/다운로드만 Route Handlers(`src/app/api/`)

## Commands
- `npm run dev` — 개발 서버 (port 3000, `.claude/launch.json`의 prod-plan-dev)
- `npm test` — Vitest 단위 테스트 (`src/**/*.test.ts`)
- `npm run typecheck` / `npm run lint`
- `npm run db:migrate` / `npm run db:seed` — Prisma 마이그레이션/시드

## Architecture
- `src/lib/week.ts` — 주차 표현의 단일 진입점. 모든 weekStart는 "해당 주 월요일 UTC 자정"으로 정규화. 날짜 연산은 반드시 이 모듈을 거친다.
- `src/lib/planning.ts` — MPS 초안 생성(순수 함수). 정책: 무한능력 + 납기주 전량 배치, 과거 납기는 이번 주로 클램프, 계획이 이미 있는 수주라인은 불변(멱등). 유한능력 평준화는 하지 않고 부하/CAPA 색상 표시로 사람이 조정한다.
- `src/lib/bom.ts` — BOM 순환 검출(순수 함수). BOM 저장 경로는 모두 이 검사를 거친다.
- `src/lib/excel/import.ts` — 엑셀 파싱(순수, 2차원 배열 입력). `apply.ts`가 DB 반영(시트 단위 all-or-nothing, 자연키 upsert: 품목코드/거래처코드/수주번호+행번호).
- CAPA 단위는 pcs/주. 이기종 혼류 왜곡은 알려진 한계(품목군별 라인 분리 운영 전제).
- 순수 로직(week/planning/bom/excel 파싱)에는 반드시 Vitest 테스트를 함께 둔다. DB 통합 테스트는 두지 않고 action을 얇게 유지한다.
- 인증 없음(MVP). 추가 시 `src/middleware.ts` 단일 지점에서 전 경로 보호.

## 2차 확장 예정 (스키마는 이미 호환)
- MRP: `BomLine` + `PlanEntry` 읽기로 자재소요 전개
- 재고: `InventoryTx` 모델 신설 / 실적: `ProductionResult` 모델 신설
- `PlanEntry.orderLineId`가 nullable인 것은 재고보충/예측생산(MTS) 대비

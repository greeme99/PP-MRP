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

- `src/lib/mrp.ts` — MRP 총소요량 전개(순수 함수). 리드타임 오프셋 없음(소요 주차 = 생산 주차). 화면 `/mrp`, export `/api/export/mrp`.
- `src/lib/inventory.ts` — 재고/순소요(순수 함수). `InventoryTx.qty`는 부호 있는 증감량(현재고 = 합산), 실사는 절대수량→델타 ADJUST로 기록. `/mrp` 기본 뷰는 **순소요**(재고를 첫 주부터 순차 소진·이월, `netRequirements`), `view=gross`로 총소요 전환. 재고 입력: `/inventory` 화면 + 엑셀 "재고" 시트(실사 이관). 실적↔재고 자동 연동(백플러시)은 의도적으로 없음 — BOM 정확도 검증 후 도입 검토.
- `src/lib/daily.ts` — 일별계획(순수 함수). 분할 정책: **납기 우선 + 일일 CAPA 순차 채움** — 같은 라인×주의 행을 납기순으로 월요일부터 `ProductionLine.dailyCapacity` 잔여량(기존 분할·수동 입력 부하 차감)만큼 채우고, 주 전체 CAPA 초과분은 금요일에 몰아 배치(빨간 부하 표시로 사람이 조정). CAPA 미설정 라인은 균등 분할 fallback. 일별 계획이 있는 엔트리는 불변(멱등). `DailyPlanEntry`는 PlanEntry에 종속(cascade), 주말은 초안 제외·수동 입력 가능. 화면 `/daily`.

- `src/lib/results.ts` — 생산실적. `ProductionResult`는 계획과 독립 보존(수주라인 삭제 시 SetNull, 계획 삭제와 무관). 입력은 `/daily`의 실적·불량 서브행, 주별 롤업은 `/mps` 실적 행. 미달 잔량은 "잔량 이월" 버튼으로만 다음 주 이동(자동 이월 없음). export `/api/export/results`, 작업지시서 `/api/export/daily`.
- `/` 대시보드 — 이번 주 계획대비실적, 미계획 수주, CAPA 초과(12주), 납기 임박(7일).
- `/mdm/*` — 기준정보(MDM): Item(발주속성: MOQ/리드타임/Rounding/발주패턴 PO·DO·JIT·KANBAN/기본 공급사) / Vendor / Customer(Partner를 type으로 분리 표시, BOTH는 양쪽 노출) / Site / Facility / Line Master. 계층: Site > Line > Facility. 구 경로 `/items` `/partners` `/lines`는 리다이렉트. 마스터 삭제는 참조 존재 시 거부(사용중지 안내). Item 발주속성은 아직 화면 관리 전용 — MRP 발주 계산·엑셀 시트 반영은 후속.
- UI 관례: 서브행 렌더링 시 `<Fragment key=...>` 사용(React key 경고 방지), `window.alert` 금지(MEMORY.md 참고).

## 2차 확장 예정 (스키마는 이미 호환)
- 재고: `InventoryTx` 모델 신설 → MRP 순소요(net requirement) 확장, 실적 기반 생산입고 연계
- `PlanEntry.orderLineId`가 nullable인 것은 재고보충/예측생산(MTS) 대비
- 인증/입력자 기록: 실적 입력 정착 시 `src/middleware.ts` + 입력자 필드 도입 검토

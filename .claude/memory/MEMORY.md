# MEMORY.md — Prod.Plan 프로젝트 메모리

이 프로젝트에서만 유효한 사실(아키텍처 결정, 환경 특이사항, 얻은 교훈)을 담는다.
워크스페이스 공통 사실은 전역 `Documents\Claude\memory\MEMORY.md`에 남긴다.

- 용량 목표: 약 2,000자 이내.
- 새 항목은 `pending\`에 초안을 먼저 남기고 승인받은 뒤 반영한다 (`grow` 스킬 참고).

---

## 의존성 결정 (2026-07-14)
- **Prisma는 6.x로 의도적 고정.** 7.x는 driver adapter(`@prisma/adapter-better-sqlite3`)와
  `prisma.config.ts`가 필수라 SQLite 단일 파일 MVP에 과함. 업그레이드 시 어댑터 도입까지 함께 계획할 것.
- **엑셀은 exceljs 사용.** SheetJS(`xlsx`) npm 패키지는 0.18.5 이후 npm 배포 중단(공식 배포는 자체 CDN)으로
  구버전 CVE가 남아 배제. CAPA 초과 셀 빨간 배경 등 셀 스타일도 exceljs 기능에 의존.

## UI 패턴 (2026-07-14)
- **`window.alert` 금지.** Claude 브라우저 패널을 멈추게 해 자동 E2E 검증이 불가능해진다.
  액션 결과는 `ActionButton`/`ActionForm`(src/components/action-form.tsx)의 인라인 메시지 패턴 사용.
  `window.confirm`(파괴적 작업 확인)만 예외 허용.

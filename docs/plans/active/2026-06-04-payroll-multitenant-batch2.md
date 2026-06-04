# 급여 멀티테넌트 완결 (batch 2) — cross-tenant 누출 잔여 가드

> 2026-06-04 (S262). 선행: #129(파괴적 5개) 머지됨. 본 PR = **급여 subsystem 멀티테넌트 완전 격리**.
> 출처: remediation 트리아지 + **전 payroll 라우트 grep/read 재검증**(문서 undercount 발견 → [[phase3a-audit-drift]] 양방향).

## 검증 방법 (착수 전 필수)

전 `src/app/api/v1/payroll/**/route.ts` 51개 핸들러를 스캔 → `find by id + forbidden/companyId 스코프 없음` 시그니처로 1차 트리아지 → **where절 정독으로 오탐 제거**. 거친 grep이 ~20개를 의심했으나 대부분 `where: { id, companyId: user.companyId }` 또는 `companyFilter = SUPER ? {} : { companyId }`로 **이미 스코프됨**(comparison·export 4종·notify-unread·publish-status·runs/[id]/{paid,review,route,items,calculate}·pay-items·allowance/deduction-types·payslips·me·runs). 진짜 누출만 아래.

## 확정 누출 (11 파일, 12 지점) — 전부 #129 패턴 재사용

### A. 파괴적 RC-C (cross-tenant 쓰기/삭제) — fetch 후 status 체크 前 소유권 가드

가드: `if (user.role !== ROLE.SUPER_ADMIN && X.companyId !== user.companyId) throw forbidden('다른 법인의 급여 …에 접근할 수 없습니다.')`

1. `[runId]/anomalies/[anomalyId]/resolve` PUT — `anomaly.payrollRun.companyId`, runId-match(L31) 뒤
2. `[runId]/anomalies/bulk-resolve` POST — `run.companyId`, notFound(L37) 뒤
3. `whitelist/[anomalyId]` DELETE — `anomaly.payrollRun.companyId`, notFound(L22) 뒤
4. `[runId]/adjustments/[adjustmentId]` DELETE — `adjustment.payrollRun.companyId`, runId-match(L23) 뒤
5. `[runId]/adjustments` POST — `run.companyId`, notFound(L71) 뒤 (타법인 조정 생성 차단)

### B. 읽기 RC-A/B (노출) — 스코프 강제

6. `[runId]/adjustments` GET — `_user`→`user`, `run.companyId` 가드 (A5와 동일 파일)
7. `[runId]/anomalies` GET — `_user`→`user`, `run.companyId` 가드
8. `attendance-status` GET — `_user`→`user`, raw param → `resolveCompanyId(user, parsed.data.companyId)` (api.md SSOT)
9. `import-mappings` GET — `user` 추가, `resolveCompanyId`; **POST** — `user` 추가, `data.companyId` 소유권 가드(#119 패턴, 타법인 매핑 생성 차단)
10. `dashboard` GET — `_user`→`user`, `company.findMany` where에 `...(role!==SUPER ? { id: user.companyId } : {})` (비-SUPER=본인 법인 1행, SUPER=전체)

### C. 역할 게이트 (설계 판단 — Codex/CEO 확인 요)

11. `global` GET — `user` 추가, 최상단 `if (user.role !== ROLE.SUPER_ADMIN) throw forbidden()`.
    - **근거**: 전 법인 KRW 집계(holding 뷰). 현재 rbac-spec `/payroll`→`HR_UP`라 **단일법인 HR도 도달 → 전 법인 gross/net 노출**(사람검증된 P0). 데이터-스코핑은 companies·payrollRuns·**trend(L99 companyId 필터 없음)**·headcount 4쿼리를 다 고쳐야 하고 누락 시 계속 누출 → **역할게이트 1줄이 fail-safe**.
    - **Tradeoff**: HR의 "글로벌 급여" 버튼(`PayrollClient.tsx:241`)·nav(`navigation.ts:585`, **동결**)이 403. 페이지는 error 상태로 graceful. nav/버튼 가시성 정리 = 별 follow-up(동결 파일 리뷰). dogfood서 한지영이 403 보는 점 = 의도된 보안(HR는 본인 법인 dashboard로 충분).
12. `severance/[employeeId]` POST — `_user`→`user`, `calculateSeverance` 前 employee를 `assignments.some.companyId` 스코프로 findFirst → 없으면 notFound (타법인 직원 퇴직금 계산 차단). 유일하게 쿼리 1개 추가(나머지는 가드 1줄).

## 제외 (별 트랙)

- `simulation/scenarios` GET/POST — 사용자 소유 샌드박스(`createdById`), companyId nullable → 다른 ownership 모델. **별 P1**(라이브 급여 아님).
- nav/버튼 가시성(`global` 비-SUPER 숨김) — 동결 `navigation.ts` 리뷰 필요. 별 UI follow-up.

## 패턴·규칙 준수

- `ROLE.SUPER_ADMIN` 상수(문자열 금지, #119/#129 선례) · `forbidden()` AppError 팩토리(한국어) · `resolveCompanyId` SSOT(api.md) · 가드는 status/domestic 체크보다 **앞**(소유권 우선).
- SUPER_ADMIN carve-out 전 가드 유지(전 법인 합법 접근 회귀 방지).

## 테스트 (e2e/api/payroll-cross-tenant.spec.ts 확장)

기존 6 케이스(CTR-CN HR→CTR run 403 ×4 + attendance-close 스코프 + SUPER carve-out)에 추가:
- 파괴적 5종(anomaly resolve/bulk-resolve, whitelist DELETE, adjustment DELETE/POST): CTR-CN HR→CTR = 403
- 읽기: anomalies/adjustments GET, attendance-status, import-mappings = 본인 법인만(타법인 403 또는 스코프 강제)
- `global`: HR_ADMIN → 403, SUPER → 200
- `severance`: CTR-CN HR → CTR 직원 = 404/403
- SUPER carve-out: 신규 라우트도 403 아님
- p12-fixtures에 신규 라우트 헬퍼 추가

## Codex Gate 1 반영 (S262)

- **P1 dashboard `prevRuns`(L154)**: `company.findMany`만 스코프하면 전월 MoM(`prevRuns`)이 전 법인 집계로 남음 → **`prevRuns.where`에도 `...(role!==SUPER ? { companyId: user.companyId } : {})`** 추가.
- **P1 `import-logs` POST(L53) — 12번째 파일 추가**: body `companyId`+`uploadedById` 신뢰 → 타법인 로그 생성+사용자 spoof. 가드 `if (role!==SUPER && data.companyId!==user.companyId) forbidden` + `uploadedById: user.id` 강제. (GET은 이미 `resolveCompanyId` ✓)
- **P2 reads(adjustments GET·anomalies GET)**: fetch-후-forbidden → **`findFirst({ where: { id: runId, ...(role!==SUPER ? { companyId } : {}) } })` + notFound**(runId 존재 oracle 차단). `findUnique`→`findFirst` 전환. 파괴적 5종은 #129 일관성으로 forbidden 유지.
- **`global` SUPER-only = Codex 동의**(부분 scope는 trend 등 누락 위험). 버튼/nav 가시성 = 별 UI follow-up(동결).
- 별도 인지: 기존 scoped 라우트(comparison/export)는 SUPER carve-out이 없어 SUPER도 본인 법인 한정 — over-restriction(누출 아님), 본 PR 범위 밖.

→ 최종 **12 파일**. dashboard는 2곳(companies + prevRuns) 스코프.

## Codex Gate 2 반영 (구현 후)

- **P1 `import-logs` mappingId 소유권**: companyId만 가드돼 타법인 `mappingId` 참조로 `include:{mapping}` 메타 누출 가능 → `findFirst({ id: mappingId, companyId })` 검증 추가(없으면 badRequest).
- **P2 가드 순서**(adjustment DELETE·anomaly resolve): ownership 가드를 `runId-match` badRequest **앞**으로 이동(타 법인 항목 존재 oracle 차단, ownership-first).
- CLEAN 확인: dashboard 2곳 스코프·severance active-primary 스코프·global top-gate·import-mappings·unused import 0·findFirst 전환.
- simulation/scenarios는 별 P1(샌드박스) 제외 유지.

## 검증 게이트

tsc 0 · lint 0 · unit(기존 회귀) · e2e(실 dev 서버) · **Codex Gate 1(본 플랜)+Gate 2(구현 후)**.

## 영향

11 route 파일(가드 1줄×10 + severance 쿼리1) + e2e spec + p12-fixtures. UI·i18n·schema·migration 무변경. 순수 add-guard(기존 동작은 본인 법인서 불변, cross-tenant만 차단).

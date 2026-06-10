# Attendance + Org-change dogfood fixes (S275)

> Created 2026-06-10 (S275). Source = live dogfood (hr@/employee-a@/employee-b@/manager@/super@) + 2-auditor adversarially-verified N1 audit (16 confirmed P0/P1).
> Status: **✅ IMPLEMENTED (S275)** — Codex Gate 1: r1 NO-GO(7) → r2 NO-GO(HIGH 2: entity-transfer 구법인 FK 승계 차단, 근태 이력 companyId 스코프 — 반영) → **r3 GO**. + 라이브 추가 발견 1건 동시 픽스: executor 감사로그가 schema에 없는 `bulk_movement_executions` 테이블에 raw INSERT → 42P01 커밋 후 실패로 성공 실행을 "전체 롤백" 오류로 둔갑(bm-03 승격) → 라우트 `logAudit()` 대체.
> 검증: tsc 0 · eslint 0(기존 경고 2) · unit 794/794 · **라이브 재실증 전 항목**: bulk-movements UI 3단계 완주("일괄 처리 완료 1건") + append-only(RANDD→DEV→RANDD 3행, 마감 보존) + audit_logs 기록 · 보정 다이얼로그 prefill(09:00/20:00)·시간수정 저장 200(total 570/OT 30 재계산) · anomaly 이름/사번/라벨 표시 · admin date=2026-06-10 · EMPLOYEE 가드 5종 403 + self 200 + MANAGER team 200 · rs-01 타법인 부서 400 + 타법인 직원 무변경(王伟 발령 보존).
> Codex Gate 1 round 1 findings (ALL incorporated):
> 1. (P0) bm-02: preview+raw join insufficient — executor needs canonical English fields w/ resolved FK ids → `validateRows` now builds server-only `validatedRows` (ValidateResult), validateByType resolves 부서/직급/직위/근무지/법인 codes **company-scoped** (was unscoped = cross-tenant code acceptance) and emits canonical `data`; validate route strips `validatedRows` from FE response (also fixes finding 6: no internal UUID exposure).
> 2. (P0) rs-01 scope widened: `requireDeptInCompany` guard on create.newDeptParentId / move.targetParentId / merge.source+target / close.closeDeptId / transfer_employee.toDeptId + `companyId: plan.companyId` on merge/close/transfer assignment lookups.
> 3. (P1) cache invalidation signature: `invalidateMultiple([ORG_TREE, SIDEBAR, DASHBOARD_KPI], plan.companyId)` per rules/performance.md.
> 4. (P1) att-01 time-clearing: API zod `.nullable().optional()`, null → clear time + reset totalMinutes/overtimeMinutes to null.
> 5. (P1) datetime-local: prefill via local components helper (`toDatetimeLocal`), never `toISOString().slice`; submit `new Date(v).toISOString()`. Company-TZ correction = att-07 follow-up.
> 6. (P2) see 1 — server-only type.
> 7. (P0) att-04/05 can't defer → **included**: deny-by-default guards — team GET denies EMPLOYEE; work-hour-alerts GET = HR/SUPER only; attendance/[id] PUT = HR/SUPER only; admin GET = HR/SUPER only; attendance/employees/[id] GET = self ∨ HR/SUPER ∨ same-dept MANAGER (team-route scope parity).
> Branch: `fix/s275-attendance-orgchange-dogfood` (off origin/main, post #140/#141 merge).

## Confirmed defects fixed in THIS PR (bounded, no policy decisions)

### Org-change

1. **bm-01 (P0)** Bulk-movements wizard dies at step 2 — FE doesn't unwrap the `apiSuccess` envelope.
   - [FileUploader.tsx:61](../../src/app/(dashboard)/hr/bulk-movements/components/FileUploader.tsx) `const result: ValidateResponse = await res.json()` → response is `{data: ValidateResponse}` → `result.valid` undefined → invalid branch → `ValidationPreview` crashes on `result.errors.filter` (live-reproduced: any VALID csv = full page error boundary).
   - Same class in [ExecutionConfirm.tsx:76](../../src/app/(dashboard)/hr/bulk-movements/components/ExecutionConfirm.tsx) (`data: ExecuteResponse = await res.json()`; also `body?.error` is an object — must use `body?.error?.message`).
   - Fix: unwrap `.data` in both; fix error-message extraction. (Multipart formData → raw fetch stays, per existing pattern.)

2. **bm-02 (P0)** Execute endpoint permanently fails for ALL roles — full rollback every time.
   - [execute/route.ts:78-84](../../src/app/api/v1/bulk-movements/execute/route.ts) maps rows with `employeeId: ''` ("executor re-validates" comment) but [executor.ts:334](../../src/lib/bulk-movement/executor.ts) does `findUnique({where: {id: row.employeeId}})` → `''` never matches → `[Row N] 직원을 찾을 수 없습니다` → rollback. Live-reproduced as SUPER_ADMIN.
   - Fix: server-side re-validation as SSOT — `ValidationRow += employeeId` (types.ts + validator preview push), execute route runs `validateRows(rows, template, userCompanyId, buffer)` after token check; if `!valid` → 400 with errors; else map `preview` → `ValidatedRow[]` (rowNum→raw data join). Defense-in-depth: token guarantees file integrity, re-validation guarantees data freshness.

3. **rs-01 (P0, cross-tenant)** Restructure apply `transfer_employee` has no tenant scope.
   - [apply/route.ts:226-264](../../src/app/api/v1/org/restructure-plans/[id]/apply/route.ts): `currentAssignment` lookup by employeeId only (no companyId), `toDeptId` not verified to belong to `plan.companyId` → crafted plan changes JSON can close+create ANY company's assignment (multitenant launch-blocker class, same family as #129~#138).
   - Fix: inside the case — (a) verify `department.findFirst({id: toDeptId, companyId: plan.companyId, deletedAt: null})` else `badRequest`; (b) add `companyId: plan.companyId` to currentAssignment where. Hardening: `merge` case `sourceEmployees` findMany also gets `companyId: plan.companyId`.

4. **rs-02 (P1)** ORG_TREE Redis cache not invalidated after apply (10-min stale org chart).
   - Fix: after tx commit, `invalidateCache(CACHE_STRATEGY.ORG_TREE)` ([cache.ts:43](../../src/lib/cache.ts)).

### Attendance

5. **att-01 (P0)** Manual-correction dialog can never change times — always 400, silently.
   - FE sends datetime-local `YYYY-MM-DDTHH:mm` (or `null` for empty) but [attendance/[id]/route.ts:21-22](../../src/app/api/v1/attendance/[id]/route.ts) `z.string().datetime().optional()` rejects both; prefill is ISO-Z which datetime-local can't display (always blank); empty catch swallows the 400. Live-reproduced.
   - Fix (FE-only, API stays strict): prefill ISO→datetime-local conversion (local time slice); on submit convert datetime-local→`new Date(v).toISOString()`; empty value → omit field (NOT null); destructive toast on failure (rules/error-handling.md).

6. **A2 (P1)** Anomaly table shows `—` for name/employeeNo; dialog title empty.
   - API returns FLAT `employeeName`/`employeeNo` ([admin/route.ts:82-83](../../src/app/api/v1/attendance/admin/route.ts)); FE reads nested `row.employee?.name` ([AttendanceAdminClient.tsx:224,229,373](../../src/app/(dashboard)/attendance/admin/AttendanceAdminClient.tsx)). Same flat↔nested DTO class as S272 offboarding crash.
   - Fix: align FE interface + renders to flat fields.

7. **att-03 (P1, partial)** Silent failures: AttendanceAdminClient empty `catch {}` ×3 (fetchData/resolveAlert/submit) + AttendanceClient clock-in/out catch without toast.
   - Fix: destructive toasts per rules/error-handling.md (load 실패/저장 실패/해제 실패/출근 실패/퇴근 실패). Optimistic rollback stays.

8. **att-06 (P1) + A4** admin/team routes compute "today" via server-local midnight (`new Date(); setHours(0,0,0,0)`) → on UTC deployment (Vercel prod) KST 00:00–09:00 shows yesterday; also `toISOString().slice(0,10)` labels the date as UTC (live: returned `date: 2026-06-09` while aggregating 06-10 KST).
   - Fix: use `getStartOfDayTz(now, 'Asia/Seoul')` ([timezone.ts:42](../../src/lib/timezone.ts)) for the day window in [admin/route.ts:27-35](../../src/app/api/v1/attendance/admin/route.ts) and [team/route.ts:35-38](../../src/app/api/v1/attendance/team/route.ts); label via `formatToTz`. KST-fixed matches clock-in storage semantics today; per-company timezone = att-07, separate track.

9. **att-12 (P2, trivial)** After clock-in/out only today/weekly refetch — monthly heat grid/stats stale until reload (live-reproduced: 근무일 3→4 only after reload).
   - Fix: include `fetchMonthly()` in both success paths ([AttendanceClient.tsx:279,296](../../src/app/(dashboard)/attendance/AttendanceClient.tsx)).

10. **A6 (P2, trivial)** Raw enum `NORMAL` shown in admin + team workType columns (self view localizes).
    - Fix: label map via existing i18n keys (`t('normal')` etc.) in [AttendanceAdminClient.tsx:250-253](../../src/app/(dashboard)/attendance/admin/AttendanceAdminClient.tsx) and [AttendanceTeamClient.tsx:130-132](../../src/app/(dashboard)/attendance/team/AttendanceTeamClient.tsx).

## Explicitly OUT of scope (separate tracks / CEO policy gates)

- **att-09 + (dogfood A3)**: LATE/EARLY_OUT/night/holiday judgment engine — clock-in hardcodes `status:'NORMAL'`, workTypeEngine has 0 importers → anomaly pipeline never fires in live ops. Needs policy source (per-company start time/shift). CEO gate.
- **O3**: bulk-movements execute role deadlock — page is HR-only ([page.tsx:18](../../src/app/(dashboard)/hr/bulk-movements/page.tsx)) but personnel_order flow=[ceo] → only SUPER can complete. Executor-must-be-approver conflates execution with approval. CEO gate (allow hr_admin vs real approval flow like payroll #126/#128).
- **tr-01**: `/employees/[id]/transfer` in-place `updateMany` (append-only violation) + zero UI callers. CEO gate (delete vs convert).
- **att-02**: MANAGER/EXECUTIVE `attendance_create` permission seed missing (clock-in button visible but 403). seed.ts is gated file — separate PR.
- **att-04/05/13**: attendance read fail-open (EMPLOYEE sees team/52h/any history) + MANAGER company-wide correction + team scope = department-not-reportsTo. RBAC scope design — separate track.
- **att-08**: 52h alert sums raw minutes incl. break (false legal alarms) — formula needs legal review with #135 SSOT helper.
- **ed-01**: employee detail edit silently no-ops dept/grade/status (PUT strips, returns 200). Product decision.
- **rs-03** (future effectiveDate applies immediately), **rs-04** (plan drafts dead-end, Org Studio schema mismatch), **att-07** (KST hardcode vs company tz), **att-10/11/14**, **bm-03**, **or-01**, **ui-02** (P2s).

## Verification plan

- tsc 0 · eslint 0.
- Live dev re-dogfood: ① CSV transfer 강성민 RANDD→DEV (super@) — validate 200, execute 200, assignment append-only(old endDate=effectiveDate, new row DEV), org tree fresh after apply. ② hr@ admin: anomaly row shows 정다은/사번, dialog prefills 09:00/20:00 local, time edit saves 200, KPI updates. ③ employee-a@ clock-in/out → monthly stats update without reload. ④ restructure apply transfer_employee with cross-company employeeId → 400 (e2e or curl).
- e2e: targeted specs for bulk-movements execute path + attendance correction PUT (existing suites: attendance-monthly-stats, restructure-wizard regression).

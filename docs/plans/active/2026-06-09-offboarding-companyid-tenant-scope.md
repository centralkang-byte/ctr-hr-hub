# Offboarding `companyId` tenant-scope — completed-offboarding visibility fix

> Created 2026-06-09 (S272 dogfood). Status: **PLANNED (Gate 1 NO-GO incorporated, re-review before impl)**.
> Found via live HR_ADMIN dogfood. Separated from the shipped quick-wins (#1 detail crash, #3 settlement annual-only) per CEO decision.

## Problem (confirmed live)
`EmployeeOffboarding` has no `companyId`. All offboarding routes tenant-scope via the employee's **active** primary assignment:
`employee: { assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } } }`.
On completion `complete-offboarding.ts` sets the primary assignment `endDate = lastWorkingDate` (PR #114). The `some({endDate:null})` then no longer matches, so **after completion**:
- `GET /offboarding/instances/[id]` → 404 (detail unopenable)
- `GET /offboarding/dashboard?status=COMPLETED` → 0 rows ("완료" tab empty)
- `POST .../complete` re-call → 404

HR permanently loses visibility of completed offboardings. Confirmed: completed 김현우 → detail 404 + completed tab 0.

## Decision: ownership = `OffboardingChecklist.companyId` (start-time, stable)
Offboarding is permanently owned by the company **at start time**. `OffboardingChecklist.companyId` is NOT NULL and already chosen at start → use it as the SSOT (NOT the employee's latest assignment, which changes on transfer = cross-tenant exposure, Gate 1 P0).

## Plan (incorporates Codex Gate 1 findings)
1. **Schema**: `EmployeeOffboarding += companyId String? @map("company_id")` + `company Company? @relation(...)` + `@@index([companyId])`; `Company += employeeOffboardings EmployeeOffboarding[]`. (nullable as an intermediate deploy step only.)
2. **Migration (NOT `db push --accept-data-loss`)** — explicit reviewed SQL on the shared DB:
   a. `ALTER TABLE employee_offboarding ADD COLUMN company_id text;`
   b. `CREATE INDEX CONCURRENTLY` for company_id (avoid table lock).
   c. Backfill: `company_id = offboarding.checklist.companyId`. Validate: `NULL count = 0` AND no checklist/employee-company mismatch before proceeding. Abort + manual-map on any anomaly (do not auto-guess).
   d. Add FK constraint, then `ALTER COLUMN company_id SET NOT NULL` once backfill verified.
3. **Creation paths** — set `companyId` (from chosen checklist's companyId) on ALL:
   - `src/app/api/v1/employees/[id]/offboarding/start/route.ts`
   - `src/lib/bulk-movement/executor.ts`
   - `prisma/seed-dev.ts:1243` (Gate 1: was missed)
   - `prisma/seeds/07-lifecycle.ts` (**2** create calls — Gate 1: not 1)
   - `prisma/seeds/22-offboarding-instances.ts` (3 create calls)
4. **Scoping → direct `companyId`** (non-SUPER `where.companyId = user.companyId`; SUPER unchanged) in:
   - dashboard, instances, instances/[id], instances/[id]/documents, instances/[id]/complete, instances/[id]/reschedule, [id]/cancel, [id]/exit-interview, [id]/exit-interview/ai-summary, employees/[id]/offboarding
   - **+ `instances/[id]/tasks/[taskId]/status` (Gate 1 P0 — currently FAIL-OPEN: passes when taskCompanyId missing). Scope via parent `employeeOffboarding.companyId`.**
5. **Audit other consumers** still using the assignment-join (switch to companyId or confirm fine):
   - `src/app/api/v1/home/summary/route.ts:431`
   - `src/app/api/v1/unified-tasks/route.ts:482`
   - `exit-interview-pending` + `offboarding-overdue` nudge rules
   - dashboard exit-interview statistics scope
   - (`/offboarding/me` is employeeId-scoped → no change)
6. **Tests** (Gate 1 P1): A/B company HR isolation, post-completion visibility, transferred-employee origin-company ownership, NULL/no-assignment legacy rows, SUPER_ADMIN, task mutation. + e2e + re-run Codex Gate 1 on this revised plan, then Gate 2.

## Why deferred
Multi-tenant scoping was hardened across PRs #133/#137; rushing this at the tail of a long session risks reintroducing leaks. Dedicated PR with full rigor.

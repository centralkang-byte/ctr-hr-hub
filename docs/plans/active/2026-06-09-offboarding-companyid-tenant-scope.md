# Offboarding `companyId` tenant-scope — visibility + fail-open + settlement-zero fix

> Created 2026-06-09 (S272 dogfood). **Rev 4 (S273, 2026-06-10): Codex Gate 1 rounds 2–4 (NO-GO) incorporated → round 5 GO; scope = INTEGRATED (settlement bug included) per CEO decision; r4 P0 → settlement=ownership invariant (divergence fail-closed).**
> Status: **✅ IMPLEMENTED (S273)** — DB Phase 1 applied+backfilled (5 rows, 0 anomaly), tsc 0 · lint 0 · unit 794 · e2e 6 new + 58 regression, live dogfood: completed-visibility 200 · CN 404 · P0 task PUT 404 · invariant 409 · settlement SEVERANCE 19,308,548원(=estimate baseline)·FINAL_SALARY 355,556원. Codex Gate 2 P1×2 fixed (idempotent SQL + DO guards, re-run proven), P2 MV = re-apply track (SQL pre-corrected). Phase 2 (SET NOT NULL + Prisma String) = post-deploy follow-up.
> Branch: stacked on `chore/s271-leave-dogfood` (PR #140 touches the same `complete-offboarding.ts`; base auto-retargets to main when #140 merges).

## Problems (all confirmed against code)
`EmployeeOffboarding` has no `companyId`. Every offboarding route tenant-scopes via the employee's **active** primary assignment:
`employee: { assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } } }`.
On completion `complete-offboarding.ts` sets that assignment `endDate = lastWorkingDate` (PR #114). `some({endDate:null})` then matches nothing → four live failures:

1. **P1 — completed-offboarding invisibility**: after completion `GET instances/[id]` → 404, `dashboard?status=COMPLETED` → 0 rows, re-`complete` → 404. HR permanently loses completed offboardings. (Live: completed 김현우.)
2. **P0 — task-status FAIL-OPEN** ([instances/[id]/tasks/[taskId]/status/route.ts:36-65](../../../src/app/api/v1/offboarding/instances/[id]/tasks/[taskId]/status/route.ts)): `findFirst` has NO companyId in WHERE; post-check `if (role!==SUPER && taskCompanyId && taskCompanyId!==user.companyId)` short-circuits on falsy `taskCompanyId` → **any company's HR can mutate the task**.
3. **P1 — settlement FINAL_SALARY = 0** ([complete-offboarding.ts:227-295](../../../src/lib/offboarding/complete-offboarding.ts)): step 5 closes the active assignment in-tx; line 244 re-reads `{isPrimary, endDate:null}` (now empty) → `compId=''` → `compensationHistory.findFirst({companyId:''})` → 0 rows → proRataSalary=0.
4. **P1 — settlement SEVERANCE = 0** (Codex r3; [severance.ts:29-58](../../../src/lib/payroll/severance.ts)): `calculateSeverance()` does its own `{isPrimary, endDate:null}` lookup → same collapse → `companyId=''` → payroll/comp/attendance queries empty → severance 0. **Every completed offboarding mis-settles both money lines.**

## Ownership model (two distinct companyIds — Codex r3)
- **Ownership** (tenant visibility/scoping) = company at **offboarding start** = employee's primary assignment effective at `started_at` (temporal, stable across later transfers). NOT latest assignment (transfer = cross-tenant exposure). NOT blindly `checklist.companyId` (seeds/flows can pick a cross-company checklist — `22-offboarding-instances.ts:75` has no company filter; checklist is a cross-check only).
- **Settlement** (who pays) = primary assignment effective at **`lastWorkingDate`**, resolved **inside the completion tx BEFORE closing assignments**; fallback `offboarding.companyId` if none. Passed explicitly to both money calculations.

## Plan

### A. Schema (gate file — migration plan attached)
`EmployeeOffboarding += companyId String? @map("company_id")` + `company Company? @relation` + `@@index([companyId])`; `Company += employeeOffboardings EmployeeOffboarding[]`. **Stays nullable in Prisma** until backfill verified (D). Precedent: sibling `AssetReturn` already has `companyId`.

### B. Creation paths — set `companyId` = employee's start-time primary-assignment companyId
All 5 verified create sites (checklist tightened to same-company where applicable):
- `employees/[id]/offboarding/start/route.ts:196` (in-tx, assignment already loaded)
- `lib/bulk-movement/executor.ts:241`
- `prisma/seed-dev.ts:1243` · `prisma/seeds/07-lifecycle.ts` (2 calls) · `prisma/seeds/22-offboarding-instances.ts` (3 calls — `empCompanyId` already computed at :116; prefer same-company checklist)

### C. Deploy sequence (expand/contract — Codex r2 P0)
Single dev env, prod disposable ([[hrhub-prod-db-disposable-prelaunch]]), but ordering invariant kept:
1. **Expand**: nullable column + FK + index (reviewed SQL); creation-path writers deployed first.
2. **Backfill** (D) + validate.
3. **Contract**: switch readers (E/F), drop fail-open post-check, `SET NOT NULL`.
Readers never switch before backfill (else legacy NULL rows 404). `CREATE INDEX CONCURRENTLY` outside tx.

### D. Migration / backfill — explicit reviewed SQL (NOT `db push --accept-data-loss`; [[hrhub-migrations-no-zero-apply]])
`effective_date`/`end_date` are `@db.Date`, `started_at` is timestamptz → **cast `eo.started_at::date`** (Codex r3):
```sql
ALTER TABLE employee_offboarding ADD COLUMN company_id text;
CREATE INDEX CONCURRENTLY ix_employee_offboarding_company_id ON employee_offboarding(company_id);
-- temporal backfill: primary assignment effective at started_at (same LATERAL shape as mv_analytics.sql:266)
UPDATE employee_offboarding eo SET company_id = la.company_id
FROM LATERAL (
  SELECT a.company_id, count(*) OVER () AS n
  FROM employee_assignments a
  WHERE a.employee_id = eo.employee_id AND a.is_primary
    AND a.effective_date <= eo.started_at::date
    AND (a.end_date IS NULL OR a.end_date >= eo.started_at::date)
  ORDER BY a.effective_date DESC LIMIT 1
) la
WHERE eo.company_id IS NULL;
```
**Validate before FK/NOT NULL — ABORT + manual-map on any hit (no auto-guess):**
- NULL count = 0 (no temporal assignment → manual).
- **Ambiguity check (Codex r3): rows where 2+ primary assignments overlap `started_at::date` → anomaly, manual.** (Separate `SELECT ... HAVING count(*) > 1` probe, not silently latest-wins.)
- Cross-check: rows where `company_id <> checklist.company_id` → inspect; mismatched checklist = fix `checklist_id`+`company_id` together.
Then FK + `SET NOT NULL` (after readers switched).

### E. Scoping → direct `companyId` (Codex r2 P1: SUPER handling)
- **ID routes (find/mutate)** — non-SUPER `where.companyId = user.companyId`; **SUPER: no company predicate** (NOT `resolveCompanyId`, which pins SUPER to own company): instances/[id] (+documents/complete/reschedule), **instances/[id]/tasks/[taskId]/status — the P0: companyId into findFirst WHERE → notFound; DELETE the fail-open `taskCompanyId &&` post-check**, [id]/cancel, [id]/exit-interview (+ai-summary), employees/[id]/offboarding.
- **List/aggregate** — `resolveCompanyFilter()` (#132 precedent): instances (list), dashboard, exit-interviews/statistics.
- Completed-detail display data: include offboarding-period assignment (not `endDate:null`) so company/department render after completion (Codex r3).

### F. Settlement-company fix (INTEGRATED scope — CEO decision; r4 P0 invariant added)
**Invariant (Codex r4): settlement company MUST equal ownership company.** In `complete-offboarding.ts`, **before** the `updateMany` that closes assignments, resolve in-tx:
`assignmentAtLwd` = primary assignment effective at `lastWorkingDate` (`effectiveDate <= lwd && (endDate == null || endDate >= lwd)`).
- If `assignmentAtLwd.companyId` exists AND ≠ `offboarding.companyId` → **`conflict()` for ALL roles (incl. SUPER)**: "오프보딩 시작 후 법인이 변경된 직원입니다 — 오프보딩을 취소하고 현재 법인에서 재시작해 주세요." (Blocks both the cross-tenant settlement-data exposure and the severance 3-month-window under-calculation; multi-company tenure aggregation = separate policy track.)
- Else `settlementCompanyId = offboarding.companyId` (single value; fallback identical when no assignment found). Then:
- Replace the line-244 post-tx re-read entirely (use captured `settlementCompanyId` + employee fields already at hand).
- FINAL_SALARY: `compensationHistory.findFirst({companyId: settlementCompanyId, ...})`.
- SEVERANCE: `calculateSeverance(empId, lwDate, settlementCompanyId)` — **new optional 3rd param `companyId?: string`**; inside, use it when provided, else keep the active-assignment lookup (exactly 2 callers verified: payroll estimate route for active employees stays on default path → zero behavior change there).
- Country/settlement company lookups + exit-interview creation `companyId` in this file → `settlementCompanyId`.

### G. Consumer audit off the assignment-join (Codex r2+r3 — verified list)
- `home/summary/route.ts` — **both** :431 and :624 (EXECUTIVE widget) queries → `companyId` ("Phase 6" comments already anticipate this).
- `unified-tasks/route.ts:482` — swap only the HR assignment-join branch; keep EMPLOYEE self / MANAGER team branches.
- nudge rules `offboarding-overdue.rule.ts` + `exit-interview-pending.rule.ts`.
- `scripts/db/sql/mv_analytics.sql:266` (relocated 2026-06-10, was `prisma/migrations/mv_analytics.sql`) — LATERAL latest-assignment → `eo.company_id` (MV re-apply = separate track; SQL corrected now).
- `recruitment/applicants/check-duplicate/route.ts:185-203` — already guarded via historical `assignments.some({companyId})` (Codex r3 P0 claim = false positive on verification), but tighten to direct `EmployeeOffboarding.companyId` (P2 hygiene; removes transferred-employee flag bleed).
- `lib/offboarding-complete.ts` `deactivateItAccount()` — verify at impl; employeeId-scope likely correct for IT accounts (cross-company identity), confirm and document.

### H. RLS policy SQL (Codex r4 accepted: fix now, applied post-launch)
`scripts/db/sql/rls_setup.sql:193` (relocated 2026-06-10, was `prisma/migrations/rls_setup/migration.sql`) `rls_hr_offboarding`: active-assignment subquery → `employee_offboarding.company_id = current_company_id()`, USING + WITH CHECK; re-check super/self policies. Currently unapplied + no offboarding route uses withRLS → zero live impact; prevents wrong re-apply later.

### I. NOT changed (verified safe)
`offboarding/[id]/tasks/[taskId]/complete` + `offboarding/me` (employeeId-scoped self-service); `offboarding/checklists/*` (already companyId-scoped); `payroll/severance/[employeeId]` route (active employees; #130-scoped).

### J. Tests / verify
A/B HR isolation; post-completion visibility (detail + COMPLETED tab + display fields); transferred-employee origin-company ownership; cross-tenant task mutation blocked (P0); **settlement FINAL_SALARY + SEVERANCE non-zero after completion** (P1 #3/#4 — assert against compensation fixture); NULL/legacy rows; SUPER unchanged. `tsc --noEmit` + lint + e2e real-dev dogfood (complete an offboarding end-to-end, check settlement amounts). Codex Gate 2 in /verify.

## Why this PR shape
Multi-tenant scoping hardened across #131–#138; this finishes the offboarding subsystem (last assignment-join holdout) AND fixes the settlement-zero money bug whose root cause is the same missing column. Stacked on #140 (same-file dependency), full Gate rigor.

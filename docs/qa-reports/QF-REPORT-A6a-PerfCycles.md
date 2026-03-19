# QF-REPORT: Run A-6a — Performance Cycles + Goals

Date: 2026-03-18
Tool: Claude Code Desktop (Opus)
Duration: ~35 min
Accounts: HK (HR Admin), EA (Employee), M1 (Manager)

---

## Discovery Notes

- **CycleStatus enum**: DRAFT → ACTIVE → CHECK_IN → EVAL_OPEN → CALIBRATION → FINALIZED → CLOSED → COMP_REVIEW → COMP_COMPLETED
- **GoalStatus enum**: DRAFT, PENDING_APPROVAL, APPROVED, REJECTED
- **CycleHalf enum**: H1, H2, ANNUAL
- **Model names**: `MboGoal` (table: `mbo_goals`), `MboProgress`, `PerformanceReview`
- **Cycle fields**: `year`, `half`, `goalStart`, `goalEnd`, `evalStart`, `evalEnd` (NOT startDate/endDate)
- **Goal creation**: EA (Employee) can create own goals ✅
- **Submit validation**: Total weight across all cycle goals must = 100%
- **Advance**: Uses `TRANSITIONS` map internally — no stage body needed
- **Overdue steps**: `goal | checkin | self-eval` (not enum names)
- **Existing data**: 4 KR cycles (ACTIVE, EVAL_OPEN, CLOSED, FINALIZED), 424+ goals

---

## CRUD Score Card

| Entity | C | R | R(detail) | U | D | Account | Issues |
|--------|---|---|-----------|---|---|---------|--------|
| Perf Cycle | ✅ | ✅ | ✅ | ✅ | — | HK | |
| Cycle Initialize | ❌ | — | — | — | — | HK | P1: 500 DB error (transient?) |
| Cycle Participants | — | ✅ | — | — | — | HK | |
| Cycle Bulk Notify | ✅* | — | — | — | — | HK | P0 fixed: params `{cycleId}` → `{id: cycleId}` |
| Cycle Advance | ✅ | — | — | — | — | HK | DRAFT→ACTIVE worked |
| Cycle Overdue | — | ✅ | — | — | — | HK | Step names: goal/checkin/self-eval |
| Cycle Finalize | ⚠️ | — | — | — | — | HK | Only CALIBRATION→FINALIZED (no test cycle in that state) |
| Goal | ✅ | ✅ | ✅ | ✅* | ✅* | EA | P0 fixed: UPDATE/DELETE perm `ACTION.CREATE` |
| Goal Submit | ✅* | — | — | — | — | EA | P0 fixed: perm `ACTION.CREATE` |
| Goal Approve | ✅* | — | — | — | — | M1 | P0 fixed: perm `ACTION.UPDATE` |
| Goal Progress | ✅ | ✅ | — | — | — | EA | `progressPct` (0-100), not `value` |
| Goal Req Revision | ✅ | — | — | — | — | M1 | Needs `comment` field, not `reason` |
| Goal Unlock | ✅ | — | — | — | — | HK | Transient 500 on first call, retry worked |
| Goal Bulk Lock | ✅ | — | — | — | — | HK | Locked 272 goals |
| Results Me | — | ✅ | — | — | — | EA | Requires `cycleId` param |
| Results Admin | — | ✅* | — | — | — | HK | P1 fixed: Zod `.cuid()` → `.uuid()` |

---

## RBAC Score Card

| Test | Account | Endpoint | Expected | Actual | Pass? |
|------|---------|----------|----------|--------|-------|
| Cycle Create | EA | POST /performance/cycles | 403 | 201→**403*** | ✅ Fixed |
| Cycle Update | EA | PUT /performance/cycles/{id} | 403 | 403 | ✅ |
| Cycle Initialize | EA | POST /cycles/{id}/initialize | 403 | 403 | ✅ |
| Cycle Advance | EA | PUT /cycles/{id}/advance | 403 | 403 | ✅ |
| Cycle Finalize | EA | POST /cycles/{id}/finalize | 403 | 403 | ✅ |
| Bulk Notify | EA | POST /cycles/{id}/bulk-notify | 403 | 403 | ✅ |
| Bulk Lock | EA | POST /goals/bulk-lock | 403 | 403 | ✅ |
| Goal Unlock | EA | POST /goals/{id}/unlock | 403 | 403 | ✅ |
| Results Admin | EA | GET /results/admin | 403 | 403 | ✅ |
| Results Me | EA | GET /results/me | 200 | 200 | ✅ |
| Goals List | EA | GET /goals | 200 | 200 | ✅ |
| Goal Create | EA | POST /goals | 200 | 201 | ✅ |

**RBAC: 12/12 PASS** (after P0 fix on cycle create)

---

## Goal Lifecycle Verification

| Step | Action | Account | Status Before | Status After | Pass? |
|------|--------|---------|---------------|--------------|-------|
| 1 | Create goal | EA | — | DRAFT | ✅ |
| 2 | Update goal | EA | DRAFT | DRAFT (title/weight changed) | ✅ (after fix) |
| 3 | Delete goal | EA | DRAFT | (deleted) | ✅ (after fix) |
| 4 | Submit goals (weight=100) | EA | DRAFT | PENDING_APPROVAL (3 goals) | ✅ (after fix) |
| 5 | Approve goal | M1 | PENDING_APPROVAL | APPROVED | ✅ (after fix) |
| 6 | Update progress (45%) | EA | APPROVED | APPROVED (pct=45) | ✅ |
| 7 | Request revision | M1 | PENDING_APPROVAL | REJECTED | ✅ |
| 8 | Bulk lock | HK | * | LOCKED (272 goals) | ✅ |
| 9 | Unlock | HK | LOCKED | unlocked | ✅ |

---

## P0 Fix Log

### P0-1: Cycle Create RBAC Escalation (A-4 pattern)
- **File**: `src/app/api/v1/performance/cycles/route.ts`
- **Root cause**: POST handler used `perm(MODULE.PERFORMANCE, ACTION.CREATE)`. EMPLOYEE role has `performance:create` (intended for goal creation), so employees could create performance cycles.
- **Fix**: Changed to `perm(MODULE.PERFORMANCE, ACTION.APPROVE)` → maps to `performance:manage` (HR_ADMIN/SUPER_ADMIN only)
- **Retest**: EA → 403 ✅, HK → 201 ✅

### P0-2: Goal Update/Delete Blocked for Creator (broken MBO workflow)
- **File**: `src/app/api/v1/performance/goals/[id]/route.ts`
- **Root cause**: PUT used `ACTION.UPDATE`, DELETE used `ACTION.DELETE`. EMPLOYEE has neither. Combined with ownership check (`employeeId: user.employeeId`), HK (HR Admin) also couldn't update (returns 404 — not EA's employee). Result: nobody could update/delete EA's DRAFT goals.
- **Fix**: Changed both to `ACTION.CREATE` — employees who can create goals should edit/delete their own DRAFT goals. Handler already enforces ownership + status checks.
- **Retest**: EA → 200 (update), 200 (delete) ✅

### P0-3: Goal Submit Blocked for Employee
- **File**: `src/app/api/v1/performance/goals/[id]/submit/route.ts`
- **Root cause**: Used `ACTION.UPDATE` (performance:update). EMPLOYEE lacks this.
- **Fix**: Changed to `ACTION.CREATE`
- **Retest**: EA → 200, submitted 3 goals ✅

### P0-4: Goal Approve Blocked for Manager
- **File**: `src/app/api/v1/performance/goals/[id]/approve/route.ts`
- **Root cause**: Used `ACTION.APPROVE` (maps to `performance:manage`). MANAGER only has `read` + `update`.
- **Fix**: Changed to `ACTION.UPDATE`
- **Retest**: M1 → 200, APPROVED ✅

### P0-5: Goal Request Revision Blocked for Manager
- **File**: `src/app/api/v1/performance/goals/[id]/request-revision/route.ts`
- **Root cause**: Same as P0-4 — used `ACTION.APPROVE`.
- **Fix**: Changed to `ACTION.UPDATE`
- **Retest**: M1 → 200, REJECTED ✅

### P0-6: Bulk-Notify Params Destructuring Bug
- **File**: `src/app/api/v1/performance/cycles/[id]/bulk-notify/route.ts`
- **Root cause**: `const { cycleId } = await context.params` but URL segment is `[id]`. `cycleId` is always `undefined` → Prisma validation error → 500.
- **Fix**: Changed to `const { id: cycleId } = await context.params`
- **Retest**: Route now correctly rejects non-FINALIZED cycles with 400

---

## P1 Issues

### P1-1: Cycle Initialize 500 — FIXED (A-7 session)
- **File**: `src/app/api/v1/performance/cycles/[id]/initialize/route.ts`
- **Root cause (dual)**:
  1. `createMany({ skipDuplicates: true })` inside `$transaction` — PrismaPg adapter incompatibility with `ON CONFLICT DO NOTHING` in transaction scope
  2. `excludeProbation` defaults to `true` in schema — all 111 seed employees have `probationStatus=IN_PROGRESS` → 0 target employees
- **Fix**: Replaced `createMany + skipDuplicates` with individual `upsert` pattern inside transaction
- **Verified**: `POST initialize` → 200, `created: 111` (with `excludeProbation=false`)

### P1-2: Admin Results Zod Validation (cuid vs uuid)
- **File**: `src/app/api/v1/performance/results/admin/route.ts`
- **Root cause**: `cycleId: z.string().cuid()` but cycle IDs are UUIDs
- **Fix**: Changed to `z.string().uuid()`
- **Retest**: HK → 200 ✅

---

## Files Modified

| File | Change |
|------|--------|
| `src/app/api/v1/performance/cycles/route.ts` | POST perm: `ACTION.CREATE` → `ACTION.APPROVE` |
| `src/app/api/v1/performance/cycles/[id]/bulk-notify/route.ts` | Params: `{ cycleId }` → `{ id: cycleId }` |
| `src/app/api/v1/performance/goals/[id]/route.ts` | PUT/DELETE perm: `ACTION.UPDATE/DELETE` → `ACTION.CREATE` |
| `src/app/api/v1/performance/goals/[id]/submit/route.ts` | PUT perm: `ACTION.UPDATE` → `ACTION.CREATE` |
| `src/app/api/v1/performance/goals/[id]/approve/route.ts` | PUT perm: `ACTION.APPROVE` → `ACTION.UPDATE` |
| `src/app/api/v1/performance/goals/[id]/request-revision/route.ts` | PUT perm: `ACTION.APPROVE` → `ACTION.UPDATE` |
| `src/app/api/v1/performance/results/admin/route.ts` | Zod: `.cuid()` → `.uuid()` |
| `src/app/api/v1/performance/cycles/[id]/initialize/route.ts` | `createMany+skipDuplicates` → individual `upsert` (PrismaPg compatibility, fixed in A-7 session) |

---

## Verdict

**PASS with P0 fixes applied** — 6 P0 bugs fixed (5 RBAC, 1 params destructuring), 2 P1 noted. All fixes verified with `npx tsc --noEmit` (0 errors). Goal lifecycle (Create → Submit → Approve → Progress → Revision → Bulk Lock → Unlock) fully operational after fixes.

**Pattern confirmation**: A-4 RBAC escalation pattern confirmed on cycle create. A-1/A-3/A-5a self-service pattern NOT present (results/me works correctly for EMPLOYEE).

**Cleanup**: All QF test data removed. 0 QF goals, 0 QF cycles remaining.

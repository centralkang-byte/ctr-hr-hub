# Payroll Step-2 EXECUTIVE Approval Activation (PR #2)

> 2026-06-04. Design spec. Track = Payroll P0 dogfood / Bucket D #10 (PR #2 of the 2-PR split).
> Predecessor: PR #126 (S257) delivered the real SoD core (ApprovalFlow migration + in-handler D2/D3/D4).
> This PR makes the **法人 대표 (EXECUTIVE)** the real step-2 approver — currently only SUPER_ADMIN
> can satisfy step 2 (dev/emergency override). Security-critical → own Codex Gate 1.

## Problem

After #126, the payroll 2-step approval enforces genuine separation of duties at the **handler**
layer, but the **EXECUTIVE** (法人 대표) — the intended real-world step-2 approver — cannot use it:

1. **Middleware blocks reach.** `findRouteRule` (`src/lib/rbac/rbac-spec.ts`) gates both the page
   prefix `/payroll` (:41) and the API prefix `/api/v1/payroll` (:88) to `HR_UP` =
   `[HR_ADMIN, SUPER_ADMIN]`. An EXECUTIVE is redirected/403'd **before** the handler SoD ever runs.
2. **The approval-status read requires `payroll:view`.** `approval-status/route.ts:98` uses
   `withPermission(PAYROLL, VIEW)`; EXECUTIVE has no payroll:view, so the approval screen can't load
   even if reach is opened.
3. **🔴 The next-approver notification is broken for step 2.** `notifyNextApprover()`
   (`approve/route.ts:213`) queries `employeeRoles.some.role.code === roleCode` where `roleCode` is
   the **abstract** step role `'ceo'` (:224). No employee has `role.code = 'ceo'` (real codes are
   `EXECUTIVE` / `SUPER_ADMIN`), so **no EXECUTIVE is ever notified** there is something to approve.
4. **🔴 A dead `runs/[id]/approve` PUT route is an SoD-bypass surface.** It checks only
   `withPermission(PAYROLL, ACTION.APPROVE)` (= payroll:manage) with **no SoD**. Confirmed
   unreferenced (no client/test call — the only live PUT under `runs/` is `runs/{id}/paid`).

### Already done (do NOT redo)
- Handler SoD: `approve/route.ts` and `reject/route.ts` are `withAuth` + in-handler
  `callerHoldsPayrollStepRole` + prior-approver block + cross-company block.
- Role mapping: `approval-step-roles.ts:18` already maps `ceo: ['SUPER_ADMIN', 'EXECUTIVE']`.
  → EXECUTIVE is already **eligible** to approve the ceo step; the core is forward-ready.

## Goals / Non-goals

**Goals**
- EXECUTIVE of a company can approve/reject **step 2** of that company's payroll run, end-to-end via UI.
- EXECUTIVE is **notified** when a run reaches step 2.
- Least privilege: EXECUTIVE gains **no** broad `payroll:view` / payroll-admin access — only the
  approval surface.
- Remove the dead SoD-bypass route.

**Non-goals (explicit)**
- Dedicated "결재 대기" approver queue (pull surface). Notification (push) + the existing approval
  page is the dogfood bar. → possible follow-up PR.
- ⑥-C MANAGER onboarding/offboarding enablement (separate deferred P1 track).
- Touching the seeded ApprovalFlow chain / step composition (already correct).

## Design

### Two-layer authorization (the governing principle)
- **Middleware = coarse *reachability*.** Decides only "may this role hit this path at all."
- **Handler = fine *authorization*.** Decides which **step** the caller may act on (SoD), same-person
  block, cross-company block. This already exists (#126) and is the real security boundary.

The middleware change therefore only opens **reach** to the approval surface for
`[HR_ADMIN, EXECUTIVE, SUPER_ADMIN]`; the handler still rejects an EXECUTIVE who tries to approve a
step-1 (`hr_admin`) row, an HR_ADMIN who tries step-2 (`ceo`), a same-person second stamp, or a
foreign-company run.

### Change set (~6 files)

**1. `src/lib/rbac/rbac-spec.ts` — carve-out (Approach A: isolated pattern rule)**
- Add a new role group: `PAYROLL_APPROVERS = ['HR_ADMIN', 'EXECUTIVE', 'SUPER_ADMIN']`
  (note: **not** `MANAGER_UP` — MANAGER must stay excluded from payroll approval).
- Add an exported, unit-testable helper:
  ```ts
  // Anchored, single dynamic segment — tight enough to never match payroll-admin routes.
  const PAYROLL_APPROVAL_PATTERNS = [
    /^\/payroll\/[^/]+\/approve$/,                              // page
    /^\/api\/v1\/payroll\/[^/]+\/(approve|reject|approval-status)$/, // APIs
  ]
  export function isPayrollApprovalPath(pathname: string): boolean { ... }
  ```
- `findRouteRule` stays prefix-only and **unchanged**; the pattern check is a separate, named
  function (keeps the generic ACL matcher contract intact).

**2. `src/middleware.ts` — apply the carve-out before the generic rule**
- Before `const rule = findRouteRule(pathname)` (:212), short-circuit:
  if `isPayrollApprovalPath(pathname)` → allow iff `userRole ∈ PAYROLL_APPROVERS`, else the existing
  403 (API) / redirect (page) path. This must run **before** the `/payroll`→HR_UP prefix rule so the
  specific carve-out wins.

**3. `src/app/api/v1/payroll/[runId]/approval-status/route.ts` — read without `payroll:view`, but re-authorized in handler**
- `withPermission(PAYROLL, ACTION.VIEW)` → `withAuth` (so EXECUTIVE, who lacks `payroll:view`, can pass
  the wrapper). Keep the existing company scope (`where: { id, companyId: user.companyId }`, :19).
- **⚠️ Handler-level authorization (Codex Gate 1 P1):** reach ≠ authorization. Middleware opens reach to
  all `PAYROLL_APPROVERS`, so `withAuth` + company-scope alone would let *any* same-company EXECUTIVE
  read any run's financial summary by guessing a `runId`. The handler must re-authorize: allow only
  `hasPermission(user, payroll:view)` holders (HR; SUPER bypasses) **or** an actual participant of this
  run's approval — current pending-step role holder (`callerHoldsPayrollStepRole`) or someone who
  already acted (`step.approverId === user.employeeId`). Pre-submit runs (`payrollApproval === null`)
  require `payroll:view`/SUPER. This mirrors the handler-authz principle already applied to
  approve/reject (the two-layer model below).
- **Fold the run summary** (`name`, `headcount`, `totalNet`, `totalGross`, `adjustmentCount`,
  `allAnomaliesResolved`, `notes` — all PayrollRun scalars, already loaded via `include`) into this
  response so EXECUTIVE never has to call `runs/{id}` (which is `payroll:view`).

**4. `src/app/api/v1/payroll/[runId]/approve/route.ts` — fix the notification**
- `notifyNextApprover(roleCode, …)` must resolve the **abstract** step role to **real** role codes
  before querying employees. Reuse the existing mapping in `approval-step-roles.ts`
  (extract a shared `resolvePayrollStepRoleCodes(roleRequired): string[]` so `callerHoldsPayrollStepRole`
  and `notifyNextApprover` share one source of truth). Query becomes
  `role: { code: { in: codes } }` instead of `role: { code: roleCode }`.

**5. `src/app/api/v1/payroll/runs/[id]/approve/route.ts` — DELETE**
- Dead + SoD-bypass. Confirmed unreferenced. Removing it eliminates a path that could approve a run
  with only `payroll:manage` and no separation-of-duties. (In-track dead-code cleanup per policy.)

**6. `src/app/(dashboard)/payroll/[runId]/approve/PayrollApproveClient.tsx` — single data source**
- Drop the `apiClient.get('/api/v1/payroll/runs/${runId}')` call (:145); render run summary from the
  extended `approval-status` response (#3). Keeps the page working for EXECUTIVE without payroll:view.

### Data flow (this PR's deltas in **bold**)
```
HR submits-for-approval  → PENDING_APPROVAL, steps created (hr_admin, ceo)
HR_ADMIN approves step 1 → step1 APPROVED, currentStep→2
                         → **notifyNextApprover('ceo') now resolves to [SUPER_ADMIN, EXECUTIVE]**
                         → **EXECUTIVE receives notification + deep link /payroll/{id}/approve**
EXECUTIVE opens page     → **middleware carve-out allows reach**
                         → **approval-status: withAuth + handler authz (EXEC is ceo-step participant) → steps + run summary**
EXECUTIVE approves step2 → handler SoD: ceo role ✓, not prior approver ✓, same company ✓
                         → last step → PayrollRun APPROVED → PAYROLL_APPROVED event → payslips (existing)
```

### Error handling
- All new/changed rejections use `AppError` factories with Korean messages (`forbidden(...)`),
  per `rules/error-handling.md`. No new English strings.
- Middleware carve-out denial reuses the existing 403 JSON (API) / home redirect (page) responses.
- Notification failure stays non-blocking (existing try/catch in `notifyNextApprover`).

### Security analysis
- **No over-open.** Anchored regexes match only `…/approve|reject|approval-status` on a single
  dynamic segment. Payroll-admin routes (calculate, adjustments, anomalies, exchange-rates,
  whitelist, import, runs CRUD, simulation, etc.) remain `HR_UP`.
- **MANAGER excluded** — `PAYROLL_APPROVERS` deliberately omits MANAGER/`MANAGER_UP`.
- **SoD intact** — middleware only grants reach; step-level authz + same-person + cross-company stay
  in the handler (#126). Dead bypass route removed (#5).
- **Reach ≠ authorization (Codex G1 P1)** — `approval-status` re-authorizes in the handler
  (`payroll:view`/SUPER **or** run participant), so a same-company EXECUTIVE who is not an approver of a
  given run cannot read its financials by guessing a `runId`. Middleware is never the sole gate for
  payroll data.
- **Least privilege** — EXECUTIVE gets approval reach only; no `payroll:view`, no run mutation, and
  read access only to runs where they are an approval participant.

## Test matrix (e2e, seeded accounts)
| Case | Actor | Expect |
|---|---|---|
| Step-2 approve | 강대표 `executive@ctr.co.kr` (EXEC/CTR) | 200, run APPROVED |
| Step-2 by HR | 한지영 `hr@ctr.co.kr` (HR_ADMIN) | 403 (`callerHoldsPayrollStepRole('ceo')` false) |
| MANAGER reach | 박준혁 `manager@ctr.co.kr` | 403 at middleware (page + API) |
| Cross-company | EXEC of another company on a CTR run | 403 (handler cross-company) |
| Same-person 2-stamp | actor who did step 1 | 403 (D4 prior-approver) |
| Notification delivery | after step 1 | 강대표 receives `payroll_approval_needed` |
| Admin route still locked | EXEC → `/api/v1/payroll/calculate` | 403 (unchanged HR_UP) |
| **approval-status, EXEC participant** | 강대표, run at **step 2** | 200 (ceo-step holder) |
| **approval-status, EXEC non-participant** | 강대표, run still at **step 1** | 403 (handler authz, Codex G1 P1) |
- `npx tsc --noEmit` + `npm run lint` PASS.
- **Unit (`npm run test:unit`, vitest):** `tests/unit/rbac/payroll-approval-path.test.ts` — pure-helper
  test for `isPayrollApprovalPath` (positive: the 3 approval paths; negative: `/payroll`,
  `/api/v1/payroll/calculate`, `/payroll/me`, `…/approve/extra`) and `resolvePayrollStepRoleCodes`
  (`ceo`→`[SUPER_ADMIN,EXECUTIVE]`, `hr_admin`→`[HR_ADMIN]`). Convention follows existing
  `tests/unit/rbac/rbac-consistency.test.ts`. (Note: CLAUDE.md "단위테스트 인프라 없음" is stale —
  vitest `^4.1.2` + `tests/unit/**` exist; flag for the CLAUDE.md drift routine, out of scope here.)

## Files touched
1. `src/lib/rbac/rbac-spec.ts` (group + helper)
2. `src/middleware.ts` (apply carve-out)
3. `src/app/api/v1/payroll/[runId]/approval-status/route.ts` (withAuth + handler participant-authz + run summary fold)
4. `src/app/api/v1/payroll/[runId]/approve/route.ts` (notification role resolution)
5. `src/lib/payroll/approval-step-roles.ts` (export shared `resolvePayrollStepRoleCodes`)
6. `src/app/api/v1/payroll/runs/[id]/approve/route.ts` (DELETE)
7. `src/app/(dashboard)/payroll/[runId]/approve/PayrollApproveClient.tsx` (drop runs/{id} call)
8. `tests/unit/rbac/payroll-approval-path.test.ts` (new unit test for the matcher + role-resolver helpers)

## Gates
- 3+ files + security-critical → **Codex Gate 1** (plan review) before implementation, **Gate 2** in
  `/verify` after. SSOT for commands = `.claude/commands/verify.md`.

## Out of scope
Dedicated approver queue; ⑥-C MANAGER; ApprovalFlow chain changes; RLS/MV re-apply (separate infra track).

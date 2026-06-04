# Payroll Step-2 EXECUTIVE Approval — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a company's EXECUTIVE (法人 대표) actually approve/reject payroll step 2 end-to-end (reach + notification), with no broad payroll access and no SoD regression.

**Architecture:** Two-layer authz — middleware grants *reachability* for the approval surface to `[HR_ADMIN, EXECUTIVE, SUPER_ADMIN]` via an isolated anchored-regex carve-out; the handler keeps the *step-level* SoD already shipped in #126. Plus two correctness fixes (broken next-approver notification, dead SoD-bypass route) and a read-path change so EXECUTIVE loads the approval screen without `payroll:view`.

**Tech Stack:** Next.js App Router middleware, NextAuth JWT role claim, Prisma, vitest (`tests/unit/**`), Playwright (`e2e/api/**`).

**Spec:** `docs/plans/active/2026-06-04-payroll-executive-approval.md`

---

## File structure / responsibilities

| File | Responsibility | Change |
|---|---|---|
| `src/lib/payroll/approval-step-roles.ts` | abstract step role → real role codes (SoD SSOT) | export shared `resolvePayrollStepRoleCodes`; DRY callerHolds |
| `src/lib/rbac/rbac-spec.ts` | RBAC SSOT (groups + ACL) | add `PAYROLL_APPROVERS` group + `isPayrollApprovalPath` helper |
| `src/middleware.ts` | coarse route reachability | apply carve-out before generic rule |
| `src/app/api/v1/payroll/[runId]/approval-status/route.ts` | read approval state | `withPermission(VIEW)`→`withAuth`; fold run summary |
| `src/app/api/v1/payroll/[runId]/approve/route.ts` | step approve + notify | fix `notifyNextApprover` role resolution |
| `src/app/api/v1/payroll/runs/[id]/approve/route.ts` | (dead PUT) | **delete** |
| `src/app/(dashboard)/payroll/[runId]/approve/PayrollApproveClient.tsx` | approval UI | drop `runs/{id}` call; source run from approval-status |
| `tests/unit/payroll/approval-step-roles.test.ts` | unit | new |
| `tests/unit/rbac/payroll-approval-path.test.ts` | unit | new |
| `e2e/api/payroll-approval-exports.spec.ts` | e2e role matrix | extend |

---

## Task 1: Shared step-role resolver (`approval-step-roles.ts`)

**Files:**
- Test: `tests/unit/payroll/approval-step-roles.test.ts` (create)
- Modify: `src/lib/payroll/approval-step-roles.ts:16-19,47`

- [ ] **Step 1: Write failing test**

```ts
// tests/unit/payroll/approval-step-roles.test.ts
import { describe, it, expect } from 'vitest'
import { resolvePayrollStepRoleCodes } from '@/lib/payroll/approval-step-roles'

describe('resolvePayrollStepRoleCodes', () => {
  it('maps ceo → SUPER_ADMIN + EXECUTIVE', () => {
    expect(resolvePayrollStepRoleCodes('ceo')).toEqual(['SUPER_ADMIN', 'EXECUTIVE'])
  })
  it('maps hr_admin → HR_ADMIN', () => {
    expect(resolvePayrollStepRoleCodes('hr_admin')).toEqual(['HR_ADMIN'])
  })
  it('falls back to the literal code for custom/unknown roles', () => {
    expect(resolvePayrollStepRoleCodes('finance')).toEqual(['finance'])
    expect(resolvePayrollStepRoleCodes('SOME_CUSTOM')).toEqual(['SOME_CUSTOM'])
  })
})
```

- [ ] **Step 2: Run — verify fail**

Run: `npm run test:unit -- approval-step-roles`
Expected: FAIL — `resolvePayrollStepRoleCodes is not a function` (not exported yet).

- [ ] **Step 3: Implement** — export the resolver, reuse it in `callerHoldsPayrollStepRole`

In `src/lib/payroll/approval-step-roles.ts`, after the `PAYROLL_STEP_ROLE_CODES` map (line 19) add:

```ts
/**
 * 추상 approverRole → 시스템 role.code 집합 (없으면 literal 그대로 — 하위호환).
 * 'finance'는 권한 기반이라 role.code 매핑이 없음 → caller가 별도 처리.
 */
export function resolvePayrollStepRoleCodes(roleRequired: string): string[] {
    return PAYROLL_STEP_ROLE_CODES[roleRequired] ?? [roleRequired]
}
```

Then replace line 47 (`const codes = PAYROLL_STEP_ROLE_CODES[roleRequired] ?? [roleRequired]`) with:

```ts
    const codes = resolvePayrollStepRoleCodes(roleRequired)
```

- [ ] **Step 4: Run — verify pass + typecheck**

Run: `npm run test:unit -- approval-step-roles && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/payroll/approval-step-roles.ts tests/unit/payroll/approval-step-roles.test.ts
git commit -m "$(cat <<'EOF'
refactor(payroll): 승인 단계 추상role→실코드 resolver export (notify/SoD 공용)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: RBAC carve-out helper (`rbac-spec.ts`)

**Files:**
- Test: `tests/unit/rbac/payroll-approval-path.test.ts` (create)
- Modify: `src/lib/rbac/rbac-spec.ts:14-23` (groups), append helper near `findRouteRule`

- [ ] **Step 1: Write failing test**

```ts
// tests/unit/rbac/payroll-approval-path.test.ts
import { describe, it, expect } from 'vitest'
import { isPayrollApprovalPath, ROLE_GROUPS } from '@/lib/rbac/rbac-spec'

describe('isPayrollApprovalPath', () => {
  it('matches the approval page + approve/reject/approval-status APIs', () => {
    expect(isPayrollApprovalPath('/payroll/abc-123/approve')).toBe(true)
    expect(isPayrollApprovalPath('/api/v1/payroll/abc-123/approve')).toBe(true)
    expect(isPayrollApprovalPath('/api/v1/payroll/abc-123/reject')).toBe(true)
    expect(isPayrollApprovalPath('/api/v1/payroll/abc-123/approval-status')).toBe(true)
  })
  it('does NOT match payroll-admin routes or self-service', () => {
    expect(isPayrollApprovalPath('/payroll')).toBe(false)
    expect(isPayrollApprovalPath('/payroll/me')).toBe(false)
    expect(isPayrollApprovalPath('/payroll/abc-123/review')).toBe(false)
    expect(isPayrollApprovalPath('/payroll/abc-123/publish')).toBe(false)
    expect(isPayrollApprovalPath('/api/v1/payroll/calculate')).toBe(false)
    expect(isPayrollApprovalPath('/api/v1/payroll/runs/abc-123/approve')).toBe(false) // dead route, not carved
    expect(isPayrollApprovalPath('/api/v1/payroll/abc-123/approve/extra')).toBe(false) // anchored
  })
})

describe('PAYROLL_APPROVERS group', () => {
  it('includes HR_ADMIN, EXECUTIVE, SUPER_ADMIN and excludes MANAGER/EMPLOYEE', () => {
    expect([...ROLE_GROUPS.PAYROLL_APPROVERS].sort()).toEqual(['EXECUTIVE', 'HR_ADMIN', 'SUPER_ADMIN'])
    expect(ROLE_GROUPS.PAYROLL_APPROVERS).not.toContain('MANAGER')
    expect(ROLE_GROUPS.PAYROLL_APPROVERS).not.toContain('EMPLOYEE')
  })
})
```

> Note: `/api/v1/payroll/runs/{id}/approve` intentionally returns `false` — that dead PUT route is deleted in Task 6, never carved out.

- [ ] **Step 2: Run — verify fail**

Run: `npm run test:unit -- payroll-approval-path`
Expected: FAIL — `isPayrollApprovalPath is not a function` / `PAYROLL_APPROVERS` undefined.

- [ ] **Step 3: Implement** — add group + helper

In `ROLE_GROUPS` (after `HR_UP`, line 22) add:

```ts
  /** 급여 승인 surface 도달 허용 — 단계별 SoD는 핸들러가 강제 (middleware는 reach만) */
  PAYROLL_APPROVERS: ['HR_ADMIN', 'EXECUTIVE', 'SUPER_ADMIN'],
```

At the end of the file (after `findRouteRule`, line 138) add:

```ts
// ─── Payroll approval carve-out ──────────────────────────
// `findRouteRule`는 prefix-only라 동적경로 suffix(`…/{runId}/approve`)를 격리 못 함.
// 승인 surface만 anchored 정규식으로 매칭 → middleware가 PAYROLL_APPROVERS로 reach 허용.
// 단계별 SoD(어느 step을 승인하는지)는 approve/reject 핸들러가 강제 (#126).
const PAYROLL_APPROVAL_PATTERNS: readonly RegExp[] = [
  /^\/payroll\/[^/]+\/approve$/,                                    // page
  /^\/api\/v1\/payroll\/[^/]+\/(approve|reject|approval-status)$/,  // APIs
]

export function isPayrollApprovalPath(pathname: string): boolean {
  return PAYROLL_APPROVAL_PATTERNS.some((re) => re.test(pathname))
}
```

- [ ] **Step 4: Run — verify pass + typecheck**

Run: `npm run test:unit -- payroll-approval-path && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rbac/rbac-spec.ts tests/unit/rbac/payroll-approval-path.test.ts
git commit -m "$(cat <<'EOF'
feat(rbac): 급여 승인 surface carve-out 헬퍼 + PAYROLL_APPROVERS 그룹

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Apply carve-out in middleware (`middleware.ts`)

**Files:**
- Modify: `src/middleware.ts:211-230` (RBAC check block); import at top

- [ ] **Step 1: Add import**

Find the existing import (`import { findRouteRule } from '@/lib/rbac/rbac-spec'`, line 13) and extend it:

```ts
import { findRouteRule, isPayrollApprovalPath, ROLE_GROUPS } from '@/lib/rbac/rbac-spec'
```

- [ ] **Step 2: Override `allowedRoles` for approval paths**

Replace the block at lines 211-230:

```ts
  // 4. RBAC check — find matching route rule
  const rule = findRouteRule(pathname)
  if (rule) {
    const userRole = (token.role as string) || 'EMPLOYEE'
    if (!rule.allowedRoles.includes(userRole)) {
```

with (carve-out takes precedence over the broad `/payroll`→HR_UP rule; reuses the existing deny block):

```ts
  // 4. RBAC check — payroll approval carve-out wins over the broad /payroll(HR_UP) rule.
  //    Middleware only grants *reach*; step-level SoD stays in the approve/reject handlers (#126).
  const allowedRoles = isPayrollApprovalPath(pathname)
    ? ROLE_GROUPS.PAYROLL_APPROVERS
    : findRouteRule(pathname)?.allowedRoles
  if (allowedRoles) {
    const userRole = (token.role as string) || 'EMPLOYEE'
    if (!allowedRoles.includes(userRole)) {
```

(The remainder of the block — the API 403 / page redirect responses, lines 217-229 — stays byte-for-byte identical; only the `if (rule)` → `if (allowedRoles)` wrapper and the `rule.allowedRoles` → `allowedRoles` source changed. Keep the closing braces.)

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts
git commit -m "$(cat <<'EOF'
fix(payroll): 미들웨어 급여 승인 carve-out — EXECUTIVE 결재 surface 도달 허용

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: approval-status → `withAuth` + handler authz + run-summary fold

**Files:**
- Modify: `src/app/api/v1/payroll/[runId]/approval-status/route.ts:5-12,14,46+,58-59,72-77,97-99`

Rationale: middleware (Task 3) opens *reach* to `PAYROLL_APPROVERS`, but reach ≠ authorization.
`withAuth` alone + company scope would let **any** same-company EXECUTIVE read any run's financial
summary by guessing a `runId` (Codex Gate 1 P1). So the handler must re-authorize: allow only
`payroll:view` holders (HR/SUPER — `hasPermission` bypasses for SUPER) **or** an actual participant of
this run's approval (current pending-step role holder, or someone who already acted). `withAuth`
(not `withPermission`) is still required so EXECUTIVE — who lacks `payroll:view` — can pass the wrapper
and be authorized by participation. Folding run summary lets the page drop the `payroll:view`
`runs/{id}` call (Task 6).

- [ ] **Step 1: Swap the wrapper + imports**

Replace the import block (lines 5-12):

```ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'
import { resolveApprovalFlow } from '@/lib/approval/resolve-approval-flow'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
```

with (drop `withPermission`, add `withAuth`/`hasPermission`, add `forbidden`, add the SoD resolver):

```ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, hasPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { notFound, forbidden } from '@/lib/errors'
import { resolveApprovalFlow } from '@/lib/approval/resolve-approval-flow'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import { callerHoldsPayrollStepRole } from '@/lib/payroll/approval-step-roles'
```

Replace line 14 (`export const GET = withPermission(`) with:

```ts
export const GET = withAuth(
```

Replace the closing `}, perm(MODULE.PAYROLL, ACTION.VIEW),\n)` (lines 97-99) with:

```ts
    },
)
```

- [ ] **Step 2: Add handler-level read authorization (Codex Gate 1 P1)**

Immediately after `if (!run) throw notFound('급여 실행을 찾을 수 없습니다.')` (line 46), insert:

```ts
        // 인가: 미들웨어는 reach만 연다(PAYROLL_APPROVERS). 여기서 실제 열람 자격을 재검증 —
        // payroll:view 보유자(HR; SUPER는 hasPermission이 bypass) 또는 이 run 승인의 실제 참여자
        // (현 단계 role 보유자 / 이미 처리한 사람)만. 그 외 같은 법인 EXECUTIVE의 runId 추측 열람 차단.
        const canViewPayroll = hasPermission(user, perm(MODULE.PAYROLL, ACTION.VIEW))
        let isApprovalParticipant = false
        if (run.payrollApproval) {
            const steps = run.payrollApproval.steps
            const actedBefore = steps.some((s) => s.approverId === user.employeeId)
            const current = steps.find((s) => s.status === 'PENDING')
            const holdsCurrentRole = current
                ? await callerHoldsPayrollStepRole(current.roleRequired, user.employeeId, run.companyId)
                : false
            isApprovalParticipant = actedBefore || holdsCurrentRole
        }
        if (!canViewPayroll && !isApprovalParticipant) {
            throw forbidden('이 급여 결재 현황을 조회할 권한이 없습니다.')
        }
```

(For a pre-submit run — `payrollApproval === null` — `isApprovalParticipant` stays false, so only
`payroll:view`/SUPER pass. EXECUTIVE cannot read runs that have not reached an approval step.)

- [ ] **Step 3: Fold run summary into BOTH response branches**

The `findUnique` uses `include` (not `select`), so all PayrollRun scalars are already loaded — only the
response literals change.

Replace the no-approval branch `run` object (lines 58-59):

```ts
                run: { id: run.id, status: run.status, yearMonth: run.yearMonth },
```

with:

```ts
                run: runSummary(run),
```

Replace the with-approval branch `run` object (lines 73-77):

```ts
            run: {
                id: run.id,
                status: run.status,
                yearMonth: run.yearMonth,
            },
```

with:

```ts
            run: runSummary(run),
```

Add this helper just above `export const GET` (after the imports):

```ts
// 승인 화면이 필요로 하는 run 요약 (RunInfo와 동형) — EXECUTIVE가 payroll:view 없이 로드.
// Decimal은 JSON 직렬화 시 string → 클라이언트 fmt(Number()) 호환.
function runSummary(run: {
    id: string; name: string; yearMonth: string; status: string; headcount: number
    totalNet: unknown; totalGross: unknown; adjustmentCount: number
    allAnomaliesResolved: boolean; notes: string | null
}) {
    return {
        id: run.id,
        name: run.name,
        yearMonth: run.yearMonth,
        status: run.status,
        headcount: run.headcount,
        totalNet: run.totalNet as string | number | null,
        totalGross: run.totalGross as string | number | null,
        adjustmentCount: run.adjustmentCount,
        allAnomaliesResolved: run.allAnomaliesResolved,
        notes: run.notes,
    }
}
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS. (If tsc complains the `findUnique` result lacks a folded field, add it to the `include`/confirm the scalar is selected — all listed fields are PayrollRun scalars per schema.)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/v1/payroll/[runId]/approval-status/route.ts
git commit -m "$(cat <<'EOF'
fix(payroll): approval-status withAuth + 참여자 인가 + run 요약 fold

미들웨어 reach만으론 같은 법인 EXECUTIVE의 runId 추측 열람이 열려(Codex G1 P1),
핸들러에서 payroll:view 또는 이 run 승인 참여자만 통과하도록 재인가.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Fix next-approver notification (`approve/route.ts`)

**Files:**
- Modify: `src/app/api/v1/payroll/[runId]/approve/route.ts:21,213-234`

Bug: `notifyNextApprover(nextStep.roleRequired, …)` queries `role: { code: roleCode }` where
`roleCode` is the abstract `'ceo'` — no employee has `role.code='ceo'`, so EXECUTIVE is never notified.

- [ ] **Step 1: Import the resolver**

Extend the existing import (line 21):

```ts
import { callerHoldsPayrollStepRole, resolvePayrollStepRoleCodes } from '@/lib/payroll/approval-step-roles'
```

- [ ] **Step 2: Resolve abstract role → real codes in the query**

In `notifyNextApprover` (line 220-234), replace:

```ts
        const nextApprovers = await prisma.employee.findMany({
            where: {
                employeeRoles: {
                    some: {
                        role: { code: roleCode },
                        endDate: null,
                    },
                },
```

with:

```ts
        // 추상 step role('ceo' 등)을 실제 role.code(['SUPER_ADMIN','EXECUTIVE'])로 해석.
        // (finance 단계는 권한 기반이라 미커버 — 기본 flow[hr_admin→ceo]엔 없음.)
        const codes = resolvePayrollStepRoleCodes(roleCode)
        const nextApprovers = await prisma.employee.findMany({
            where: {
                employeeRoles: {
                    some: {
                        role: { code: { in: codes } },
                        endDate: null,
                    },
                },
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/v1/payroll/[runId]/approve/route.ts
git commit -m "$(cat <<'EOF'
fix(payroll): 다음 승인자 알림이 추상role 'ceo'로 0명 조회 → 실코드 매핑(EXECUTIVE 도달)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Remove dead route + single-source the approval page

**Files:**
- Delete: `src/app/api/v1/payroll/runs/[id]/approve/route.ts`
- Modify: `src/app/(dashboard)/payroll/[runId]/approve/PayrollApproveClient.tsx:48-60,142-155`

- [ ] **Step 1: Confirm dead, then delete**

Run: `grep -rn "runs/\${[^}]*}/approve\|runs/.*/approve" src e2e tests` — expect **no** caller (only
`runs/{id}/paid` exists). Then:

```bash
git rm src/app/api/v1/payroll/runs/[id]/approve/route.ts
```

- [ ] **Step 2: Point `ApprovalStatus.run` at the full `RunInfo`**

In `PayrollApproveClient.tsx`, change the `ApprovalStatus` interface (lines 48-60) `run` field from the
inline shape to `RunInfo`:

```ts
interface ApprovalStatus {
    run: RunInfo
    approval: {
        id: string
        currentStep: number
        totalSteps: number
        status: string
        requestedBy: string
        requestedAt: string
        completedAt: string | null
    } | null
    chain: ApprovalChainStep[]
}
```

- [ ] **Step 3: Drop the `runs/{id}` fetch; source run from approval-status**

Replace `fetchData` (lines 142-155):

```ts
    const fetchData = useCallback(async () => {
        try {
            const [runRes, approvalRes] = await Promise.all([
                apiClient.get<RunInfo>(`/api/v1/payroll/runs/${runId}`),
                apiClient.get<ApprovalStatus>(`/api/v1/payroll/${runId}/approval-status`),
            ])
            setRun(runRes.data)
            setApproval(approvalRes.data)
        } catch (err) {
            toast({ title: t('approvePage.loadFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }, [runId])
```

with:

```ts
    const fetchData = useCallback(async () => {
        try {
            const approvalRes = await apiClient.get<ApprovalStatus>(`/api/v1/payroll/${runId}/approval-status`)
            setRun(approvalRes.data.run)
            setApproval(approvalRes.data)
        } catch (err) {
            toast({ title: t('approvePage.loadFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }, [runId, t])
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix(payroll): dead runs/[id]/approve(SoD우회) 삭제 + 승인 페이지 approval-status 일원화

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: e2e role matrix (extend `payroll-approval-exports.spec.ts`)

**Files:**
- Read first: `e2e/api/payroll-approval-exports.spec.ts`, `e2e/helpers/auth.ts`, `e2e/helpers/api-client.ts`
- Modify: `e2e/api/payroll-approval-exports.spec.ts` (add a `describe('EXECUTIVE step-2 approval', …)`)

Seeded accounts (CLAUDE.md): `hr@ctr.co.kr` HR_ADMIN/CTR, `executive@ctr.co.kr` 강대표 EXECUTIVE/CTR,
`manager@ctr.co.kr` MANAGER/CTR, `super@ctr.co.kr` SUPER_ADMIN. Use the file's existing auth pattern
(`authFile(role)` storageState or `loginAs(role)`) — match what the surrounding tests use.

- [ ] **Step 1: Read the existing spec to match fixtures/setup**

Run: `sed -n '1,80p' e2e/api/payroll-approval-exports.spec.ts`
Identify: how a run is driven to `PENDING_APPROVAL` at step 2 (after HR_ADMIN approves step 1), and the
request helper used. Reuse that setup; do not invent a new fixture.

- [ ] **Step 2: Add the role-matrix assertions**

Add tests (adapt request/auth calls to the file's helpers):

```ts
// On a CTR run already at PENDING_APPROVAL, step 1 (hr_admin) approved by 한지영:
// - GET /api/v1/payroll/{id}/approval-status as EXECUTIVE (step 2 = ceo pending) → 200 (participant)
// - EXECUTIVE 강대표 approves step 2 → 200, run becomes APPROVED
// - HR_ADMIN 한지영 tries step 2 → 403 (ceo role not held / prior approver)
// - MANAGER reaches POST /api/v1/payroll/{id}/approve → 403 at MIDDLEWARE
// - MANAGER reaches the approval page /payroll/{id}/approve → redirected (not 200)
// - EXECUTIVE of another company on the CTR run → 403 (cross-company, handler)
// - EXECUTIVE reaches GET /api/v1/payroll/calculate (admin) → 403 (carve-out is approval-only)
//
// Codex Gate 1 P1 — approval-status handler authz (NOT middleware-only):
// - GET approval-status as EXECUTIVE on a run still at STEP 1 (hr_admin pending, EXEC not yet
//   participant) → 403 (reach allowed by middleware, but handler denies non-participant)
// - GET approval-status as MANAGER → 403 at MIDDLEWARE (reach denied)
```

Assertion shape (HTTP status per role) — use `expect(res.status()).toBe(<code>)`. The step-1-vs-step-2
distinction for EXECUTIVE approval-status access is the regression guard for the Gate 1 P1 fix.

- [ ] **Step 3: Run the new block**

Run: `npx playwright test e2e/api/payroll-approval-exports.spec.ts --project=api -g "EXECUTIVE"`
Expected: all new cases PASS. (If the global-setup lacks an EXECUTIVE storageState, add it following the
existing role-fixture pattern in `e2e/global-setup.ts`.)

- [ ] **Step 4: Commit**

```bash
git add e2e/
git commit -m "$(cat <<'EOF'
test(payroll): EXECUTIVE step2 승인 e2e 역할 매트릭스(EXEC 200 / HR·MANAGER·cross-company 403)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Full verification (Gate 2)

- [ ] **Step 1:** `npx tsc --noEmit` → PASS
- [ ] **Step 2:** `npm run lint` → PASS
- [ ] **Step 3:** `npm run test:unit` → PASS (both new specs green)
- [ ] **Step 4:** `npx prisma migrate status` → no drift (no schema change in this PR; confirm clean)
- [ ] **Step 5:** Targeted e2e (Task 7 block) → PASS
- [ ] **Step 6:** Run `/verify` (project Gate 2 + Codex review + pattern checks; SSOT = `.claude/commands/verify.md`)
- [ ] **Step 7:** Runtime smoke (dev server, shared DB): 한지영 step1 200 → 강대표 step2 200 → APPROVED; 한지영 step2 attempt 403; confirm 강대표 receives `payroll_approval_needed` notification.

---

## Self-review (coverage vs spec)

- Spec change 1 (middleware carve-out) → Tasks 2+3. ✅
- Spec change 2 (approval-status withAuth + fold) → Task 4. ✅
- Spec change 3 (notification fix) → Tasks 1+5. ✅
- Spec change 4 (delete dead route) → Task 6. ✅
- Spec change 5 (page single-source) → Task 6. ✅
- Test matrix (EXEC/HR/MANAGER/cross-company/same-person/admin-locked/notify) → Task 7. ✅
- Unit (`isPayrollApprovalPath`, `resolvePayrollStepRoleCodes`) → Tasks 1+2. ✅
- Type consistency: `resolvePayrollStepRoleCodes` (Task 1) consumed in Task 5; `PAYROLL_APPROVERS` &
  `isPayrollApprovalPath` (Task 2) consumed in Task 3; `RunInfo` (page) fed by `runSummary` (Task 4)
  and read in Task 6. ✅
- No schema/i18n changes (page strings already exist; no new user-facing copy). ✅

## Out of scope
Dedicated approver queue; ⑥-C MANAGER; ApprovalFlow chain edits; finance-step notification; RLS/MV re-apply.

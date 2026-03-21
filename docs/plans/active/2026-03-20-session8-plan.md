# Track B Phase 3 Session 8 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement concurrent assignment seed data, cross-company READ access, Primary-only approval/leave/payroll enforcement, and pre-hire safety screen.

**Architecture:** Append-Only assignment model with isPrimary flag. Cross-company access via API-level RLS bypass with 3-layer security check. Pre-hire employees redirected to isolated route.

**Tech Stack:** Next.js 15 App Router, Prisma 7, TypeScript strict, PostgreSQL

**Design doc:** `docs/plans/2026-03-20-session8-design.md` (Gemini-reviewed, 4 patches applied)

---

## Task 1: B-3e — Concurrent Assignment Seed (겸직 Seed)

**Files:**
- Create: `prisma/seeds/41-concurrent-assignments.ts`
- Modify: `prisma/seed.ts:54` (add import), `prisma/seed.ts:~3652` (add call)

**Step 1: Create the seed file**

Create `prisma/seeds/41-concurrent-assignments.ts`:

```typescript
// ================================================================
// Track B B-3e: Concurrent Assignment Seed (겸직)
// 6 employees with Secondary Assignments (isPrimary: false)
//
// ⚠️ Append-Only: existing Primary Assignments are NOT modified
// ⚠️ Gemini Patch #1: Secondary effectiveDate MUST match Primary's effectiveDate
// ================================================================

import { PrismaClient } from '../../src/generated/prisma/client'

export async function seedConcurrentAssignments(prisma: PrismaClient) {
  console.log('🔄 Seeding concurrent assignments (B-3e)...')

  // Helper: deterministic UUID (same as seed.ts)
  function deterministicUUID(namespace: string, key: string): string {
    const str = `${namespace}:${key}`
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + chr
      hash |= 0
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0')
    return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-a${hex.slice(0, 3)}-${hex.padEnd(12, '0').slice(0, 12)}`
  }

  // ────────────────────────────────────────────
  // Lookup helpers
  // ────────────────────────────────────────────
  async function findEmployee(email: string) {
    const emp = await prisma.employee.findFirst({
      where: { email, deletedAt: null },
      select: { id: true },
    })
    if (!emp) throw new Error(`Employee not found: ${email}`)
    return emp.id
  }

  async function findPrimaryAssignment(employeeId: string) {
    const asgn = await prisma.employeeAssignment.findFirst({
      where: { employeeId, isPrimary: true, endDate: null },
      select: { effectiveDate: true },
    })
    if (!asgn) throw new Error(`Primary assignment not found for: ${employeeId}`)
    return asgn.effectiveDate
  }

  async function findCompany(code: string) {
    const co = await prisma.company.findFirst({ where: { code }, select: { id: true } })
    if (!co) throw new Error(`Company not found: ${code}`)
    return co.id
  }

  async function findPosition(code: string) {
    const pos = await prisma.position.findFirst({ where: { code }, select: { id: true } })
    if (!pos) throw new Error(`Position not found: ${code}`)
    return pos.id
  }

  async function findDepartment(code: string, companyId: string) {
    const dept = await prisma.department.findFirst({
      where: { code, companyId },
      select: { id: true },
    })
    if (!dept) throw new Error(`Department not found: ${code} in company ${companyId}`)
    return dept.id
  }

  async function findJobGrade(code: string, companyId: string) {
    const grade = await prisma.jobGrade.findFirst({
      where: { code, companyId },
      select: { id: true },
    })
    // JobGrade might not exist for all companies — nullable field
    return grade?.id ?? null
  }

  // ────────────────────────────────────────────
  // Secondary Assignment definitions
  // Each entry: [employeeEmail, secondaryCompanyCode, secondaryPositionCode, secondaryDeptCode, secondaryGradeCode, changeType]
  // ────────────────────────────────────────────
  // Note: Position/Department codes must exist in their respective seeds.
  // If they don't exist yet, we need to create them in seed or use existing ones.

  const concurrentDefs: Array<{
    email: string
    secondaries: Array<{
      companyCode: string
      positionCode: string
      deptCode: string
      gradeCode: string
      label: string
    }>
  }> = [
    {
      // 이동옥: CTR CEO → +CTR CFO, +CTR-ECO CFO
      email: 'dongok.lee@ctr.co.kr',
      secondaries: [
        { companyCode: 'CTR', positionCode: 'POS-CTR-TL-FINANCE', deptCode: 'DEPT-CTR-FINANCE', gradeCode: 'G-ML', label: 'CTR CFO (겸)' },
        { companyCode: 'CTR-ECO', positionCode: 'POS-ECO-HEAD', deptCode: 'DEPT-ECO-MGMT', gradeCode: 'G-ML', label: 'CTR-ECO CFO (겸)' },
      ],
    },
    {
      // 정병주: CTR 품질경영팀장 → +CTR-MOB 품질경영팀장(겸)
      email: 'byungju.jeong@ctr.co.kr',
      secondaries: [
        { companyCode: 'CTR-MOB', positionCode: 'POS-MOB-TL-QM', deptCode: 'DEPT-MOB-QM', gradeCode: 'G-EL', label: 'CTR-MOB 품질경영팀장 (겸)' },
      ],
    },
    {
      // 이경수: CTR-MOB 경영관리팀장 → +EHS팀장(겸), +정보보안팀장(겸)
      email: 'kyungsu.lee@ctr.co.kr',
      secondaries: [
        { companyCode: 'CTR-MOB', positionCode: 'POS-MOB-TL-EHS', deptCode: 'DEPT-MOB-EHS', gradeCode: 'G-EL', label: 'EHS팀장 (겸)' },
        { companyCode: 'CTR-MOB', positionCode: 'POS-MOB-TL-INFOSEC', deptCode: 'DEPT-MOB-INFOSEC', gradeCode: 'G-EL', label: '정보보안팀장 (겸)' },
      ],
    },
    {
      // 방우영: CTR SCM본부장 → +OM팀 팀장(겸)
      email: 'wooyoung.bang@ctr.co.kr',
      secondaries: [
        { companyCode: 'CTR', positionCode: 'POS-CTR-TL-TM', deptCode: 'DEPT-CTR-TM', gradeCode: 'G-ML', label: 'OM팀 팀장 (겸)' },
      ],
    },
    {
      // 한성욱: CTR 재무회계팀장 → +CTR-ECO 재무회계팀장(겸) [크로스-법인]
      email: 'sungwook.han@ctr.co.kr',
      secondaries: [
        { companyCode: 'CTR-ECO', positionCode: 'POS-ECO-TL-MY-MGMT', deptCode: 'DEPT-ECO-MGMT', gradeCode: 'G-EL', label: 'CTR-ECO 재무회계팀장 (겸)' },
      ],
    },
    {
      // 박양원: AM R&D센터장 → +설계팀V 팀장(겸)
      email: 'yangwon.park@ctr.co.kr',
      secondaries: [
        { companyCode: 'CTR', positionCode: 'POS-CTR-TL-AM-DESIGNK', deptCode: 'DEPT-CTR-AM-DESIGNK', gradeCode: 'G-ML', label: '설계팀V 팀장 (겸)' },
      ],
    },
  ]

  let created = 0

  for (const def of concurrentDefs) {
    const employeeId = await findEmployee(def.email)
    const primaryEffectiveDate = await findPrimaryAssignment(employeeId)

    for (const sec of def.secondaries) {
      const assignmentId = deterministicUUID('concurrent-assignment', `${def.email}:${sec.positionCode}`)
      const companyId = await findCompany(sec.companyCode)

      // Department and Position lookups (may need to handle missing gracefully)
      let departmentId: string | null = null
      let positionId: string | null = null
      let jobGradeId: string | null = null

      try { departmentId = await findDepartment(sec.deptCode, companyId) } catch { /* optional */ }
      try { positionId = await findPosition(sec.positionCode) } catch { /* optional */ }
      try { jobGradeId = await findJobGrade(sec.gradeCode, companyId) } catch { /* optional */ }

      await prisma.employeeAssignment.upsert({
        where: { id: assignmentId },
        update: {},
        create: {
          id: assignmentId,
          employeeId,
          companyId,
          departmentId,
          positionId,
          jobGradeId,
          // Gemini Patch #1: effectiveDate = Primary's effectiveDate (시간의 역전 방어)
          effectiveDate: primaryEffectiveDate,
          endDate: null,
          changeType: 'CONCURRENT',
          employmentType: 'FULL_TIME',
          status: 'ACTIVE',
          isPrimary: false,
          reason: sec.label,
        },
      })
      created++
    }
  }

  console.log(`✅ Concurrent assignments seeded: ${created} secondary assignments for 6 employees`)
}
```

**Step 2: Register in seed.ts**

Add import at line ~54 (after `seedWorkLocations` import):
```typescript
import { seedConcurrentAssignments } from './seeds/41-concurrent-assignments'
```

Add call after `seedWorkLocations` call (~line 3652):
```typescript
await seedConcurrentAssignments(prisma)
```

**Step 3: Verify seed runs**

Run: `npx tsx prisma/seed.ts`
Expected: `✅ Concurrent assignments seeded: 8 secondary assignments for 6 employees`

**Step 4: Verify data**

Run SQL to confirm:
```sql
SELECT e.name, ea.is_primary, c.code, ea.effective_date
FROM employee_assignments ea
JOIN employees e ON e.id = ea.employee_id
JOIN companies c ON c.id = ea.company_id
WHERE e.email IN ('dongok.lee@ctr.co.kr', 'sungwook.han@ctr.co.kr')
ORDER BY e.name, ea.is_primary DESC;
```

**Step 5: Commit**

```bash
git add prisma/seeds/41-concurrent-assignments.ts prisma/seed.ts
git commit -m "B-3e: Add concurrent assignment seed data for 6 employees"
```

---

## Task 2: B-3j — DOMESTIC_COMPANY_CODES Constant + Payroll isPrimary Hardening

**Files:**
- Modify: `src/lib/constants.ts:179` (add constant)
- Modify: `src/app/api/v1/payroll/calculate/route.ts` (add domestic check)

**Step 1: Add DOMESTIC_COMPANY_CODES constant**

At end of `src/lib/constants.ts`:
```typescript
// ─── Domestic Company Codes (Gemini Patch #3: hardcoded for payroll safety) ──
export const DOMESTIC_COMPANY_CODES = [
  'CTR-HOLD', 'CTR', 'CTR-MOB', 'CTR-ECO', 'CTR-ROB', 'CTR-ENR', 'CTR-FML',
] as const
export type DomesticCompanyCode = (typeof DOMESTIC_COMPANY_CODES)[number]
```

**Step 2: Add domestic-only guard to payroll calculate**

In `src/app/api/v1/payroll/calculate/route.ts`, after fetching the payroll run's company, add:
```typescript
import { DOMESTIC_COMPANY_CODES } from '@/lib/constants'

// Before employee query — block overseas payroll calculation
const company = await prisma.company.findUnique({ where: { id: run.companyId }, select: { code: true } })
if (!company || !DOMESTIC_COMPANY_CODES.includes(company.code as any)) {
  throw forbidden('해외법인은 로컬 시스템에서 급여를 처리합니다.')
}
```

**Step 3: Verify payroll routes already have isPrimary filter**

Scan all payroll routes for `isPrimary: true` — confirm coverage. Add `effectiveDate: { lte: new Date() }` where missing.

**Step 4: Commit**

```bash
git add src/lib/constants.ts src/app/api/v1/payroll/calculate/route.ts
git commit -m "B-3j: Add DOMESTIC_COMPANY_CODES constant + block overseas payroll calculation"
```

---

## Task 3: B-3h — Approval/Leave Primary Enforcement

**Files:**
- Modify: `src/lib/workflow.ts` (verify/harden approver resolution)
- Modify: `src/app/api/v1/leave/requests/route.ts` (Primary company balance)
- Modify: `src/app/api/v1/leave/balances/[employeeId]/route.ts` (Primary filter)

**Step 1: Verify workflow.ts approver resolution**

Read `src/lib/workflow.ts` `resolveApprover()` — confirm it uses `isPrimary: true, endDate: null` when finding DIRECT_MANAGER. If it doesn't explicitly filter on `isPrimary`, add it.

**Step 2: Harden leave request creation**

In `src/app/api/v1/leave/requests/route.ts`:
- When looking up leave balance for deduction, ensure it queries by Primary Assignment's companyId
- Add comment: `// B-3h: 겸직자도 Primary 법인 잔여일수에서만 차감`

**Step 3: Harden leave balance query**

In `src/app/api/v1/leave/balances/[employeeId]/route.ts`:
- Verify the company filter uses `isPrimary: true` (already does per exploration)
- Add `effectiveDate: { lte: new Date() }` if missing

**Step 4: Commit**

```bash
git add src/lib/workflow.ts src/app/api/v1/leave/requests/route.ts src/app/api/v1/leave/balances/\[employeeId\]/route.ts
git commit -m "B-3h: Enforce Primary-only approval chain and leave balance for concurrent assignments"
```

---

## Task 4: B-3f — Performance Matrix Dotted Line Connection

**Files:**
- Modify: `src/app/api/v1/performance/peer-review/candidates/route.ts` (add dotted line manager)

**Step 1: Read current peer review candidates logic**

Read `src/app/api/v1/performance/peer-review/candidates/route.ts` and understand current candidate selection.

**Step 2: Add dotted line manager as automatic peer review candidate**

After fetching the employee's position, look up `position.dottedLinePositionId`. If it exists, include the person holding that position as a peer review candidate:

```typescript
// B-3f: Include dotted line manager as peer review candidate
if (employeePosition?.dottedLinePositionId) {
  const dottedManager = await prisma.employeeAssignment.findFirst({
    where: {
      positionId: employeePosition.dottedLinePositionId,
      isPrimary: true,
      endDate: null,
    },
    select: { employeeId: true },
  })
  if (dottedManager && dottedManager.employeeId !== employeeId) {
    // Add to candidates with source: 'DOTTED_LINE'
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/v1/performance/peer-review/candidates/route.ts
git commit -m "B-3f: Include dotted line manager as automatic peer review candidate"
```

---

## Task 5: B-3k — Pre-hire Safety Screen

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx:48` (add pre-hire redirect)
- Create: `src/app/(auth)/pre-hire/page.tsx` (pre-hire page)
- Create: `src/app/(auth)/pre-hire/PreHireClient.tsx` (client component)

**Step 1: Add pre-hire check to dashboard layout**

In `src/app/(dashboard)/layout.tsx`, after `const user = session.user as SessionUser` (line 48):

```typescript
import { fetchPrimaryAssignment } from '@/lib/employee/assignment-helpers'

// B-3k: Pre-hire check — redirect if no active assignment
const primaryAssignment = await fetchPrimaryAssignment(user.employeeId)
if (!primaryAssignment) {
  redirect('/pre-hire')
}
```

**Step 2: Create pre-hire page**

Create `src/app/(auth)/pre-hire/page.tsx`:
```typescript
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { SessionUser } from '@/types'
import PreHireClient from './PreHireClient'

export const dynamic = 'force-dynamic'

export default async function PreHirePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const user = session.user as SessionUser

  // Check for future assignment
  const futureAssignment = await prisma.employeeAssignment.findFirst({
    where: {
      employeeId: user.employeeId,
      isPrimary: true,
      endDate: null,
      effectiveDate: { gt: new Date() },
    },
    select: {
      effectiveDate: true,
      company: { select: { name: true } },
      department: { select: { name: true } },
      position: { select: { title: true } },
    },
    orderBy: { effectiveDate: 'asc' },
  })

  return (
    <PreHireClient
      userName={user.name ?? ''}
      futureAssignment={futureAssignment ? {
        effectiveDate: futureAssignment.effectiveDate.toISOString(),
        companyName: futureAssignment.company?.name ?? '',
        departmentName: futureAssignment.department?.name ?? '',
        positionTitle: futureAssignment.position?.title ?? '',
      } : null}
    />
  )
}
```

**Step 3: Create PreHireClient component**

Create `src/app/(auth)/pre-hire/PreHireClient.tsx`:
```typescript
'use client'

import { Building2, Calendar, Clock } from 'lucide-react'

interface Props {
  userName: string
  futureAssignment: {
    effectiveDate: string
    companyName: string
    departmentName: string
    positionTitle: string
  } | null
}

export default function PreHireClient({ userName, futureAssignment }: Props) {
  const effectiveDate = futureAssignment
    ? new Date(futureAssignment.effectiveDate).toLocaleDateString('ko-KR')
    : null

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F5FA] p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
            <Clock className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <h1 className="mb-2 text-center text-xl font-semibold text-gray-900">
          {userName}님, 환영합니다
        </h1>

        {futureAssignment ? (
          <>
            <p className="mb-6 text-center text-sm text-gray-500">
              발령일이 도래하지 않았습니다.
            </p>
            <div className="mb-6 rounded-lg bg-gray-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">발령일:</span>
                <span className="font-medium">{effectiveDate}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">소속:</span>
                <span className="font-medium">
                  {futureAssignment.companyName} · {futureAssignment.departmentName}
                </span>
              </div>
            </div>
            <p className="text-center text-xs text-gray-400">
              {effectiveDate}에 다시 접근해 주세요.
            </p>
          </>
        ) : (
          <p className="text-center text-sm text-gray-500">
            발령 정보가 없습니다. 관리자에게 문의해 주세요.
          </p>
        )}
      </div>
    </div>
  )
}
```

**Step 4: Verify no infinite redirect**

- Dashboard layout redirects to `/pre-hire` (outside `(dashboard)` layout)
- `/pre-hire` is under `(auth)` group — no dashboard layout applied
- Pre-hire page does its own session check independently

**Step 5: Commit**

```bash
git add src/app/\(dashboard\)/layout.tsx src/app/\(auth\)/pre-hire/
git commit -m "B-3k: Add pre-hire safety screen with isolated route (Gemini Patch #4)"
```

---

## Task 6: B-3g — Cross-Company READ Access (Option A)

**Files:**
- Create: `src/lib/api/cross-company-access.ts`
- Modify: Target APIs (Manager Hub, Org Tree, Performance) — exact files TBD during implementation

**Step 1: Create cross-company access helpers**

Create `src/lib/api/cross-company-access.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'
import { ROLE } from '@/lib/constants'

/**
 * B-3g: Cross-company READ access — Option A
 * Allows MANAGER+ to read dotted-line/secondary employees in other companies.
 *
 * Security 3-layer check (AND):
 * 1. Caller role >= MANAGER
 * 2. Caller has dottedLinePositionId OR secondary assignment in another company
 * 3. Target employee is in caller's dotted/secondary relationship
 */

interface CrossCompanyContext {
  callerEmployeeId: string
  callerRole: string
  callerCompanyId: string
}

// ── Single target verification (for detail views) ──
export async function verifyCrossCompanyAccess(
  ctx: CrossCompanyContext,
  targetEmployeeId: string,
): Promise<{ allowed: boolean; readOnly: true }> {
  // Check 1: MANAGER+
  if (![ROLE.SUPER_ADMIN, ROLE.HR_ADMIN, ROLE.EXECUTIVE, ROLE.MANAGER].includes(ctx.callerRole as any)) {
    return { allowed: false, readOnly: true }
  }

  // Check 2 & 3: Relationship exists
  const relationships = await getCallerCrossCompanyRelationships(ctx)
  if (relationships.relatedEmployeeIds.size === 0) {
    return { allowed: false, readOnly: true }
  }

  return {
    allowed: relationships.relatedEmployeeIds.has(targetEmployeeId),
    readOnly: true,
  }
}

// ── Batch filter builder (for list views) — Gemini Patch #2 ──
export async function getCrossCompanyReadFilter(
  ctx: CrossCompanyContext,
): Promise<Prisma.EmployeeWhereInput | null> {
  // Check 1: MANAGER+
  if (![ROLE.SUPER_ADMIN, ROLE.HR_ADMIN, ROLE.EXECUTIVE, ROLE.MANAGER].includes(ctx.callerRole as any)) {
    return null
  }

  const relationships = await getCallerCrossCompanyRelationships(ctx)
  if (relationships.relatedEmployeeIds.size === 0) {
    return null
  }

  // Return WHERE clause that includes cross-company employees
  return {
    id: { in: Array.from(relationships.relatedEmployeeIds) },
  }
}

// ── Internal: resolve all cross-company relationships in 1 query batch ──
async function getCallerCrossCompanyRelationships(ctx: CrossCompanyContext) {
  const relatedEmployeeIds = new Set<string>()

  // Path A: Dotted line — find employees whose position has dottedLinePositionId pointing to caller's position
  const callerAssignment = await prisma.employeeAssignment.findFirst({
    where: { employeeId: ctx.callerEmployeeId, isPrimary: true, endDate: null },
    select: { positionId: true },
  })

  if (callerAssignment?.positionId) {
    // Employees whose position's dottedLinePositionId = caller's positionId
    const dottedEmployees = await prisma.employeeAssignment.findMany({
      where: {
        isPrimary: true,
        endDate: null,
        position: { dottedLinePositionId: callerAssignment.positionId },
      },
      select: { employeeId: true },
    })
    for (const e of dottedEmployees) relatedEmployeeIds.add(e.employeeId)
  }

  // Path B: Secondary assignments — caller has secondary in another company
  const callerSecondaries = await prisma.employeeAssignment.findMany({
    where: {
      employeeId: ctx.callerEmployeeId,
      isPrimary: false,
      endDate: null,
      companyId: { not: ctx.callerCompanyId },
    },
    select: { companyId: true, positionId: true },
  })

  if (callerSecondaries.length > 0) {
    const secondaryCompanyIds = callerSecondaries.map(s => s.companyId)
    const secondaryPositionIds = callerSecondaries.map(s => s.positionId).filter(Boolean) as string[]

    // Employees who report to caller's secondary positions
    const reportingEmployees = await prisma.employeeAssignment.findMany({
      where: {
        isPrimary: true,
        endDate: null,
        companyId: { in: secondaryCompanyIds },
        position: {
          reportsToPositionId: { in: secondaryPositionIds },
        },
      },
      select: { employeeId: true },
    })
    for (const e of reportingEmployees) relatedEmployeeIds.add(e.employeeId)
  }

  return { relatedEmployeeIds }
}
```

**Step 2: Apply to Manager Hub direct reports API**

In Manager Hub pending-approvals or team API, add cross-company employee inclusion:
- Import `getCrossCompanyReadFilter`
- After fetching solid-line direct reports, also fetch cross-company employees
- Merge results with `source: 'DOTTED_LINE'` tag for UI differentiation

**Step 3: Apply to Org Tree API**

Ensure dotted lines appear as dashed connections in org tree query.

**Step 4: Verify security**

Manual verification checklist (all must pass):
```
□ MANAGER with dotted → sees cross-company employees (READ)
□ MANAGER with dotted → cannot modify cross-company employees (403)
□ EMPLOYEE → cross-company filter returns null (no access)
□ MANAGER without dotted/secondary → no cross-company data
```

**Step 5: Commit**

```bash
git add src/lib/api/cross-company-access.ts
git commit -m "B-3g: Add cross-company READ access helpers with 3-layer security check"
```

---

## Task 7: Type Check + Build Verification

**Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 2: Run lint**

Run: `npm run lint`
Expected: No new warnings

**Step 3: Fix any issues found**

If errors exist, fix them before proceeding.

**Step 4: Final commit**

```bash
git commit -m "Session 8: fix type/lint issues" # only if fixes needed
```

---

## Execution Order

```
Task 1 (B-3e seed)     → foundation — other tasks need this data
Task 2 (B-3j payroll)  → quick, independent
Task 3 (B-3h approval) → depends on understanding workflow
Task 4 (B-3f perf)     → quick, independent
Task 5 (B-3k pre-hire) → independent
Task 6 (B-3g cross-co) → most complex, needs seed data
Task 7 (verify)        → final gate
```

## Notes for Implementer

- **DO NOT TOUCH** protected files listed in design doc
- **Position/Department codes**: The seed file references codes like `POS-MOB-TL-QM`, `DEPT-MOB-QM` etc. Verify these exist in existing seeds before running. If missing, the seed will log errors but not crash (graceful handling).
- **Gemini Patches**: 4 patches are baked into the plan. Do not deviate.
- **Testing with seed data**: After Task 1 seed runs, verify concurrent employees appear correctly before proceeding with Tasks 2-6.

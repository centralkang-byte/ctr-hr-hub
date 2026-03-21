# Session 11: Position-Based Manager Lookup + Cross-Company READ Integration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete Phase 3 remaining work — fix 6 APIs that query all company employees instead of direct reports, implement offboarding manager notification, and integrate cross-company READ filter into 4 Manager Hub/Org Tree APIs.

**Architecture:** Extract a reusable `getDirectReportIds(managerId)` helper from the proven Manager Hub pattern (position.reportsToPositionId). Apply it to 5 performance/CFR APIs. For cross-company READ, wrap existing `companyId` filters with `getCrossCompanyReadFilter()` OR clause.

**Tech Stack:** Prisma, Next.js App Router, TypeScript, existing helpers (`cross-company-access.ts`, `manager-check.ts`)

---

## Design Review Patches (Gemini Review 2026-03-20)

> 3 critical issues found during design review. All patches applied below.

### Patch 1: isPrimary 필터 함정 (Task 1, 8)
- **위험도:** CRITICAL — 겸직 매니저의 팀원이 전부 증발
- **문제:** `getDirectReportIds`가 매니저의 Primary position만 조회 → Secondary로 팀장을 맡고 있으면 팀원 0명
- **수정:** 매니저의 position 조회 시 `isPrimary` 조건 제거, 활성 Assignment 전체에서 positionId 배열 수집

### Patch 2: Org Tree 점선 보고 누락 (Task 12)
- **위험도:** HIGH — 타 법인 점선 상위자의 Org Tree 접근 거부
- **문제:** `hasAccess`가 `isPrimary: false`(겸직)만 체크, 점선 보고(dottedLinePositionId) 관계 무시
- **수정:** 타 법인 접근 검증에 점선 보고자 보유 여부 OR 조건 추가

### Patch 3: Performance 타 법인 데이터 0건 (Task 11)
- **위험도:** HIGH — 타 법인 팀원의 성과 데이터가 영원히 0건
- **문제:** 타 법인 직원을 allReportIds로 포함시켰으나, evaluations/goals 쿼리에서 `companyId: session.companyId` 유지 → 타 법인 데이터 필터링됨
- **수정:** allReportIds로 보안 검증 완료되었으므로 하위 쿼리에서 companyId 필터 제거

---

## Part 1: Position-Based Manager Lookup (8 changes across 6 files)

### Task 1: Extract `getDirectReportIds` helper

**Files:**
- Create: `src/lib/employee/direct-reports.ts`

**Step 1: Create the helper**

This helper extracts the proven 2-step pattern from Manager Hub routes into a reusable function.

> **PATCH 1 적용:** 매니저의 position을 찾을 때 `isPrimary` 조건을 제거하여 겸직(Secondary) 포지션도 포함.
> 예: Primary=일반팀원, Secondary=타팀 팀장인 매니저가 자기 팀원을 볼 수 있어야 함.
> `getManagerIdByPosition`도 동일하게 매니저 조회 시 isPrimary 제거.

```typescript
// src/lib/employee/direct-reports.ts
import { prisma } from '@/lib/prisma'

/**
 * Get employee IDs of direct reports via position hierarchy.
 * Scans ALL active assignments (primary + secondary) to find manager's positions,
 * then finds employees whose position.reportsToPositionId matches any of them.
 *
 * Why not isPrimary-only: A manager may hold a team lead position as a secondary
 * assignment (e.g., primary=일반팀원, secondary=타팀 팀장). Filtering by isPrimary
 * would make their team invisible.
 */
export async function getDirectReportIds(managerId: string): Promise<string[]> {
  // Collect ALL active positions held by this manager (primary + secondary)
  const managerAsgns = await prisma.employeeAssignment.findMany({
    where: { employeeId: managerId, endDate: null },
    select: { positionId: true },
  })

  const positionIds = managerAsgns
    .map((a) => a.positionId)
    .filter((id): id is string => id !== null)

  if (positionIds.length === 0) return []

  const reportAsgns = await prisma.employeeAssignment.findMany({
    where: {
      position: { reportsToPositionId: { in: positionIds } },
      isPrimary: true,
      endDate: null,
    },
    select: { employeeId: true },
  })

  // Deduplicate (same employee could report via multiple positions)
  return [...new Set(reportAsgns.map((a) => a.employeeId))]
}

/**
 * Get the manager's employee ID for a given employee, via position hierarchy.
 * Checks both primary and secondary assignments to find the manager holding
 * the reportsToPositionId.
 * Returns null if no manager found.
 */
export async function getManagerIdByPosition(employeeId: string): Promise<string | null> {
  const empAsgn = await prisma.employeeAssignment.findFirst({
    where: { employeeId, isPrimary: true, endDate: null },
    include: {
      position: { select: { reportsToPositionId: true } },
    },
  })

  if (!empAsgn?.position?.reportsToPositionId) return null

  // Find who holds the reportsTo position (could be primary or secondary assignment)
  const managerAsgn = await prisma.employeeAssignment.findFirst({
    where: {
      positionId: empAsgn.position.reportsToPositionId,
      endDate: null,
    },
    select: { employeeId: true },
  })

  return managerAsgn?.employeeId ?? null
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/lib/employee/direct-reports.ts
git commit -m "feat(B-3): add getDirectReportIds + getManagerIdByPosition helpers"
```

---

### Task 2: Fix CFR 1:1 Dashboard — position-based filtering

**Files:**
- Modify: `src/app/api/v1/cfr/one-on-ones/dashboard/route.ts:17-30`

**Current (BROKEN):** Queries ALL employees in the company — returns every employee's 1:1 stats, not just direct reports.

**Fix:** Replace the `findMany` with position-based direct report lookup.

```typescript
// Line 1: Add import
import { getDirectReportIds } from '@/lib/employee/direct-reports'

// Lines 17-30: Replace the TODO block with:
    // Get direct reports via position hierarchy
    const reportIds = await getDirectReportIds(user.employeeId)
    const teamMembers = await prisma.employee.findMany({
      where: {
        id: { in: reportIds },
        assignments: {
          some: {
            companyId: user.companyId,
            isPrimary: true,
            endDate: null,
            status: 'ACTIVE',
          },
        },
      },
      select: { id: true, name: true, employeeNo: true },
    })
```

**Step 1: Apply the edit**
**Step 2: Verify** — `npx tsc --noEmit`

---

### Task 3: Fix CFR 1:1 POST — direct report validation

**Files:**
- Modify: `src/app/api/v1/cfr/one-on-ones/route.ts:92-102`

**Current (BROKEN):** Only checks same company — any manager can create 1:1 with any employee in the company.

**Fix:** Add direct report relationship check.

```typescript
// Line 1 area: Add import
import { getDirectReportIds } from '@/lib/employee/direct-reports'

// Lines 92-102: Replace the TODO block with:
    // Verify the target employee is a direct report
    const reportIds = await getDirectReportIds(user.employeeId)
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        ...(reportIds.length > 0
          ? { id: { in: reportIds } }
          : {
              assignments: {
                some: { companyId: user.companyId, isPrimary: true, endDate: null },
              },
            }),
      },
    })
```

Note: Falls back to company-scope if manager has no direct reports (e.g., HR_ADMIN scheduling with any employee).

**Step 1: Apply the edit**
**Step 2: Verify** — `npx tsc --noEmit`
**Step 3: Commit CFR changes**

```bash
git add src/app/api/v1/cfr/one-on-ones/dashboard/route.ts src/app/api/v1/cfr/one-on-ones/route.ts
git commit -m "fix(B-3): CFR 1:1 APIs — position-based direct report filtering"
```

---

### Task 4: Fix Performance Team Goals — position-based filtering

**Files:**
- Modify: `src/app/api/v1/performance/team-goals/route.ts:33-56`

**Current (BROKEN):** Queries ALL employees in the company.

**Fix:**

```typescript
// Add import at top
import { getDirectReportIds } from '@/lib/employee/direct-reports'

// Lines 33-56: Replace TODO block with:
    // Find direct reports via position hierarchy
    const reportIds = await getDirectReportIds(user.employeeId)
    const directReports = await prisma.employee.findMany({
      where: {
        id: { in: reportIds },
        deletedAt: null,
        assignments: {
          some: { companyId: user.companyId, isPrimary: true, endDate: null },
        },
      },
      select: {
        id: true,
        name: true,
        employeeNo: true,
        email: true,
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          include: {
            department: { select: { id: true, name: true } },
            jobGrade: { select: { id: true, name: true } },
          },
        },
      },
    })
```

**Step 1: Apply the edit**
**Step 2: Verify** — `npx tsc --noEmit`

---

### Task 5: Fix Performance Evaluations Manager GET — position-based filtering

**Files:**
- Modify: `src/app/api/v1/performance/evaluations/manager/route.ts:73-92`

**Current (BROKEN):** Queries ALL employees in the company.

**Fix:**

```typescript
// Add import at top
import { getDirectReportIds } from '@/lib/employee/direct-reports'

// Lines 73-92: Replace TODO block with:
    // Get team members (direct reports via position hierarchy)
    const reportIds = await getDirectReportIds(user.employeeId)
    const teamMembers = await prisma.employee.findMany({
      where: {
        id: { in: reportIds },
        assignments: {
          some: { companyId: user.companyId, status: 'ACTIVE', isPrimary: true, endDate: null },
        },
      },
      select: {
        id: true, name: true, employeeNo: true,
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          include: {
            department: { select: { name: true } },
            jobGrade: { select: { name: true } },
          },
        },
      },
    })
```

---

### Task 6: Fix Performance Evaluations Manager POST — direct report validation

**Files:**
- Modify: `src/app/api/v1/performance/evaluations/manager/route.ts:192-202`

**Current (BROKEN):** Only checks same company — any manager can evaluate any employee in the company.

**Fix:** (Uses same `getDirectReportIds` import added in Task 5)

```typescript
// Lines 192-202: Replace TODO block with:
    // Verify the target employee is a direct report
    const reportIds = await getDirectReportIds(user.employeeId)
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        ...(reportIds.length > 0
          ? { id: { in: reportIds } }
          : {
              assignments: {
                some: { companyId: user.companyId, isPrimary: true, endDate: null },
              },
            }),
      },
    })
```

**Step 1: Apply Tasks 5+6**
**Step 2: Verify** — `npx tsc --noEmit`

---

### Task 7: Fix Performance Results Team — position-based filtering

**Files:**
- Modify: `src/app/api/v1/performance/results/team/route.ts:28-47`

**Current (BROKEN):** Queries ALL employees in the company.

**Fix:**

```typescript
// Add import at top
import { getDirectReportIds } from '@/lib/employee/direct-reports'

// Lines 28-47: Replace TODO block with:
    // Get direct reports via position hierarchy
    const reportIds = await getDirectReportIds(user.employeeId)
    const teamMembers = await prisma.employee.findMany({
      where: {
        id: { in: reportIds },
        assignments: {
          some: { companyId: user.companyId, status: 'ACTIVE', isPrimary: true, endDate: null },
        },
      },
      select: {
        id: true, name: true, employeeNo: true,
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          include: {
            department: { select: { name: true } },
            jobGrade: { select: { name: true } },
          },
        },
      },
    })
```

**Step 1: Apply the edit**
**Step 2: Verify** — `npx tsc --noEmit`
**Step 3: Commit all performance changes**

```bash
git add src/app/api/v1/performance/team-goals/route.ts \
  src/app/api/v1/performance/evaluations/manager/route.ts \
  src/app/api/v1/performance/results/team/route.ts
git commit -m "fix(B-3): Performance APIs — position-based direct report filtering"
```

---

### Task 8: Fix Offboarding — manager notification via position lookup

**Files:**
- Modify: `src/app/api/v1/employees/[id]/offboarding/start/route.ts:218-220`

**Current (BROKEN):** `managerId` hardcoded to `null` — manager notification never sent.

**Fix:**

```typescript
// Add import at top (near other imports)
import { getManagerIdByPosition } from '@/lib/employee/direct-reports'

// Lines 218-220: Replace with:
    // Position-based manager lookup for notification
    const managerId = await getManagerIdByPosition(employeeId)
```

**Step 1: Apply the edit**
**Step 2: Verify** — `npx tsc --noEmit`
**Step 3: Commit**

```bash
git add src/app/api/v1/employees/[id]/offboarding/start/route.ts
git commit -m "fix(B-3): offboarding — position-based manager notification lookup"
```

---

## Part 2: Cross-Company READ Integration (4 changes across 4 files)

### Task 9: Manager Hub Summary — cross-company READ filter

**Files:**
- Modify: `src/app/api/v1/manager-hub/summary/route.ts`

**Current:** Uses `companyId` filter that restricts to primary company only. Managers with secondary assignments in other companies cannot see those employees.

**Fix:** After getting `reportIds` from position hierarchy, also include cross-company employees.

```typescript
// Add import at top
import { getCrossCompanyReadFilter } from '@/lib/api/cross-company-access'

// After line 35 (after reportIds is built), add cross-company employee IDs:
      // Cross-company: include employees from secondary/dotted-line relationships
      const crossCompanyFilter = await getCrossCompanyReadFilter({
        callerEmployeeId: managerId,
        callerRole: user.role,
        callerCompanyId: companyId,
      })
      const crossCompanyIds: string[] = crossCompanyFilter
        ? await prisma.employee.findMany({
            where: crossCompanyFilter,
            select: { id: true },
          }).then((rows) => rows.map((r) => r.id))
        : []
      const allReportIds = [...new Set([...reportIds, ...crossCompanyIds])]

// Then update the 3 queries that use `reportIds` + `companyId` filter:
// Change: `id: { in: reportIds }` → `id: { in: allReportIds }`
// Change: `some: { companyId, ... }` → remove `companyId` from assignment filter
//   (because cross-company employees are in different companies)
// Instead, use: `some: { status: 'ACTIVE', isPrimary: true, endDate: null }`
```

Specifically, modify lines 38-45, 48-55, 61-68 to replace `reportIds` with `allReportIds` and remove the `companyId` from the assignment `some` filter (cross-company employees are already security-verified by the helper).

**Step 1: Apply the edit**
**Step 2: Verify** — `npx tsc --noEmit`

---

### Task 10: Manager Hub Alerts — cross-company READ filter

**Files:**
- Modify: `src/app/api/v1/manager-hub/alerts/route.ts`

**Same pattern as Task 9.** After line 53 (reportIds built), add cross-company filter:

```typescript
// Add import at top
import { getCrossCompanyReadFilter } from '@/lib/api/cross-company-access'

// After reportIds is built:
      const crossCompanyFilter = await getCrossCompanyReadFilter({
        callerEmployeeId: managerId,
        callerRole: user.role,
        callerCompanyId: companyId,
      })
      const crossCompanyIds: string[] = crossCompanyFilter
        ? await prisma.employee.findMany({
            where: crossCompanyFilter,
            select: { id: true },
          }).then((rows) => rows.map((r) => r.id))
        : []
      const allReportIds = [...new Set([...reportIds, ...crossCompanyIds])]
```

Update `reportIds` → `allReportIds` and remove `companyId` from assignment filters in `teamMembers` query (lines 55-63).

**Step 1: Apply the edit**
**Step 2: Verify** — `npx tsc --noEmit`

---

### Task 11: Manager Hub Performance — cross-company READ filter

**Files:**
- Modify: `src/app/api/v1/manager-hub/performance/route.ts`

**Same pattern as Tasks 9-10.** After line 35 (reportIds built):

```typescript
// Add import at top
import { getCrossCompanyReadFilter } from '@/lib/api/cross-company-access'

// After reportIds:
      const crossCompanyFilter = await getCrossCompanyReadFilter({
        callerEmployeeId: managerId,
        callerRole: user.role,
        callerCompanyId: companyId,
      })
      const crossCompanyIds: string[] = crossCompanyFilter
        ? await prisma.employee.findMany({
            where: crossCompanyFilter,
            select: { id: true },
          }).then((rows) => rows.map((r) => r.id))
        : []
      const allReportIds = [...new Set([...reportIds, ...crossCompanyIds])]
```

Update `reportIds` → `allReportIds` and remove `companyId` from assignment filters (lines 37-45).

> **PATCH 3 적용:** 타 법인 직원의 성과 데이터가 0건으로 반환되는 버그 수정.
> `allReportIds`로 보안이 이미 검증되었으므로 하위 쿼리(latestCycle, evaluations, goals)에서도
> `companyId` 필터를 제거하거나, 타 법인 직원의 companyId도 포함하도록 확장해야 합니다.
>
> 구체적 수정:
> - `latestCycle` 쿼리: `companyId` 대신 타 법인 직원의 companyId도 포함하여 조회.
>   단, 타 법인 직원이 없으면 기존대로 caller의 companyId만 사용.
> - `evaluations` 쿼리: `companyId: user.companyId` → `employeeId: { in: allReportIds }` 로 범위 지정 (companyId 필터 제거)
> - `goals` 쿼리: 동일하게 `companyId` 필터 제거, `employeeId: { in: teamIds }` 로 보안 유지
>
> **핵심 원칙:** `allReportIds`가 이미 3중 보안 검증을 통과했으므로, 하위 쿼리에서 companyId로 이중 필터링하면 타 법인 데이터가 사라짐.

```typescript
      // Collect companyIds from allReportIds for performance cycle lookup
      const reportCompanyIds = allReportIds.length > 0
        ? await prisma.employeeAssignment.findMany({
            where: { employeeId: { in: allReportIds }, isPrimary: true, endDate: null },
            select: { companyId: true },
            distinct: ['companyId'],
          }).then((rows) => rows.map((r) => r.companyId))
        : [companyId]

      // Latest cycle — search across all relevant companies
      const latestCycle = await prisma.performanceCycle.findFirst({
        where: { companyId: { in: reportCompanyIds } },
        orderBy: { year: 'desc' },
      })

      // ... evaluations and goals queries: remove companyId filter, use employeeId: { in: teamIds }
```

**Step 1: Apply the edit**
**Step 2: Verify** — `npx tsc --noEmit`
**Step 3: Commit Manager Hub changes**

```bash
git add src/app/api/v1/manager-hub/summary/route.ts \
  src/app/api/v1/manager-hub/alerts/route.ts \
  src/app/api/v1/manager-hub/performance/route.ts
git commit -m "feat(B-3g): Manager Hub — cross-company READ filter integration"
```

---

### Task 12: Org Tree — cross-company visibility for secondary assignments

**Files:**
- Modify: `src/app/api/v1/org/tree/route.ts:58-63`

**Current:** SUPER_ADMIN sees all companies, others see only their primary company.

**Fix:** Allow MANAGER+ with secondary assignments to see those companies' org trees too.

```typescript
// Add imports at top
import { getCrossCompanyReadFilter } from '@/lib/api/cross-company-access'

// Lines 57-63: Replace companyFilter logic with:
    const companyIdParam = req.nextUrl.searchParams.get('companyId')

    let companyFilter: Record<string, unknown>
    if (user.role === 'SUPER_ADMIN') {
      companyFilter = companyIdParam ? { companyId: companyIdParam } : {}
    } else if (companyIdParam && companyIdParam !== user.companyId) {
      // Non-SUPER_ADMIN requesting another company's tree — verify cross-company access
      const crossFilter = await getCrossCompanyReadFilter({
        callerEmployeeId: user.employeeId,
        callerRole: user.role,
        callerCompanyId: user.companyId,
      })
      if (!crossFilter) {
        companyFilter = { companyId: user.companyId } // deny — show own company
      } else {
        // PATCH 2: Verify access via secondary assignment OR dotted-line relationship
        // 1. 내가 타 법인에 겸직(secondary) 중이거나
        // 2. 타 법인에 내 점선 보고자가 있거나
        const myPositionIds = await prisma.employeeAssignment.findMany({
          where: { employeeId: user.employeeId, endDate: null },
          select: { positionId: true },
        }).then((rows) => rows.map((r) => r.positionId).filter((id): id is string => id !== null))

        const hasAccess = await prisma.employeeAssignment.findFirst({
          where: {
            companyId: companyIdParam,
            endDate: null,
            OR: [
              // Case 1: 내가 해당 법인에 겸직 발령
              { isPrimary: false, employeeId: user.employeeId },
              // Case 2: 해당 법인에 내 점선 보고자가 있음
              ...(myPositionIds.length > 0
                ? [{ position: { dottedLinePositionId: { in: myPositionIds } } }]
                : []),
            ],
          },
        })
        companyFilter = hasAccess ? { companyId: companyIdParam } : { companyId: user.companyId }
      }
    } else {
      companyFilter = { companyId: user.companyId }
    }
```

**Step 1: Apply the edit**
**Step 2: Verify** — `npx tsc --noEmit`
**Step 3: Commit**

```bash
git add src/app/api/v1/org/tree/route.ts
git commit -m "feat(B-3g): Org Tree — cross-company visibility for secondary assignments"
```

---

## Part 3: Final Verification

### Task 13: Full TypeScript + Lint check

**Step 1:** `npx tsc --noEmit` — must be 0 errors
**Step 2:** `npm run lint` — no new warnings
**Step 3:** Verify no TODO comments remain in modified files

```bash
grep -n "TODO.*manager hierarchy\|TODO.*position.*reportsTo\|TODO.*getManagerByPosition" \
  src/app/api/v1/cfr/one-on-ones/dashboard/route.ts \
  src/app/api/v1/cfr/one-on-ones/route.ts \
  src/app/api/v1/performance/team-goals/route.ts \
  src/app/api/v1/performance/evaluations/manager/route.ts \
  src/app/api/v1/performance/results/team/route.ts \
  src/app/api/v1/employees/[id]/offboarding/start/route.ts
```

Expected: 0 matches

---

## Summary

| # | Task | File(s) | Type |
|---|------|---------|------|
| 1 | `getDirectReportIds` helper | `direct-reports.ts` (new) | Create |
| 2 | CFR 1:1 Dashboard | `cfr/one-on-ones/dashboard/route.ts` | Fix |
| 3 | CFR 1:1 POST | `cfr/one-on-ones/route.ts` | Fix |
| 4 | Performance Team Goals | `performance/team-goals/route.ts` | Fix |
| 5-6 | Performance Evaluations Manager GET+POST | `performance/evaluations/manager/route.ts` | Fix |
| 7 | Performance Results Team | `performance/results/team/route.ts` | Fix |
| 8 | Offboarding Manager Notification | `employees/[id]/offboarding/start/route.ts` | Fix |
| 9 | Manager Hub Summary | `manager-hub/summary/route.ts` | Enhance |
| 10 | Manager Hub Alerts | `manager-hub/alerts/route.ts` | Enhance |
| 11 | Manager Hub Performance | `manager-hub/performance/route.ts` | Enhance |
| 12 | Org Tree | `org/tree/route.ts` | Enhance |
| 13 | Final verification | — | Verify |

**Commits:** 6 atomic commits
**Files changed:** 11 (1 new + 10 modified)
**Risk:** Low — all changes are additive, existing helper patterns reused, no schema changes

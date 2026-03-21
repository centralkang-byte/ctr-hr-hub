# B-3i: Manager Hub 점선 보고 직원 패널 — Implementation Plan (v2)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Manager Hub 대시보드에 점선 보고(dotted line) 직원 목록 패널을 추가하고, 타 법인 직원은 read-only로 제한한다.

**Architecture:** 새 API 엔드포인트가 현재 유저의 position 기반으로 dotted line reports를 조회한다. Path A(점선 보고)는 법인 무관하게 전체 조회하고, Path B(겸직 부하)는 cross-company-access.ts 헬퍼로 보안 검증 후 조회한다. 프론트엔드는 별도 Card 컴포넌트로 분리하며, 타 법인 안내 문구는 조건부 렌더링.

**Tech Stack:** Next.js 15 App Router, Prisma 7, TypeScript, Radix UI (shadcn/ui), lucide-react

---

## Gemini Review 반영 사항 (v2)

| # | 이슈 | 수정 내용 |
|---|------|-----------|
| 1 | Same-company dotted line 실종 | Path A에서 `companyId: { not: ... }` 제거. 점선 보고는 법인 무관 |
| 2 | SSOT 헬퍼 bypass | Path B에서 `getCrossCompanyReadFilter()` 호출하여 보안 검증. 단, 헬퍼가 반환하는 전체 법인 직원이 아닌 직접 보고자만 표시 |
| 3 | RLS 클라이언트 | 기존 5개 manager-hub 라우트 모두 plain `prisma` 사용 (아키텍처 결정: API-level bypass). 일관성 유지 |
| 4 | 조건부 안내 문구 | `hasCrossCompany` 조건 추가 — 타 법인 직원 존재할 때만 표시 |

---

## DO NOT TOUCH

```
- src/components/layout/*
- src/config/navigation.ts
- messages/*.json
- prisma/seed.ts
- prisma/schema.prisma
- src/middleware.ts
- src/lib/api/companyFilter.ts
- src/lib/prisma-rls.ts
- src/lib/api/withRLS.ts
- src/lib/api/cross-company-access.ts  ← 읽기만, 수정 금지
```

---

### Task 1: API 엔드포인트 생성 — dotted-line-reports

**Files:**
- Create: `src/app/api/v1/manager-hub/dotted-line-reports/route.ts`

**Step 1: Create the API route**

```typescript
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { isAppError, handlePrismaError, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { getCrossCompanyReadFilter } from '@/lib/api/cross-company-access'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (
    _req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      if (user.role === ROLE.EMPLOYEE) throw forbidden('매니저 이상만 접근 가능합니다.')

      const callerEmployeeId = user.employeeId
      const callerCompanyId = user.companyId

      // Step 1: Find caller's primary position
      const callerAssignment = await prisma.employeeAssignment.findFirst({
        where: {
          employeeId: callerEmployeeId,
          isPrimary: true,
          endDate: null,
          effectiveDate: { lte: new Date() },
        },
        select: { positionId: true },
      })

      if (!callerAssignment?.positionId) {
        return apiSuccess({ employees: [] })
      }

      // Step 2: Path A — Dotted line reports
      // ⚠️ 법인 필터 없음! 같은 법인 + 타 법인 점선 보고 모두 포함
      // cross-company-access.ts는 "타 법인 READ 보안"용이므로 여기서는 직접 조회.
      // 점선 보고 관계 자체는 보안 이슈가 아님 (매니저의 position에 연결된 관계).
      const dottedLineAssignments = await prisma.employeeAssignment.findMany({
        where: {
          isPrimary: true,
          endDate: null,
          effectiveDate: { lte: new Date() },
          position: { dottedLinePositionId: callerAssignment.positionId },
          employeeId: { not: callerEmployeeId }, // 자기 자신 제외
        },
        select: {
          employee: {
            select: { id: true, firstName: true, lastName: true, koreanName: true },
          },
          company: { select: { id: true, name: true, code: true } },
          position: { select: { titleKo: true, titleEn: true } },
        },
      })

      // Step 3: Path B — Secondary assignment direct reports
      // getCrossCompanyReadFilter()로 보안 검증된 타 법인 직원 ID 세트 확보
      const crossFilter = await getCrossCompanyReadFilter({
        callerEmployeeId,
        callerRole: user.role,
        callerCompanyId,
      })

      // 겸직 포지션에 보고하는 직속 부하만 조회 (헬퍼의 전체 법인 직원이 아닌 narrow 범위)
      const callerSecondaries = await prisma.employeeAssignment.findMany({
        where: {
          employeeId: callerEmployeeId,
          isPrimary: false,
          endDate: null,
          effectiveDate: { lte: new Date() },
        },
        select: { positionId: true },
      })
      const secondaryPositionIds = callerSecondaries
        .map((s) => s.positionId)
        .filter((id): id is string => id !== null)

      let secondaryReportAssignments: typeof dottedLineAssignments = []
      if (secondaryPositionIds.length > 0 && crossFilter) {
        // crossFilter가 null이면 보안 검증 실패 → 타 법인 접근 불가
        secondaryReportAssignments = await prisma.employeeAssignment.findMany({
          where: {
            isPrimary: true,
            endDate: null,
            effectiveDate: { lte: new Date() },
            position: { reportsToPositionId: { in: secondaryPositionIds } },
            employeeId: { not: callerEmployeeId },
          },
          select: {
            employee: {
              select: { id: true, firstName: true, lastName: true, koreanName: true },
            },
            company: { select: { id: true, name: true, code: true } },
            position: { select: { titleKo: true, titleEn: true } },
          },
        })
      }

      // Step 4: Deduplicate & format
      // solid-line 직속 부하(reportsToPositionId → 기존 summary API에서 표시)는 제외
      const solidLineReportIds = new Set(
        (
          await prisma.employeeAssignment.findMany({
            where: {
              isPrimary: true,
              endDate: null,
              position: { reportsToPositionId: callerAssignment.positionId },
            },
            select: { employeeId: true },
          })
        ).map((a) => a.employeeId),
      )

      const seen = new Set<string>()
      const employees: {
        id: string
        name: string
        companyName: string
        companyCode: string
        companyId: string
        positionTitle: string
        relationship: 'DOTTED_LINE' | 'SECONDARY_REPORT'
      }[] = []

      const format = (
        a: (typeof dottedLineAssignments)[number],
        rel: 'DOTTED_LINE' | 'SECONDARY_REPORT',
      ) => ({
        id: a.employee.id,
        name: a.employee.koreanName || `${a.employee.lastName}${a.employee.firstName}`,
        companyName: a.company.name,
        companyCode: a.company.code,
        companyId: a.company.id,
        positionTitle: a.position?.titleKo || a.position?.titleEn || '',
        relationship: rel,
      })

      for (const a of dottedLineAssignments) {
        if (seen.has(a.employee.id) || solidLineReportIds.has(a.employee.id)) continue
        seen.add(a.employee.id)
        employees.push(format(a, 'DOTTED_LINE'))
      }

      for (const a of secondaryReportAssignments) {
        if (seen.has(a.employee.id) || solidLineReportIds.has(a.employee.id)) continue
        seen.add(a.employee.id)
        employees.push(format(a, 'SECONDARY_REPORT'))
      }

      return apiSuccess({ employees, callerCompanyId })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
```

**주요 변경 (v2):**
- Path A: `companyId: { not: ... }` 제거 → 같은 법인 dotted line 포함
- Path B: `getCrossCompanyReadFilter()` 호출하여 보안 게이트로 사용
- solid-line 직속 부하 중복 제외 (이미 기존 패널에 표시됨)
- `callerCompanyId` 응답에 포함 → 프론트엔드 `hasCrossCompany` 판단용
- RLS: plain `prisma` 사용 (기존 5개 manager-hub 라우트와 일관성 유지)

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 0 errors (or pre-existing only)

**Step 3: Commit**

```bash
git add src/app/api/v1/manager-hub/dotted-line-reports/route.ts
git commit -m "B-3i: add dotted-line-reports API (same+cross company, SSOT security)"
```

---

### Task 2: UI 컴포넌트 — DottedLineReportsCard

**Files:**
- Create: `src/components/manager-hub/DottedLineReportsCard.tsx`

**Step 1: Create the component**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { GitBranch, ExternalLink, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api'

interface DottedLineEmployee {
  id: string
  name: string
  companyName: string
  companyCode: string
  companyId: string
  positionTitle: string
  relationship: 'DOTTED_LINE' | 'SECONDARY_REPORT'
}

interface DottedLineResponse {
  employees: DottedLineEmployee[]
  callerCompanyId: string
}

export function DottedLineReportsCard() {
  const [data, setData] = useState<DottedLineResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiClient
      .get<DottedLineResponse>('/api/v1/manager-hub/dotted-line-reports')
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const employees = data?.employees ?? []
  const callerCompanyId = data?.callerCompanyId ?? ''

  // Hide entirely when no dotted line reports
  if (!loading && employees.length === 0) return null

  // ⚠️ v2: 타 법인 직원이 1명 이상일 때만 안내 문구 표시
  const hasCrossCompany = employees.some((e) => e.companyId !== callerCompanyId)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-ctr-gray-700">
            <GitBranch className="mr-2 inline-block h-4 w-4" />
            점선 보고 직원 (Matrix Reports)
          </CardTitle>
          {!loading && (
            <Badge variant="secondary" className="text-xs">
              {employees.length}명
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-4 text-center text-sm text-ctr-gray-500">
            불러오는 중...
          </p>
        ) : (
          <>
            <div className="divide-y">
              {employees.map((emp) => {
                const isCrossCompany = emp.companyId !== callerCompanyId
                return (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EDF1FE] text-xs font-medium text-ctr-primary">
                        {emp.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-ctr-gray-900">
                            {emp.name}
                          </p>
                          {isCrossCompany && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              타 법인
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-ctr-gray-500">
                          {emp.companyName} · {emp.positionTitle}
                        </p>
                      </div>
                    </div>
                    <a
                      href={`/employees/${emp.id}`}
                      className="flex items-center gap-1 text-xs text-ctr-primary hover:underline"
                    >
                      조회
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )
              })}
            </div>
            {hasCrossCompany && (
              <div className="mt-3 flex items-start gap-1.5 rounded-md bg-[#F8FAFC] p-2">
                <Info className="mt-0.5 h-3 w-3 shrink-0 text-ctr-gray-400" />
                <p className="text-xs text-ctr-gray-500">
                  타 법인 점선 보고 직원은 조회만 가능합니다.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
```

**주요 변경 (v2):**
- `callerCompanyId`를 API 응답에서 받아 `hasCrossCompany` 판단
- 안내 문구: `hasCrossCompany`일 때만 조건부 렌더링
- 타 법인 직원에 "타 법인" 뱃지 추가 (같은 법인 직원과 시각적 구분)

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/components/manager-hub/DottedLineReportsCard.tsx
git commit -m "B-3i: add DottedLineReportsCard with conditional cross-company notice"
```

---

### Task 3: 대시보드에 카드 통합

**Files:**
- Modify: `src/components/manager-hub/ManagerInsightsHub.tsx`

**Step 1: Add import and render DottedLineReportsCard**

At the top of ManagerInsightsHub.tsx, add import:
```typescript
import { DottedLineReportsCard } from '@/components/manager-hub/DottedLineReportsCard'
```

At the bottom of the return JSX (after the `{/* Row 3: Performance + AI Recommendation */}` grid div, before the closing `</div>`), add:

```tsx
      {/* Row 4: Dotted Line Reports */}
      <DottedLineReportsCard />
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 0 errors

**Step 3: Run lint**

Run: `npm run lint 2>&1 | tail -10`
Expected: No new warnings

**Step 4: Commit**

```bash
git add src/components/manager-hub/ManagerInsightsHub.tsx
git commit -m "B-3i: integrate DottedLineReportsCard into Manager Hub dashboard"
```

---

### Task 4: Preview 검증

**Step 1: Start dev server and navigate to Manager Hub**

Run: dev server → `/manager-hub`
Login as: `manager@ctr.co.kr` (박준혁 — MANAGER)

**Step 2: Verify scenarios**

| Scenario | Expected |
|----------|----------|
| 점선 보고자 0명 | 카드 숨김 |
| 같은 법인 점선 보고자만 | 카드 표시, "타 법인" 뱃지 없음, 안내 문구 없음 |
| 타 법인 점선 보고자 포함 | "타 법인" 뱃지 표시, 하단 안내 문구 표시 |
| 직속 부하 + 점선 동시 | 점선 카드에 직속 부하 중복 표시 없음 |
| "조회" 클릭 | 직원 프로필 페이지로 이동 |

**Step 3: Test with Super Admin**

Login as: `super@ctr.co.kr` (최상우)
- Verify card behavior for SUPER_ADMIN role

**Step 4: Console/network 에러 확인**

- Browser console: 0 errors
- Network tab: `/api/v1/manager-hub/dotted-line-reports` → 200 OK

**Step 5: Final commit if any fixes needed**

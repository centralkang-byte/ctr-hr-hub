# B-3l: 겸직 Assignment 추가/종료 Admin UI — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** HR Admin이 직원 상세 발령이력 탭에서 겸직(secondary assignment)을 추가/종료할 수 있는 UI + API 구현

**Architecture:** 기존 AssignmentHistoryTab에 겸직 현황 섹션 추가 (HR_ADMIN만). Dialog 2개 (추가/종료). REST API 2개 (POST/PATCH). Append-only 패턴 유지, 종료 시에만 endDate UPDATE 예외.

**Tech Stack:** Next.js 15 App Router, Prisma 7, React Hook Form + Zod, Radix UI Dialog, SWR

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
```

## Key References

| Purpose | File |
|---------|------|
| API response helpers | `src/lib/api.ts` — `apiSuccess()`, `apiError()` |
| Error factories | `src/lib/errors.ts` — `notFound()`, `forbidden()`, `badRequest()`, `conflict()` |
| Permission wrapper | `src/lib/permissions.ts` — `withPermission()`, `perm()` |
| Constants | `src/lib/constants.ts` — `MODULE`, `ACTION`, `ROLE` |
| Assignment helpers | `src/lib/employee/assignment-helpers.ts` — `fetchPrimaryAssignment()` |
| Prisma client | `src/lib/prisma.ts` — `prisma` singleton |
| History API pattern | `src/app/api/v1/employees/[id]/history/route.ts` |
| Current tab component | `src/components/employees/tabs/AssignmentHistoryTab.tsx` |
| Employee detail client | `src/app/(dashboard)/employees/[id]/EmployeeDetailClient.tsx` |
| Types | `src/types/assignment.ts` |
| UI components | `src/components/ui/` — Dialog, Button, Badge, Select, Input, Label |

## Security Rules (Gemini Review Patches)

1. **타 법인 겸직 추가 = SUPER_ADMIN 전용**. HR_ADMIN은 자기 법인 내 겸직만 추가 가능.
2. **겸직 종료 시 법인 스코프 검증**: HR_ADMIN은 대상 직원의 주 발령 법인이 자기 법인과 일치할 때만 종료 가능.
3. **isPrimary=false 강제**: 주 발령은 절대 이 API로 종료 불가.

---

### Task 1: POST 겸직 추가 API

**Files:**
- Create: `src/app/api/v1/employees/[id]/assignments/concurrent/route.ts`

**Step 1: Create the API route file**

```typescript
// src/app/api/v1/employees/[id]/assignments/concurrent/route.ts
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, conflict, forbidden, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { fetchPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

export const POST = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id: employeeId } = await context.params

    // 1. Role check: HR_ADMIN or SUPER_ADMIN only
    if (user.role !== ROLE.SUPER_ADMIN && user.role !== ROLE.HR_ADMIN) {
      throw forbidden('겸직 추가 권한이 없습니다.')
    }

    // 2. Parse & validate body
    const body = await req.json()
    const { companyId, departmentId, jobGradeId, positionId, employmentType, effectiveDate, reason } = body

    if (!companyId || !effectiveDate) {
      throw badRequest('법인과 발효일은 필수입니다.')
    }

    // 3. Gemini #1: HR_ADMIN can only add concurrent within own company
    if (user.role === ROLE.HR_ADMIN && companyId !== user.companyId) {
      throw forbidden('타 법인 겸직 추가는 최고관리자만 가능합니다.')
    }

    // 4. Verify employee exists
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { id: true },
    })
    if (!employee) throw notFound('직원을 찾을 수 없습니다.')

    // 5. Gemini #3: HR_ADMIN scope — employee's primary assignment must be in caller's company
    if (user.role === ROLE.HR_ADMIN) {
      const primary = await fetchPrimaryAssignment(employeeId)
      if (!primary || primary.companyId !== user.companyId) {
        throw forbidden('해당 직원의 겸직을 관리할 권한이 없습니다.')
      }
    }

    // 6. Duplicate check — same company + department + position active concurrent
    const duplicate = await prisma.employeeAssignment.findFirst({
      where: {
        employeeId,
        isPrimary: false,
        endDate: null,
        companyId,
        ...(departmentId ? { departmentId } : {}),
        ...(positionId ? { positionId } : {}),
      },
    })
    if (duplicate) throw conflict('동일한 겸직이 이미 존재합니다.')

    // 7. Create concurrent assignment
    const assignment = await prisma.employeeAssignment.create({
      data: {
        employeeId,
        effectiveDate: new Date(effectiveDate),
        endDate: null,
        changeType: 'CONCURRENT',
        companyId,
        departmentId: departmentId || null,
        jobGradeId: jobGradeId || null,
        positionId: positionId || null,
        employmentType: employmentType || 'FULL_TIME',
        status: 'ACTIVE',
        isPrimary: false,
        reason: reason || null,
        approvedBy: user.id,
      },
      include: {
        company: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        jobGrade: { select: { id: true, name: true } },
        position: { select: { id: true, titleKo: true, titleEn: true } },
      },
    })

    return apiSuccess(assignment, 201)
  },
  perm(MODULE.EMPLOYEES, ACTION.MANAGE),
)
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 0 errors (or only pre-existing errors unrelated to this file)

**Step 3: Commit**

```bash
git add src/app/api/v1/employees/[id]/assignments/concurrent/route.ts
git commit -m "feat(b-3l): add POST /employees/[id]/assignments/concurrent API"
```

---

### Task 2: PATCH 겸직 종료 API

**Files:**
- Create: `src/app/api/v1/employees/[id]/assignments/[assignmentId]/end/route.ts`

**Step 1: Create the API route file**

```typescript
// src/app/api/v1/employees/[id]/assignments/[assignmentId]/end/route.ts
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { fetchPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

export const PATCH = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id: employeeId, assignmentId } = await context.params

    // 1. Role check
    if (user.role !== ROLE.SUPER_ADMIN && user.role !== ROLE.HR_ADMIN) {
      throw forbidden('겸직 종료 권한이 없습니다.')
    }

    // 2. Parse body
    const body = await req.json()
    const { endDate, reason } = body

    if (!endDate) {
      throw badRequest('종료일은 필수입니다.')
    }

    // 3. Find the assignment + validate it belongs to the employee
    const assignment = await prisma.employeeAssignment.findFirst({
      where: { id: assignmentId, employeeId },
    })
    if (!assignment) throw notFound('해당 겸직 발령을 찾을 수 없습니다.')

    // 4. Must be secondary (isPrimary=false) — prevent primary termination
    if (assignment.isPrimary) {
      throw badRequest('주 발령은 이 API로 종료할 수 없습니다.')
    }

    // 5. Must not already be ended
    if (assignment.endDate !== null) {
      throw badRequest('이미 종료된 겸직입니다.')
    }

    // 6. endDate must be >= effectiveDate
    const endDateObj = new Date(endDate)
    if (endDateObj < assignment.effectiveDate) {
      throw badRequest('종료일은 발효일 이후여야 합니다.')
    }

    // 7. Gemini #3: HR_ADMIN scope verification
    if (user.role === ROLE.HR_ADMIN) {
      const primary = await fetchPrimaryAssignment(employeeId)
      if (!primary || primary.companyId !== user.companyId) {
        throw forbidden('해당 직원의 겸직을 관리할 권한이 없습니다.')
      }
    }

    // 8. Update endDate (Append-only exception: only sets endDate on existing row)
    const updated = await prisma.employeeAssignment.update({
      where: { id: assignmentId },
      data: {
        endDate: endDateObj,
        reason: reason || assignment.reason,
      },
      include: {
        company: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        jobGrade: { select: { id: true, name: true } },
      },
    })

    return apiSuccess(updated)
  },
  perm(MODULE.EMPLOYEES, ACTION.MANAGE),
)
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 0 errors

**Step 3: Commit**

```bash
git add src/app/api/v1/employees/[id]/assignments/[assignmentId]/end/route.ts
git commit -m "feat(b-3l): add PATCH /employees/[id]/assignments/[assignmentId]/end API"
```

---

### Task 3: 겸직 추가 Dialog 컴포넌트

**Files:**
- Create: `src/components/employees/dialogs/AddConcurrentDialog.tsx`

**Step 1: Create the dialog component**

This dialog needs:
- Props: `employeeId`, `open`, `onOpenChange`, `onSuccess`, `userRole`, `userCompanyId`
- Fields: 법인 (company select), 부서 (dept select filtered by company), 직급 (jobGrade select), 직책 (position select), 고용형태 (employment type select), 발효일 (date input), 사유 (text input)
- **SUPER_ADMIN**: company dropdown shows all companies
- **HR_ADMIN**: company dropdown only shows their own company (1 option, locked)
- On submit: POST `/api/v1/employees/{employeeId}/assignments/concurrent`
- On success: call `onSuccess()`, close dialog, show toast

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiClient } from '@/lib/api'
import { ROLE } from '@/lib/constants'
import { toast } from '@/hooks/use-toast'

interface AddConcurrentDialogProps {
  employeeId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  userRole: string
  userCompanyId: string
}

interface RefItem {
  id: string
  name: string
  code?: string
  companyId?: string
}

const EMPLOYMENT_TYPES = [
  { value: 'FULL_TIME', label: '정규직' },
  { value: 'CONTRACT', label: '계약직' },
  { value: 'DISPATCH', label: '파견직' },
  { value: 'INTERN', label: '인턴' },
]

export function AddConcurrentDialog({
  employeeId,
  open,
  onOpenChange,
  onSuccess,
  userRole,
  userCompanyId,
}: AddConcurrentDialogProps) {
  const isSuperAdmin = userRole === ROLE.SUPER_ADMIN

  // ─── Form state ───
  const [companyId, setCompanyId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [jobGradeId, setJobGradeId] = useState('')
  const [positionId, setPositionId] = useState('')
  const [employmentType, setEmploymentType] = useState('FULL_TIME')
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10)
  )
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ─── Lookup data ───
  const [companies, setCompanies] = useState<RefItem[]>([])
  const [departments, setDepartments] = useState<RefItem[]>([])
  const [jobGrades, setJobGrades] = useState<RefItem[]>([])
  const [positions, setPositions] = useState<RefItem[]>([])

  // ─── Load companies on open ───
  useEffect(() => {
    if (!open) return
    // Reset form
    setCompanyId(isSuperAdmin ? '' : userCompanyId)
    setDepartmentId('')
    setJobGradeId('')
    setPositionId('')
    setEmploymentType('FULL_TIME')
    setEffectiveDate(new Date().toISOString().slice(0, 10))
    setReason('')
    setError(null)

    // Fetch companies
    apiClient
      .get<{ companies: RefItem[] }>('/api/v1/companies')
      .then((res) => {
        const list = res.data.companies ?? res.data
        if (isSuperAdmin) {
          setCompanies(Array.isArray(list) ? list : [])
        } else {
          // HR_ADMIN: only their own company
          const own = (Array.isArray(list) ? list : []).filter(
            (c: RefItem) => c.id === userCompanyId
          )
          setCompanies(own)
        }
      })
      .catch(() => setCompanies([]))
  }, [open, isSuperAdmin, userCompanyId])

  // ─── Load departments when company changes ───
  useEffect(() => {
    if (!companyId) {
      setDepartments([])
      return
    }
    setDepartmentId('')
    setPositionId('')
    apiClient
      .get<{ departments: RefItem[] }>(`/api/v1/departments?companyId=${companyId}`)
      .then((res) => {
        const list = res.data.departments ?? res.data
        setDepartments(Array.isArray(list) ? list : [])
      })
      .catch(() => setDepartments([]))
  }, [companyId])

  // ─── Load job grades ───
  useEffect(() => {
    if (!open) return
    apiClient
      .get<{ jobGrades: RefItem[] }>('/api/v1/job-grades')
      .then((res) => {
        const list = res.data.jobGrades ?? res.data
        setJobGrades(Array.isArray(list) ? list : [])
      })
      .catch(() => setJobGrades([]))
  }, [open])

  // ─── Load positions when company + department changes ───
  useEffect(() => {
    if (!companyId) {
      setPositions([])
      return
    }
    setPositionId('')
    const params = new URLSearchParams({ companyId })
    if (departmentId) params.set('departmentId', departmentId)
    apiClient
      .get<{ positions: RefItem[] }>(`/api/v1/positions?${params}`)
      .then((res) => {
        const list = res.data.positions ?? res.data
        setPositions(Array.isArray(list) ? list : [])
      })
      .catch(() => setPositions([]))
  }, [companyId, departmentId])

  // ─── Submit ───
  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    try {
      await apiClient.post(
        `/api/v1/employees/${employeeId}/assignments/concurrent`,
        {
          companyId,
          departmentId: departmentId || null,
          jobGradeId: jobGradeId || null,
          positionId: positionId || null,
          employmentType,
          effectiveDate,
          reason: reason || null,
        }
      )
      toast({ title: '겸직이 추가되었습니다.', variant: 'default' })
      onSuccess()
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '겸직 추가에 실패했습니다.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }, [employeeId, companyId, departmentId, jobGradeId, positionId, employmentType, effectiveDate, reason, onSuccess, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>겸직 추가</DialogTitle>
        </DialogHeader>

        {error && (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="space-y-4">
          {/* 법인 */}
          <div className="space-y-1.5">
            <Label>법인 <span className="text-destructive">*</span></Label>
            <Select
              value={companyId || '__NONE__'}
              onValueChange={(v) => setCompanyId(v === '__NONE__' ? '' : v)}
              disabled={!isSuperAdmin && companies.length <= 1}
            >
              <SelectTrigger><SelectValue placeholder="법인 선택" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__NONE__">선택하세요</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 부서 */}
          <div className="space-y-1.5">
            <Label>부서</Label>
            <Select
              value={departmentId || '__NONE__'}
              onValueChange={(v) => setDepartmentId(v === '__NONE__' ? '' : v)}
              disabled={!companyId}
            >
              <SelectTrigger><SelectValue placeholder="부서 선택" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__NONE__">선택하세요</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 직급 */}
          <div className="space-y-1.5">
            <Label>직급</Label>
            <Select
              value={jobGradeId || '__NONE__'}
              onValueChange={(v) => setJobGradeId(v === '__NONE__' ? '' : v)}
            >
              <SelectTrigger><SelectValue placeholder="직급 선택" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__NONE__">선택하세요</SelectItem>
                {jobGrades.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 직책 */}
          <div className="space-y-1.5">
            <Label>직책(Position)</Label>
            <Select
              value={positionId || '__NONE__'}
              onValueChange={(v) => setPositionId(v === '__NONE__' ? '' : v)}
              disabled={!companyId}
            >
              <SelectTrigger><SelectValue placeholder="직책 선택" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__NONE__">선택하세요</SelectItem>
                {positions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 고용형태 */}
          <div className="space-y-1.5">
            <Label>고용형태</Label>
            <Select value={employmentType} onValueChange={setEmploymentType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EMPLOYMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 발효일 */}
          <div className="space-y-1.5">
            <Label>발효일 <span className="text-destructive">*</span></Label>
            <Input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </div>

          {/* 사유 */}
          <div className="space-y-1.5">
            <Label>사유</Label>
            <Input
              placeholder="겸직 사유 입력"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            취소
          </Button>
          <Button
            className="bg-ctr-primary hover:bg-ctr-primary-dark text-white"
            disabled={!companyId || !effectiveDate || submitting}
            onClick={handleSubmit}
          >
            {submitting ? '처리 중...' : '추가'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 3: Commit**

```bash
git add src/components/employees/dialogs/AddConcurrentDialog.tsx
git commit -m "feat(b-3l): add concurrent assignment dialog component"
```

---

### Task 4: 겸직 종료 Dialog 컴포넌트

**Files:**
- Create: `src/components/employees/dialogs/EndConcurrentDialog.tsx`

**Step 1: Create the dialog component**

```tsx
'use client'

import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

interface ConcurrentAssignment {
  id: string
  companyName: string
  departmentName: string | null
  positionTitle: string | null
  effectiveDate: string
}

interface EndConcurrentDialogProps {
  employeeId: string
  assignment: ConcurrentAssignment | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EndConcurrentDialog({
  employeeId,
  assignment,
  open,
  onOpenChange,
  onSuccess,
}: EndConcurrentDialogProps) {
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(async () => {
    if (!assignment) return
    setSubmitting(true)
    setError(null)
    try {
      await apiClient.patch(
        `/api/v1/employees/${employeeId}/assignments/${assignment.id}/end`,
        {
          endDate,
          reason: reason || null,
        }
      )
      toast({ title: '겸직이 종료되었습니다.', variant: 'default' })
      onSuccess()
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '겸직 종료에 실패했습니다.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }, [employeeId, assignment, endDate, reason, onSuccess, onOpenChange])

  if (!assignment) return null

  const label = [assignment.companyName, assignment.departmentName, assignment.positionTitle]
    .filter(Boolean)
    .join(' · ')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>겸직 종료</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-[#333]">
          <span className="font-semibold">{label}</span> 겸직을 종료합니다.
        </p>

        {error && (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>종료일 <span className="text-destructive">*</span></Label>
            <Input
              type="date"
              value={endDate}
              min={assignment.effectiveDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>사유</Label>
            <Input
              placeholder="종료 사유 입력"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            취소
          </Button>
          <Button
            variant="destructive"
            disabled={!endDate || submitting}
            onClick={handleSubmit}
          >
            {submitting ? '처리 중...' : '종료'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 3: Commit**

```bash
git add src/components/employees/dialogs/EndConcurrentDialog.tsx
git commit -m "feat(b-3l): add end concurrent assignment dialog component"
```

---

### Task 5: AssignmentHistoryTab 확장 — 겸직 현황 섹션 + 타임라인 뱃지

**Files:**
- Modify: `src/components/employees/tabs/AssignmentHistoryTab.tsx`

**Step 1: Add concurrent section + badges**

Key changes to the existing `AssignmentHistoryTab.tsx`:

1. **Add CONCURRENT to CHANGE_TYPE_LABELS**:
```typescript
CONCURRENT: '겸직발령',
```

2. **Add `isPrimary` field to `AssignmentRecord` interface**:
```typescript
isPrimary: boolean
```

3. **Filter active concurrent assignments from loaded data** (no extra API call — history API already returns all):
```typescript
const activeConcurrents = assignments.filter(
  (a) => !a.isPrimary && a.endDate === null
)
```

4. **Add ConcurrentStatusSection** component (rendered above timeline, HR_ADMIN only):
- Shows list of active concurrent assignments
- Each row: company name · dept name · position · effectiveDate ~ , with [종료] button
- Bottom: [+ 겸직 추가] button
- If 0 concurrent: show "현재 활성 겸직이 없습니다." with add button

5. **Modify `toTimelineEvent` function** to add isPrimary badge info:
- Add `isPrimary` to the `details` passed through
- Timeline title: prepend `[주]` or `[겸직]` badge

6. **Gemini #2: Dual render for concurrent with endDate** — in the `events` mapping, for each CONCURRENT assignment that has endDate, generate TWO timeline events:
   - Event 1: effectiveDate → "겸직 시작"
   - Event 2: endDate → "겸직 종료"

7. **Import and render AddConcurrentDialog + EndConcurrentDialog**:
- State: `addDialogOpen`, `endDialogOpen`, `endTarget`
- On success: re-fetch history

**Full implementation approach** (the subagent should read the current file and apply these changes surgically — DO NOT rewrite the entire file):

a. Add to imports: `AddConcurrentDialog`, `EndConcurrentDialog`, `Plus` from lucide-react
b. Add `isPrimary: boolean` to `AssignmentRecord` interface
c. Add `CONCURRENT: '겸직발령'` to `CHANGE_TYPE_LABELS`
d. Create `ConcurrentStatusSection` as internal component
e. Modify `toTimelineEvent` to include `[주]`/`[겸직]` prefix in title
f. Add dual-event logic for concurrent with endDate
g. Add dialog state and handlers to main component
h. Render ConcurrentStatusSection above timeline (inside isHrAdmin check)
i. Render both dialogs at bottom

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 3: Verify lint passes**

Run: `npm run lint 2>&1 | tail -10`

**Step 4: Commit**

```bash
git add src/components/employees/tabs/AssignmentHistoryTab.tsx
git commit -m "feat(b-3l): add concurrent status section and badges to assignment history tab"
```

---

### Task 6: EmployeeDetailClient — Pass user props to AssignmentHistoryTab

**Files:**
- Modify: `src/app/(dashboard)/employees/[id]/EmployeeDetailClient.tsx`

**Step 1: Check if user props are already passed**

Looking at the current code (line 553):
```tsx
<AssignmentHistoryTab
  employeeId={employee.id}
  hireDate={employee.hireDate}
  user={user}
/>
```

The `user` prop is already passed. The `AssignmentHistoryTab` already receives `user.role` and `user.companyId` through the `SessionUser` type. **No changes needed** to EmployeeDetailClient unless the AssignmentHistoryTab props interface changes.

Verify: If Task 5 added new required props (e.g., `companyId`), add them here. Otherwise, this task is a no-op.

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

---

### Task 7: Lookup API 확인 — companies, departments, positions, job-grades

**Files:**
- Check: `src/app/api/v1/companies/route.ts`
- Check: `src/app/api/v1/departments/route.ts`
- Check: `src/app/api/v1/positions/route.ts`
- Check: `src/app/api/v1/job-grades/route.ts`

**Step 1: Verify lookup APIs exist and support query params**

The AddConcurrentDialog calls these APIs to populate dropdowns:
- `GET /api/v1/companies` — all companies list
- `GET /api/v1/departments?companyId=X` — departments filtered by company
- `GET /api/v1/positions?companyId=X&departmentId=Y` — positions filtered
- `GET /api/v1/job-grades` — all job grades

**Verify each exists**. If any is missing or doesn't support the expected query params, create/modify it.

**Important**: For HR_ADMIN, the departments/positions APIs might filter by user's company. Since we already restrict company selection to own company for HR_ADMIN in the dialog, this should work. But verify.

If positions API doesn't exist or doesn't support filtering:
- Create a minimal `GET /api/v1/positions/route.ts` that accepts `companyId` and `departmentId` query params
- Returns `{ positions: [{ id, name (titleKo), code }] }`

**Step 2: Commit if changes made**

```bash
git add src/app/api/v1/positions/route.ts  # if created
git commit -m "feat(b-3l): add/fix lookup APIs for concurrent assignment dialog"
```

---

### Task 8: Preview 검증

**Step 1: Start dev server if not running**

Run: `npm run dev`

**Step 2: Test with SUPER_ADMIN account (super@ctr.co.kr)**

1. Navigate to `/employees` → pick an employee with concurrent assignments (e.g., 이동옥)
2. Go to 발령이력 tab
3. Verify: 겸직 현황 섹션 visible with active concurrents listed
4. Verify: Timeline shows [주]/[겸직] badges
5. Click "겸직 추가" → Dialog opens with all companies in dropdown
6. Click "종료" on a concurrent → EndConcurrentDialog opens

**Step 3: Test with HR_ADMIN account (hr@ctr.co.kr)**

1. Navigate to same employee
2. Verify: 겸직 추가 dialog only shows CTR in company dropdown
3. Verify: Cannot add concurrent to CTR-CN (only own company)

**Step 4: Test with EMPLOYEE account (employee-a@ctr.co.kr)**

1. Navigate to own profile → 발령이력
2. Verify: 겸직 현황 섹션 NOT visible (no add/end buttons)
3. Verify: Timeline still shows [주]/[겸직] badges (read-only)

**Step 5: Commit any fixes**

---

### Task 9: API 보안 테스트

**Step 1: Test isPrimary protection**

```bash
# Try to end a PRIMARY assignment via the API — should return 400
curl -X PATCH http://localhost:3002/api/v1/employees/{employeeId}/assignments/{primaryAssignmentId}/end \
  -H 'Content-Type: application/json' \
  -d '{"endDate": "2026-03-20"}'
```

Expected: `400 Bad Request` — "주 발령은 이 API로 종료할 수 없습니다."

**Step 2: Test duplicate concurrent prevention**

Attempt to POST the exact same concurrent assignment twice.
Expected: `409 Conflict` — "동일한 겸직이 이미 존재합니다."

**Step 3: Test HR_ADMIN cross-company restriction**

As HR_ADMIN (hr@ctr.co.kr), try to POST a concurrent with companyId of CTR-CN.
Expected: `403 Forbidden` — "타 법인 겸직 추가는 최고관리자만 가능합니다."

**Step 4: Final commit**

```bash
git commit -m "feat(b-3l): concurrent assignment admin UI complete"
```

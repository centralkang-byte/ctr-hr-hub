# STEP5 채용 ATS + 징계·상벌 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** CTR HR Hub에 채용 ATS(파이프라인 칸반, AI 이력서 분석, 면접 평가) + 징계·상벌 관리 + 역량 라이브러리를 구현한다.

**Architecture:** Prisma 스키마 확장 → 징계/포상 CRUD(Phase 1) → 채용공고/역량/AI(Phase 2) → 지원자/칸반/AI분석(Phase 3) → 면접/대시보드(Phase 4) 순으로 점진적 구현. 기존 `withPermission` + `apiSuccess/apiPaginated` 패턴 준수.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Prisma + PostgreSQL, Zod validation, react-hook-form, Recharts (funnel chart), HTML5 Drag & Drop (kanban), Claude AI (lib/claude.ts)

---

## Phase 1: Prisma 스키마 + 징계/포상 CRUD

### Task 1: Prisma 스키마 확장 — Enum 추가

**Files:**
- Modify: `prisma/schema.prisma` (enum sections ~lines 270, 407)
- Modify: `src/types/index.ts` (re-export new enums)

**Step 1: Add new enums and extend existing enums in schema.prisma**

Add to `ApplicationStage` (after `INTERVIEW_2`, before `OFFER`):
```prisma
enum ApplicationStage {
  APPLIED
  SCREENING
  INTERVIEW_1
  INTERVIEW_2
  FINAL        // ← 추가
  OFFER
  HIRED
  REJECTED
}
```

Add to `AiFeature`:
```prisma
enum AiFeature {
  // ... existing values ...
  JOB_DESCRIPTION_GENERATION
  RESUME_ANALYSIS
}
```

Add to `DisciplinaryCategory`:
```prisma
enum DisciplinaryCategory {
  ATTENDANCE
  SAFETY
  QUALITY
  CONDUCT
  POLICY_VIOLATION
  MISCONDUCT       // ← 추가
  HARASSMENT       // ← 추가
  FRAUD            // ← 추가
  OTHER
}
```

Add to `RewardType`:
```prisma
enum RewardType {
  // ... existing values ...
  CTR_VALUE_AWARD  // ← 추가
}
```

Add NEW enums:
```prisma
enum WorkMode {
  OFFICE
  REMOTE
  HYBRID
}

enum InterviewType {
  PHONE
  VIDEO
  ONSITE
  PANEL
}

enum InterviewRound {
  FIRST
  SECOND
  FINAL
}

enum DisciplinaryStatus {
  ACTIVE
  EXPIRED
  OVERTURNED
}
```

**Step 2: Re-export new enums in `src/types/index.ts`**

Add to the enum re-exports:
```typescript
export {
  // ... existing ...
  type WorkMode,
  type InterviewType,
  type InterviewRound,
  type DisciplinaryStatus,
} from '@/generated/prisma/enums'
```

**Step 3: Run `npx prisma generate` to check enum changes compile**

Run: `cd /Users/sangwoo/Documents/VibeCoding/GHR/ctr-hr-hub && npx prisma generate`
Expected: No errors

---

### Task 2: Prisma 스키마 확장 — Model 필드 추가

**Files:**
- Modify: `prisma/schema.prisma` (models: JobPosting ~1526, Applicant ~1556, Application ~1570, InterviewSchedule ~1592, DisciplinaryAction ~1219, RewardRecord ~1248)

**Step 1: Add fields to JobPosting model**

After `salaryRangeMax` line (~1538):
```prisma
  preferred             String?        @map("preferred")
  headcount             Int            @default(1)
  workMode              WorkMode?      @map("work_mode")
  recruiterId           String?        @map("recruiter_id")
  deadlineDate          DateTime?      @map("deadline_date")
  salaryHidden          Boolean        @default(false) @map("salary_hidden")
  requiredCompetencies  Json?          @map("required_competencies")
```

Add relation for recruiter (after `creator` relation):
```prisma
  recruiter    Employee?     @relation("JobPostingRecruiter", fields: [recruiterId], references: [id])
```

NOTE: Must add corresponding `jobPostingsAsRecruiter JobPosting[] @relation("JobPostingRecruiter")` to Employee model.

**Step 2: Add fields to Applicant model**

After `source` line (~1562):
```prisma
  portfolioUrl String?  @map("portfolio_url")
  memo         String?
```

**Step 3: Add fields to Application model**

After `convertedAt` line (~1579):
```prisma
  offeredSalary     Decimal?   @map("offered_salary")
  offeredDate       DateTime?  @map("offered_date")
  expectedStartDate DateTime?  @map("expected_start_date")
```

**Step 4: Add fields to InterviewSchedule model**

After `meetingLink` line (~1599):
```prisma
  interviewType InterviewType? @map("interview_type")
  round         InterviewRound? @map("round")
```

**Step 5: Add fields to DisciplinaryAction model**

After `appealResult` line (~1236):
```prisma
  status                DisciplinaryStatus @default(ACTIVE)
  validMonths           Int?                @map("valid_months")
  expiresAt             DateTime?           @map("expires_at")
  appealText            String?             @map("appeal_text")
  demotionGradeId       String?             @map("demotion_grade_id")
  salaryReductionRate   Decimal?            @map("salary_reduction_rate")
  salaryReductionMonths Int?                @map("salary_reduction_months")
```

Add relation for demotionGrade:
```prisma
  demotionGrade JobGrade? @relation("DisciplinaryDemotionGrade", fields: [demotionGradeId], references: [id])
```

NOTE: Must add `disciplinaryDemotions DisciplinaryAction[] @relation("DisciplinaryDemotionGrade")` to JobGrade model.

**Step 6: Add fields to RewardRecord model**

After `documentKey` line (~1258):
```prisma
  ctrValue     String?  @map("ctr_value")
  serviceYears Int?     @map("service_years")
```

**Step 7: Add relation fields to Employee model**

Find Employee model and add:
```prisma
  jobPostingsAsRecruiter JobPosting[]        @relation("JobPostingRecruiter")
```

**Step 8: Add relation field to JobGrade model**

Find JobGrade model and add:
```prisma
  disciplinaryDemotions DisciplinaryAction[] @relation("DisciplinaryDemotionGrade")
```

**Step 9: Create and run migration**

Run: `cd /Users/sangwoo/Documents/VibeCoding/GHR/ctr-hr-hub && npx prisma migrate dev --name step5_recruitment_discipline`
Expected: Migration applied successfully

**Step 10: Verify generate**

Run: `npx prisma generate`
Expected: No errors

**Step 11: Commit**

```bash
git add prisma/schema.prisma src/types/index.ts
git commit -m "feat(step5): extend Prisma schema for recruitment ATS + discipline/rewards"
```

---

### Task 3: 징계 API — GET + POST `/api/v1/disciplinary`

**Files:**
- Create: `src/app/api/v1/disciplinary/route.ts`

**Step 1: Create disciplinary list + create API route**

```typescript
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess, apiPaginated, buildPagination, apiError } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { MODULE, ACTION, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'
import { ROLE } from '@/lib/constants'

const createSchema = z.object({
  employeeId: z.string().uuid(),
  actionType: z.enum([
    'VERBAL_WARNING', 'WRITTEN_WARNING', 'REPRIMAND',
    'SUSPENSION', 'PAY_CUT', 'DEMOTION', 'TERMINATION',
  ]),
  category: z.enum([
    'ATTENDANCE', 'SAFETY', 'QUALITY', 'CONDUCT',
    'POLICY_VIOLATION', 'MISCONDUCT', 'HARASSMENT', 'FRAUD', 'OTHER',
  ]),
  incidentDate: z.string().datetime(),
  description: z.string().min(1),
  evidenceKeys: z.array(z.string()).optional(),
  committeeDate: z.string().datetime().optional(),
  committeeMembers: z.array(z.string()).optional(),
  decision: z.string().optional(),
  decisionDate: z.string().datetime().optional(),
  suspensionStart: z.string().datetime().optional(),
  suspensionEnd: z.string().datetime().optional(),
  validMonths: z.number().int().positive().optional(),
  demotionGradeId: z.string().uuid().optional(),
  salaryReductionRate: z.number().min(0).max(100).optional(),
  salaryReductionMonths: z.number().int().positive().optional(),
})

export const GET = withPermission(
  async (req, _context, user) => {
    const url = new URL(req.url)
    const page = Number(url.searchParams.get('page')) || DEFAULT_PAGE
    const limit = Number(url.searchParams.get('limit')) || DEFAULT_PAGE_SIZE
    const search = url.searchParams.get('search') || undefined
    const status = url.searchParams.get('status') || undefined
    const category = url.searchParams.get('category') || undefined

    const companyFilter =
      user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const where = {
      ...companyFilter,
      deletedAt: null,
      ...(status ? { status: status as 'ACTIVE' | 'EXPIRED' | 'OVERTURNED' } : {}),
      ...(category ? { category: category as string } : {}),
      ...(search
        ? {
            OR: [
              { employee: { name: { contains: search, mode: 'insensitive' as const } } },
              { description: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [data, total] = await Promise.all([
      prisma.disciplinaryAction.findMany({
        where,
        include: {
          employee: { select: { id: true, name: true, employeeCode: true } },
          issuer: { select: { id: true, name: true } },
          demotionGrade: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.disciplinaryAction.count({ where }),
    ])

    return apiPaginated(data, buildPagination(page, limit, total))
  },
  perm(MODULE.DISCIPLINE, ACTION.VIEW),
)

export const POST = withPermission(
  async (req, _context, user) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)

    if (!parsed.success) {
      return apiError(badRequest('입력값이 올바르지 않습니다.', {
        errors: parsed.error.flatten().fieldErrors,
      }))
    }

    const data = parsed.data

    // Calculate expiresAt from validMonths
    let expiresAt: Date | undefined
    if (data.validMonths) {
      const base = data.decisionDate ? new Date(data.decisionDate) : new Date()
      expiresAt = new Date(base)
      expiresAt.setMonth(expiresAt.getMonth() + data.validMonths)
    }

    const created = await prisma.disciplinaryAction.create({
      data: {
        employeeId: data.employeeId,
        companyId: user.companyId,
        actionType: data.actionType,
        category: data.category,
        incidentDate: new Date(data.incidentDate),
        description: data.description,
        evidenceKeys: data.evidenceKeys ?? [],
        committeeDate: data.committeeDate ? new Date(data.committeeDate) : null,
        committeeMembers: data.committeeMembers ?? null,
        decision: data.decision ?? null,
        decisionDate: data.decisionDate ? new Date(data.decisionDate) : null,
        suspensionStart: data.suspensionStart ? new Date(data.suspensionStart) : null,
        suspensionEnd: data.suspensionEnd ? new Date(data.suspensionEnd) : null,
        validMonths: data.validMonths ?? null,
        expiresAt: expiresAt ?? null,
        demotionGradeId: data.demotionGradeId ?? null,
        salaryReductionRate: data.salaryReductionRate ?? null,
        salaryReductionMonths: data.salaryReductionMonths ?? null,
        issuedBy: user.employeeId,
        status: 'ACTIVE',
      },
      include: {
        employee: { select: { id: true, name: true, employeeCode: true } },
        issuer: { select: { id: true, name: true } },
      },
    })

    return apiSuccess(created, 201)
  },
  perm(MODULE.DISCIPLINE, ACTION.CREATE),
)
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/sangwoo/Documents/VibeCoding/GHR/ctr-hr-hub && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors for this file

**Step 3: Commit**

```bash
git add src/app/api/v1/disciplinary/route.ts
git commit -m "feat(step5): add disciplinary list + create API"
```

---

### Task 4: 징계 API — GET + PUT `/api/v1/disciplinary/[id]`

**Files:**
- Create: `src/app/api/v1/disciplinary/[id]/route.ts`

**Step 1: Create disciplinary detail + update API**

```typescript
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess, apiError } from '@/lib/api'
import { notFound, badRequest } from '@/lib/errors'
import { MODULE, ACTION, ROLE } from '@/lib/constants'

const updateSchema = z.object({
  actionType: z.enum([
    'VERBAL_WARNING', 'WRITTEN_WARNING', 'REPRIMAND',
    'SUSPENSION', 'PAY_CUT', 'DEMOTION', 'TERMINATION',
  ]).optional(),
  category: z.enum([
    'ATTENDANCE', 'SAFETY', 'QUALITY', 'CONDUCT',
    'POLICY_VIOLATION', 'MISCONDUCT', 'HARASSMENT', 'FRAUD', 'OTHER',
  ]).optional(),
  incidentDate: z.string().datetime().optional(),
  description: z.string().min(1).optional(),
  evidenceKeys: z.array(z.string()).optional(),
  committeeDate: z.string().datetime().optional(),
  committeeMembers: z.array(z.string()).optional(),
  decision: z.string().optional(),
  decisionDate: z.string().datetime().optional(),
  suspensionStart: z.string().datetime().optional(),
  suspensionEnd: z.string().datetime().optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'OVERTURNED']).optional(),
  validMonths: z.number().int().positive().optional(),
  demotionGradeId: z.string().uuid().nullable().optional(),
  salaryReductionRate: z.number().min(0).max(100).nullable().optional(),
  salaryReductionMonths: z.number().int().positive().nullable().optional(),
})

export const GET = withPermission(
  async (_req, context, user) => {
    const { id } = await context.params

    const companyFilter =
      user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const record = await prisma.disciplinaryAction.findFirst({
      where: { id, deletedAt: null, ...companyFilter },
      include: {
        employee: {
          select: {
            id: true, name: true, employeeCode: true,
            department: { select: { id: true, name: true } },
            jobGrade: { select: { id: true, name: true } },
          },
        },
        issuer: { select: { id: true, name: true } },
        demotionGrade: { select: { id: true, name: true } },
      },
    })

    if (!record) return apiError(notFound('징계 기록을 찾을 수 없습니다.'))
    return apiSuccess(record)
  },
  perm(MODULE.DISCIPLINE, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req, context, user) => {
    const { id } = await context.params
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return apiError(badRequest('입력값이 올바르지 않습니다.', {
        errors: parsed.error.flatten().fieldErrors,
      }))
    }

    const existing = await prisma.disciplinaryAction.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }),
      },
    })

    if (!existing) return apiError(notFound('징계 기록을 찾을 수 없습니다.'))

    const data = parsed.data

    // Recalculate expiresAt if validMonths changed
    let expiresAt = existing.expiresAt
    if (data.validMonths !== undefined) {
      const base = data.decisionDate
        ? new Date(data.decisionDate)
        : existing.decisionDate ?? new Date()
      expiresAt = new Date(base)
      expiresAt.setMonth(expiresAt.getMonth() + data.validMonths)
    }

    const updated = await prisma.disciplinaryAction.update({
      where: { id },
      data: {
        ...(data.actionType ? { actionType: data.actionType } : {}),
        ...(data.category ? { category: data.category } : {}),
        ...(data.incidentDate ? { incidentDate: new Date(data.incidentDate) } : {}),
        ...(data.description ? { description: data.description } : {}),
        ...(data.evidenceKeys ? { evidenceKeys: data.evidenceKeys } : {}),
        ...(data.committeeDate ? { committeeDate: new Date(data.committeeDate) } : {}),
        ...(data.committeeMembers ? { committeeMembers: data.committeeMembers } : {}),
        ...(data.decision !== undefined ? { decision: data.decision } : {}),
        ...(data.decisionDate ? { decisionDate: new Date(data.decisionDate) } : {}),
        ...(data.suspensionStart ? { suspensionStart: new Date(data.suspensionStart) } : {}),
        ...(data.suspensionEnd ? { suspensionEnd: new Date(data.suspensionEnd) } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.validMonths !== undefined ? { validMonths: data.validMonths, expiresAt } : {}),
        ...(data.demotionGradeId !== undefined ? { demotionGradeId: data.demotionGradeId } : {}),
        ...(data.salaryReductionRate !== undefined ? { salaryReductionRate: data.salaryReductionRate } : {}),
        ...(data.salaryReductionMonths !== undefined ? { salaryReductionMonths: data.salaryReductionMonths } : {}),
      },
      include: {
        employee: { select: { id: true, name: true, employeeCode: true } },
        issuer: { select: { id: true, name: true } },
        demotionGrade: { select: { id: true, name: true } },
      },
    })

    return apiSuccess(updated)
  },
  perm(MODULE.DISCIPLINE, ACTION.UPDATE),
)
```

**Step 2: Commit**

```bash
git add src/app/api/v1/disciplinary/[id]/route.ts
git commit -m "feat(step5): add disciplinary detail + update API"
```

---

### Task 5: 징계 이의신청 API — PUT `/api/v1/disciplinary/[id]/appeal`

**Files:**
- Create: `src/app/api/v1/disciplinary/[id]/appeal/route.ts`

**Step 1: Create appeal API**

```typescript
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess, apiError } from '@/lib/api'
import { notFound, badRequest } from '@/lib/errors'
import { MODULE, ACTION, ROLE } from '@/lib/constants'

const appealSchema = z.object({
  appealText: z.string().min(1, '이의신청 사유를 입력해주세요.'),
})

export const PUT = withPermission(
  async (req, context, user) => {
    const { id } = await context.params
    const body = await req.json()
    const parsed = appealSchema.safeParse(body)

    if (!parsed.success) {
      return apiError(badRequest('이의신청 사유를 입력해주세요.'))
    }

    const existing = await prisma.disciplinaryAction.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }),
      },
    })

    if (!existing) return apiError(notFound('징계 기록을 찾을 수 없습니다.'))

    if (existing.appealStatus !== 'NONE') {
      return apiError(badRequest('이미 이의신청이 접수되었습니다.'))
    }

    const updated = await prisma.disciplinaryAction.update({
      where: { id },
      data: {
        appealStatus: 'FILED',
        appealDate: new Date(),
        appealText: parsed.data.appealText,
      },
      include: {
        employee: { select: { id: true, name: true } },
      },
    })

    return apiSuccess(updated)
  },
  perm(MODULE.DISCIPLINE, ACTION.UPDATE),
)
```

**Step 2: Commit**

```bash
git add src/app/api/v1/disciplinary/[id]/appeal/route.ts
git commit -m "feat(step5): add disciplinary appeal API"
```

---

### Task 6: 포상 API — CRUD `/api/v1/rewards`

**Files:**
- Create: `src/app/api/v1/rewards/route.ts`
- Create: `src/app/api/v1/rewards/[id]/route.ts`

**Step 1: Create rewards list + create route**

`src/app/api/v1/rewards/route.ts`:
```typescript
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess, apiPaginated, buildPagination, apiError } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { MODULE, ACTION, DEFAULT_PAGE, DEFAULT_PAGE_SIZE, ROLE } from '@/lib/constants'

const createSchema = z.object({
  employeeId: z.string().uuid(),
  rewardType: z.enum([
    'COMMENDATION', 'BONUS_AWARD', 'PROMOTION_RECOMMENDATION',
    'LONG_SERVICE', 'INNOVATION', 'SAFETY_AWARD', 'CTR_VALUE_AWARD', 'OTHER',
  ]),
  title: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().positive().optional(),
  awardedDate: z.string().datetime(),
  documentKey: z.string().optional(),
  ctrValue: z.string().optional(),
  serviceYears: z.number().int().positive().optional(),
})

export const GET = withPermission(
  async (req, _context, user) => {
    const url = new URL(req.url)
    const page = Number(url.searchParams.get('page')) || DEFAULT_PAGE
    const limit = Number(url.searchParams.get('limit')) || DEFAULT_PAGE_SIZE
    const search = url.searchParams.get('search') || undefined
    const rewardType = url.searchParams.get('rewardType') || undefined

    const companyFilter =
      user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const where = {
      ...companyFilter,
      ...(rewardType ? { rewardType: rewardType as string } : {}),
      ...(search
        ? {
            OR: [
              { employee: { name: { contains: search, mode: 'insensitive' as const } } },
              { title: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [data, total] = await Promise.all([
      prisma.rewardRecord.findMany({
        where,
        include: {
          employee: { select: { id: true, name: true, employeeCode: true } },
          issuer: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.rewardRecord.count({ where }),
    ])

    return apiPaginated(data, buildPagination(page, limit, total))
  },
  perm(MODULE.DISCIPLINE, ACTION.VIEW),
)

export const POST = withPermission(
  async (req, _context, user) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)

    if (!parsed.success) {
      return apiError(badRequest('입력값이 올바르지 않습니다.', {
        errors: parsed.error.flatten().fieldErrors,
      }))
    }

    const data = parsed.data

    const created = await prisma.rewardRecord.create({
      data: {
        employeeId: data.employeeId,
        companyId: user.companyId,
        rewardType: data.rewardType,
        title: data.title,
        description: data.description ?? null,
        amount: data.amount ?? null,
        awardedDate: new Date(data.awardedDate),
        awardedBy: user.employeeId,
        documentKey: data.documentKey ?? null,
        ctrValue: data.ctrValue ?? null,
        serviceYears: data.serviceYears ?? null,
      },
      include: {
        employee: { select: { id: true, name: true, employeeCode: true } },
        issuer: { select: { id: true, name: true } },
      },
    })

    return apiSuccess(created, 201)
  },
  perm(MODULE.DISCIPLINE, ACTION.CREATE),
)
```

**Step 2: Create rewards detail + update + delete route**

`src/app/api/v1/rewards/[id]/route.ts`:
```typescript
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess, apiError } from '@/lib/api'
import { notFound, badRequest } from '@/lib/errors'
import { MODULE, ACTION, ROLE } from '@/lib/constants'

const updateSchema = z.object({
  rewardType: z.enum([
    'COMMENDATION', 'BONUS_AWARD', 'PROMOTION_RECOMMENDATION',
    'LONG_SERVICE', 'INNOVATION', 'SAFETY_AWARD', 'CTR_VALUE_AWARD', 'OTHER',
  ]).optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  amount: z.number().positive().nullable().optional(),
  awardedDate: z.string().datetime().optional(),
  documentKey: z.string().nullable().optional(),
  ctrValue: z.string().nullable().optional(),
  serviceYears: z.number().int().positive().nullable().optional(),
})

export const GET = withPermission(
  async (_req, context, user) => {
    const { id } = await context.params
    const companyFilter =
      user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const record = await prisma.rewardRecord.findFirst({
      where: { id, ...companyFilter },
      include: {
        employee: {
          select: {
            id: true, name: true, employeeCode: true,
            department: { select: { id: true, name: true } },
            jobGrade: { select: { id: true, name: true } },
          },
        },
        issuer: { select: { id: true, name: true } },
      },
    })

    if (!record) return apiError(notFound('포상 기록을 찾을 수 없습니다.'))
    return apiSuccess(record)
  },
  perm(MODULE.DISCIPLINE, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req, context, user) => {
    const { id } = await context.params
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return apiError(badRequest('입력값이 올바르지 않습니다.'))
    }

    const existing = await prisma.rewardRecord.findFirst({
      where: {
        id,
        ...(user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }),
      },
    })

    if (!existing) return apiError(notFound('포상 기록을 찾을 수 없습니다.'))

    const data = parsed.data
    const updated = await prisma.rewardRecord.update({
      where: { id },
      data: {
        ...(data.rewardType ? { rewardType: data.rewardType } : {}),
        ...(data.title ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.awardedDate ? { awardedDate: new Date(data.awardedDate) } : {}),
        ...(data.documentKey !== undefined ? { documentKey: data.documentKey } : {}),
        ...(data.ctrValue !== undefined ? { ctrValue: data.ctrValue } : {}),
        ...(data.serviceYears !== undefined ? { serviceYears: data.serviceYears } : {}),
      },
      include: {
        employee: { select: { id: true, name: true } },
        issuer: { select: { id: true, name: true } },
      },
    })

    return apiSuccess(updated)
  },
  perm(MODULE.DISCIPLINE, ACTION.UPDATE),
)

export const DELETE = withPermission(
  async (_req, context, user) => {
    const { id } = await context.params

    const existing = await prisma.rewardRecord.findFirst({
      where: {
        id,
        ...(user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }),
      },
    })

    if (!existing) return apiError(notFound('포상 기록을 찾을 수 없습니다.'))

    await prisma.rewardRecord.delete({ where: { id } })
    return apiSuccess({ deleted: true })
  },
  perm(MODULE.DISCIPLINE, ACTION.DELETE),
)
```

**Step 3: Commit**

```bash
git add src/app/api/v1/rewards/
git commit -m "feat(step5): add rewards CRUD API"
```

---

### Task 7: 사이드바 메뉴 업데이트 — 징계/포상 + 채용 확장

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Step 1: Add imports for new icons**

Add to Lucide imports: `Gavel, Award, Briefcase, BarChart2, Kanban`
(Use `Gavel` for discipline, `Award` for rewards, `Briefcase` for recruitment dashboard)

**Step 2: Update 채용관리 nav group items**

Replace the existing recruitment items with:
```typescript
{
  label: '채용관리',
  icon: UserPlus,
  module: MODULE.RECRUITMENT,
  items: [
    { label: '채용공고', href: '/recruitment', icon: UserPlus },
    { label: '채용 대시보드', href: '/recruitment/dashboard', icon: BarChart3 },
  ],
},
```

**Step 3: Add 징계·포상 nav group**

After the recruitment group, add:
```typescript
{
  label: '징계·포상',
  icon: Gavel,
  module: MODULE.DISCIPLINE,
  items: [
    { label: '징계관리', href: '/discipline', icon: Gavel },
    { label: '포상관리', href: '/discipline/rewards', icon: Award },
  ],
},
```

**Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(step5): update sidebar with discipline/reward + expanded recruitment menu"
```

---

### Task 8: 징계 목록 UI — DisciplineListClient.tsx

**Files:**
- Create: `src/app/(dashboard)/discipline/page.tsx`
- Create: `src/app/(dashboard)/discipline/DisciplineListClient.tsx`

**Step 1: Create server page**

`src/app/(dashboard)/discipline/page.tsx`:
```typescript
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import DisciplineListClient from './DisciplineListClient'

export default async function DisciplinePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return <DisciplineListClient user={user} />
}
```

**Step 2: Create client component**

`src/app/(dashboard)/discipline/DisciplineListClient.tsx`:

A full table view with:
- PageHeader ("징계관리" title, "징계 등록" CTA button → `/discipline/new`)
- FilterBar: search input + status filter (전체/활성/만료/번복) + category filter
- DataTable with columns: 사원명, 사번, 징계유형, 징계분류, 사건일자, 상태, 이의신청
- Status badges: ACTIVE → green, EXPIRED → gray, OVERTURNED → orange
- Appeal badges: NONE → gray, FILED → blue, UNDER_REVIEW → orange, UPHELD → red, OVERTURNED → green
- Row click → `/discipline/[id]`
- Pagination
- Design system: bg #FAFAFA, card #FFFFFF, border #E8E8E8, CTA #00C853, table header 12px #999, body 14px #333

(Full component code ~200-300 lines — implement with `apiClient.getList`, `useState` for filters, `DataTable` component usage pattern from existing STEP3/4 pages)

**Step 3: Commit**

```bash
git add src/app/(dashboard)/discipline/
git commit -m "feat(step5): add discipline list page with filters and table"
```

---

### Task 9: 징계 등록 UI — DisciplineFormClient.tsx

**Files:**
- Create: `src/app/(dashboard)/discipline/new/page.tsx`
- Create: `src/app/(dashboard)/discipline/new/DisciplineFormClient.tsx`

**Step 1: Create server page**

Standard pattern: session check → redirect → `<DisciplineFormClient user={user} />`

**Step 2: Create form client**

Form with sections:
- 대상 사원: searchable employee selector
- 징계 유형: 7-option select (VERBAL_WARNING ~ TERMINATION)
- 징계 분류: 9-option select (ATTENDANCE ~ OTHER)
- 사건일자: date picker
- 사건 내용: textarea
- 증빙자료: file upload (S3 — use existing S3 upload pattern)
- 징계위원회: optional section (날짜, 위원 목록, 의결 내용, 의결일)
- 정지 기간: conditional (actionType === SUSPENSION)
- 감봉 정보: conditional (actionType === PAY_CUT)
- 강등 정보: conditional (actionType === DEMOTION)
- 유효기간: months number input
- Submit with zod + react-hook-form + zodResolver pattern

Design system: card bg white, border 1px #E8E8E8, border-radius 12px, CTA button #00C853 8px radius

**Step 3: Commit**

```bash
git add src/app/(dashboard)/discipline/new/
git commit -m "feat(step5): add discipline registration form"
```

---

### Task 10: 징계 상세 UI — DisciplineDetailClient.tsx

**Files:**
- Create: `src/app/(dashboard)/discipline/[id]/page.tsx`
- Create: `src/app/(dashboard)/discipline/[id]/DisciplineDetailClient.tsx`

**Step 1: Create detail page with 65/35 layout**

Left panel (65%): 징계 상세 정보 카드 (유형, 분류, 사건일, 상태, 내용, 증빙, 위원회 정보)
Right panel (35%): 직원 프로필 요약 + 이의신청 카드

이의신청 카드:
- appealStatus === 'NONE' → 이의신청 버튼 + textarea 표시
- appealStatus === 'FILED' → "이의신청 접수됨" badge + appealText 표시
- appealStatus === 'UNDER_REVIEW' → "검토중" badge
- appealStatus === 'UPHELD' / 'OVERTURNED' → 결과 badge + appealResult 표시

**Step 2: Commit**

```bash
git add src/app/(dashboard)/discipline/[id]/
git commit -m "feat(step5): add discipline detail page with appeal UI"
```

---

### Task 11: 포상 목록 + 등록 + 상세 UI

**Files:**
- Create: `src/app/(dashboard)/discipline/rewards/page.tsx`
- Create: `src/app/(dashboard)/discipline/rewards/RewardsListClient.tsx`
- Create: `src/app/(dashboard)/discipline/rewards/new/page.tsx`
- Create: `src/app/(dashboard)/discipline/rewards/new/RewardFormClient.tsx`
- Create: `src/app/(dashboard)/discipline/rewards/[id]/page.tsx`
- Create: `src/app/(dashboard)/discipline/rewards/[id]/RewardDetailClient.tsx`

**Step 1: Create rewards list page**

Table with columns: 사원명, 사번, 포상유형, 포상명, 수여일, 금액
- RewardType badges with colors
- CTR_VALUE_AWARD → show CTR 핵심가치 badge (CHALLENGE/TRUST/RESPONSIBILITY/RESPECT with icons)
- Filter by rewardType
- Search by employee name

**Step 2: Create reward form**

Fields:
- 대상 사원: employee selector
- 포상 유형: 8-option select
- 포상명: text input
- 설명: textarea
- 포상금: optional number input
- 수여일: date picker
- CTR 핵심가치: conditional (rewardType === CTR_VALUE_AWARD) → 4 radio buttons
- 근속연수: conditional (rewardType === LONG_SERVICE) → number input

**Step 3: Create reward detail page**

65/35 layout: detail info + employee profile summary

**Step 4: Commit**

```bash
git add src/app/(dashboard)/discipline/rewards/
git commit -m "feat(step5): add rewards list, form, and detail pages"
```

---

### Phase 1 Checkpoint: Verify all APIs and pages

Run: `npx tsc --noEmit`
Run: `npm run build`
Expected: No TypeScript errors, build succeeds

---

## Phase 2: 채용 공고 + 역량 라이브러리 + AI

### Task 12: 역량 라이브러리 API — CRUD `/api/v1/competencies`

**Files:**
- Create: `src/app/api/v1/competencies/route.ts`
- Create: `src/app/api/v1/competencies/[id]/route.ts`

Standard CRUD pattern. CompetencyLibrary model fields: name, category, description, behavioralIndicators (Json), isActive.
Permission: `perm(MODULE.SETTINGS, ACTION.VIEW)` for GET, `perm(MODULE.SETTINGS, ACTION.CREATE)` for POST.

**Commit:** `feat(step5): add competency library CRUD API`

---

### Task 13: 역량 라이브러리 UI — settings/competencies

**Files:**
- Create: `src/app/(dashboard)/settings/competencies/page.tsx`
- Create: `src/app/(dashboard)/settings/competencies/CompetencyListClient.tsx`

Inline table with add/edit modal. Columns: 역량명, 카테고리, 설명, 활성상태.
Add button opens modal with form (name, category, description, behavioralIndicators textarea).

**Commit:** `feat(step5): add competency library settings page`

---

### Task 14: Update sidebar — settings/competencies entry

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

Add `{ label: '역량 라이브러리', href: '/settings/competencies', icon: Target }` to settings group items.

**Commit:** `feat(step5): add competency library to settings sidebar`

---

### Task 15: 채용 공고 API — CRUD `/api/v1/recruitment/postings`

**Files:**
- Create: `src/app/api/v1/recruitment/postings/route.ts` (GET + POST)
- Create: `src/app/api/v1/recruitment/postings/[id]/route.ts` (GET + PUT + DELETE soft)
- Create: `src/app/api/v1/recruitment/postings/[id]/publish/route.ts` (PUT: DRAFT → OPEN)
- Create: `src/app/api/v1/recruitment/postings/[id]/close/route.ts` (PUT: OPEN → CLOSED)

Permission: `perm(MODULE.RECRUITMENT, ACTION.VIEW)` / `ACTION.CREATE` / `ACTION.UPDATE`

Key fields: title, description, requirements, preferred, headcount, workMode, employmentType, departmentId, jobGradeId, jobCategoryId, location, salaryRangeMin/Max, salaryHidden, deadlineDate, recruiterId, requiredCompetencies, status.

List query: filter by status, search by title, companyFilter.

**Commit:** `feat(step5): add recruitment postings CRUD + publish/close API`

---

### Task 16: AI 공고 초안 생성 — generateJobDescription

**Files:**
- Modify: `src/lib/claude.ts` (add generateJobDescription function)
- Create: `src/app/api/v1/ai/job-description/route.ts`

**Step 1: Add `generateJobDescription` to `lib/claude.ts`**

```typescript
interface JobDescriptionInput {
  title: string
  department?: string
  grade?: string
  category?: string
  requirements?: string
}

interface JobDescriptionResult {
  description: string
  qualifications: string
  preferred: string
}

export async function generateJobDescription(
  input: JobDescriptionInput,
  companyId: string,
  employeeId: string,
): Promise<JobDescriptionResult> {
  const prompt = `당신은 CTR Holdings(자동차부품 글로벌 기업)의 채용 담당자입니다.
다음 정보를 바탕으로 채용 공고 초안을 작성하세요:

직무명: ${input.title}
${input.department ? `부서: ${input.department}` : ''}
${input.grade ? `직급: ${input.grade}` : ''}
${input.category ? `직군: ${input.category}` : ''}
${input.requirements ? `요구사항 키워드: ${input.requirements}` : ''}

아래 JSON 형식으로 응답하세요:
{
  "description": "직무 설명 (3-5문장)",
  "qualifications": "자격 요건 (bullet point 형태, \\n 구분)",
  "preferred": "우대 사항 (bullet point 형태, \\n 구분)"
}

JSON만 응답하세요.`

  const result = await callClaude({
    feature: 'JOB_DESCRIPTION_GENERATION',
    prompt,
    systemPrompt: 'You are an HR specialist for CTR Holdings, a global automotive parts company. Respond in Korean.',
    maxTokens: 1024,
    companyId,
    employeeId,
  })

  try {
    return JSON.parse(result.content) as JobDescriptionResult
  } catch {
    throw serviceUnavailable('AI 분석 결과 파싱에 실패했습니다.')
  }
}
```

**Step 2: Create AI API route**

**Commit:** `feat(step5): add AI job description generation`

---

### Task 17: 채용 공고 UI — 목록/생성/수정/상세

**Files:**
- Create: `src/app/(dashboard)/recruitment/page.tsx` + `RecruitmentListClient.tsx`
- Create: `src/app/(dashboard)/recruitment/new/page.tsx` + `PostingFormClient.tsx`
- Create: `src/app/(dashboard)/recruitment/[id]/page.tsx` + `PostingDetailClient.tsx`
- Create: `src/app/(dashboard)/recruitment/[id]/edit/page.tsx` + `PostingEditClient.tsx`

List: table with PostingStatus badges (DRAFT→gray, OPEN→green, CLOSED→orange, CANCELLED→red)
Form: title, department, grade, category, workMode, headcount, description (textarea), requirements (textarea), preferred (textarea), salary range, deadline, recruiter selector, competency tags, "AI 초안 생성" button
Detail: 65/35 layout, applicant count summary, publish/close action buttons

**Commit:** `feat(step5): add recruitment posting UI (list, create, edit, detail)`

---

## Phase 3: 지원자 + 칸반 + AI 분석

### Task 18: 지원자 API — `/api/v1/recruitment/postings/[id]/applicants` + `/api/v1/recruitment/applicants/[id]`

**Files:**
- Create: `src/app/api/v1/recruitment/postings/[id]/applicants/route.ts` (GET list + POST create with S3 resume upload)
- Create: `src/app/api/v1/recruitment/applicants/[id]/route.ts` (GET + PUT)

POST creates both Applicant (if new email) + Application in one transaction.

**Commit:** `feat(step5): add applicant CRUD API`

---

### Task 19: 지원 단계 변경 + 오퍼 API

**Files:**
- Create: `src/app/api/v1/recruitment/applications/[id]/stage/route.ts` (PUT — change stage with REJECTED reason modal)
- Create: `src/app/api/v1/recruitment/applications/[id]/offer/route.ts` (POST — set offeredSalary, offeredDate, expectedStartDate)

Stage change rules:
- Can move forward or backward except HIRED (one-way)
- REJECTED requires rejectionReason
- Moving to OFFER stage triggers offer data requirement

**Commit:** `feat(step5): add application stage change + offer API`

---

### Task 20: AI 이력서 분석 — analyzeResume

**Files:**
- Modify: `src/lib/claude.ts` (add analyzeResume function)
- Create: `src/app/api/v1/ai/resume-analysis/route.ts`

```typescript
interface ResumeAnalysisInput {
  resumeText: string
  jobTitle: string
  requirements?: string
  preferred?: string
}

interface ResumeAnalysisResult {
  overall_score: number
  fit_assessment: string
  strengths: string[]
  concerns: string[]
  experience_match: number
  skill_match: number
  culture_fit_indicators: string[]
  summary: string
}
```

Score colors: 80+ → #00C853, 50-79 → #FF9800, <50 → #F44336

**Commit:** `feat(step5): add AI resume analysis`

---

### Task 21: 지원자 UI — 목록 + 등록

**Files:**
- Create: `src/app/(dashboard)/recruitment/[id]/applicants/page.tsx` + `ApplicantListClient.tsx`
- Create: `src/app/(dashboard)/recruitment/[id]/applicants/new/page.tsx` + `ApplicantFormClient.tsx`

List: applicant table with stage badges, AI score badges (color-coded), search, filter by stage.
Form: name, email, phone, source, portfolioUrl, memo, resume file upload.

**Commit:** `feat(step5): add applicant list and form pages`

---

### Task 22: 칸반 파이프라인 — PipelineClient.tsx

**Files:**
- Create: `src/app/(dashboard)/recruitment/[id]/pipeline/page.tsx` + `PipelineClient.tsx`

**Implementation details:**
- 8 columns: APPLIED → SCREENING → INTERVIEW_1 → INTERVIEW_2 → FINAL → OFFER → HIRED → REJECTED
- HTML5 Drag & Drop API (no external lib)
- Each card: applicant name + AI score badge (color) + applied date
- Drag card between columns → PUT `/api/v1/recruitment/applications/[id]/stage`
- Drop to REJECTED → modal for rejection reason
- Drop to OFFER → modal for offer info (salary, date, start date)
- Column headers show count
- Design: cards with 12px radius, border #E8E8E8, AI score badge with colors

**Commit:** `feat(step5): add recruitment pipeline kanban board`

---

## Phase 4: 면접 + 대시보드

### Task 23: 면접 API — CRUD + 평가

**Files:**
- Create: `src/app/api/v1/recruitment/interviews/route.ts` (GET + POST)
- Create: `src/app/api/v1/recruitment/interviews/[id]/route.ts` (GET + PUT + DELETE)
- Create: `src/app/api/v1/recruitment/interviews/[id]/evaluate/route.ts` (POST)

Interview fields: applicationId, interviewerId, scheduledAt, durationMinutes, location, meetingLink, status, interviewType, round.
Evaluate: overallScore (1-5), competencyScores (Json), strengths, concerns, recommendation, comment.

**Commit:** `feat(step5): add interview CRUD + evaluation API`

---

### Task 24: 면접 UI — 목록 + 등록 + 평가

**Files:**
- Create: `src/app/(dashboard)/recruitment/[id]/interviews/page.tsx` + `InterviewListClient.tsx`
- Create: `src/app/(dashboard)/recruitment/[id]/interviews/new/page.tsx` + `InterviewFormClient.tsx`

List: interview table with status badges, interviewer name, date, type, round.
Form: application selector, interviewer selector, date/time, type, round, location/meeting link.
Inline evaluation: score inputs per competency + recommendation radio + comment textarea.

**Commit:** `feat(step5): add interview UI (list, form, evaluation)`

---

### Task 25: 채용 대시보드 API — `/api/v1/recruitment/dashboard`

**Files:**
- Create: `src/app/api/v1/recruitment/dashboard/route.ts`

Returns:
- KPI: 진행중 공고 수, 총 지원자 수, 평균 채용 기간, 합격률
- Funnel data: stage별 지원자 수 (APPLIED: N, SCREENING: N, ...)
- Time-to-hire trend (monthly)

**Commit:** `feat(step5): add recruitment dashboard API`

---

### Task 26: 채용 대시보드 UI — RecruitmentDashboardClient.tsx

**Files:**
- Create: `src/app/(dashboard)/recruitment/dashboard/page.tsx` + `RecruitmentDashboardClient.tsx`

Layout:
- Top row: 4 KPI cards (진행중 공고, 총 지원자, 평균 채용기간, 합격률)
- Main area: Funnel chart (Recharts FunnelChart) with CTR color scheme
- Design: `.funnel-stage` pattern from CTR_DESIGN_SYSTEM.md Section 12

**Commit:** `feat(step5): add recruitment dashboard with KPI and funnel chart`

---

### Task 27: Final build + type check

Run: `npx tsc --noEmit`
Run: `npm run build`

Fix any remaining TypeScript errors.

**Commit:** `chore(step5): fix remaining type errors and build issues`

---

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| 1 | 1-11 | Prisma schema + 징계/포상 CRUD (API + UI) |
| 2 | 12-17 | 역량 라이브러리 + 채용공고 CRUD + AI 공고 생성 |
| 3 | 18-22 | 지원자 관리 + 칸반 파이프라인 + AI 이력서 분석 |
| 4 | 23-27 | 면접 일정/평가 + 채용 대시보드 |

# CTR HR Hub STEP3 — 온보딩 + 퇴직관리 + Self-Service Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 온보딩 템플릿 관리 + 감성 체크인 + 퇴직 프로세스 전체 + Self-Service 정보수정 승인 구현

**Architecture:** Server Component(session/권한체크) → Client Component(fetch+렌더) 패턴 유지. API는 withPermission → Zod parse → Prisma → apiSuccess 패턴. 복합 변경은 반드시 $transaction.

**Tech Stack:** Next.js 14 App Router, Prisma, recharts(신규설치), @dnd-kit(신규설치), shadcn/ui, zod v4, react-hook-form

---

## 코드 패턴 참조

### Server Page 패턴
```tsx
// page.tsx
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { XxxClient } from './XxxClient'

export default async function XxxPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return <XxxClient user={user} />
}
```

### API Route 패턴
```ts
import { withPermission, perm } from '@/lib/permissions'
import { apiSuccess, apiError, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { MODULE, ACTION } from '@/lib/constants'
import { prisma } from '@/lib/prisma'

export const GET = withPermission(
  async (req, _ctx, user) => {
    // ... query prisma ...
    return apiSuccess(data)
  },
  perm(MODULE.ONBOARDING, ACTION.VIEW)
)
```

### 알림 발송 패턴 (fire-and-forget)
```ts
// lib/notifications.ts의 sendNotification() 사용
sendNotification({ employeeId, title, body, link, triggerType })
```

---

## Task 0: Pre-requisites + Package 설치

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/components/icons/CoreValueIcons.tsx`

### Step 1: recharts + @dnd-kit 패키지 설치
```bash
cd /Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub
npm install recharts @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install --save-dev @types/recharts 2>/dev/null || true
```
Expected: packages installed successfully

### Step 2: constants.ts에 CTR_VALUES 추가
`src/lib/constants.ts` 맨 끝에 추가:
```ts
// ─── CTR Values (simple string array, STEP3 spec) ─────────
export const CTR_VALUES = ['CHALLENGE', 'TRUST', 'RESPONSIBILITY', 'RESPECT'] as const
export type CtrValue = (typeof CTR_VALUES)[number]
```

### Step 3: CoreValueIcons.tsx에 Ctr 접두사 alias 추가
파일 맨 끝에 추가:
```ts
// Aliases with Ctr prefix (STEP3 spec)
export const CtrChallengeIcon = ChallengeIcon
export const CtrTrustIcon = TrustIcon
export const CtrResponsibilityIcon = ResponsibilityIcon
export const CtrRespectIcon = RespectIcon
```

### Step 4: DB 추가 인덱스 8개 적용
DB가 실행 중이라면 아래 SQL 적용. 없으면 SKIP (prisma push 후 적용):
```sql
CREATE INDEX IF NOT EXISTS idx_disciplinary_emp ON disciplinary_actions(employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compensation_emp ON compensation_history(employee_id, effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_offboarding_emp ON employee_offboarding(employee_id);
CREATE INDEX IF NOT EXISTS idx_org_change_company ON org_change_history(company_id, effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_terminal ON attendances(terminal_id);
CREATE INDEX IF NOT EXISTS idx_recognition_receiver ON recognitions(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_one_on_one_emp ON one_on_ones(employee_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_leave_req_emp ON leave_requests(employee_id, start_date DESC);
```

### Step 5: TypeScript 컴파일 확인
```bash
cd /Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub && npx tsc --noEmit 2>&1 | head -20
```
Expected: 기존 오류 수와 동일 (pre-existing errors만 있어야 함)

---

## Task 1: Notification Helper (lib/notifications.ts)

**Files:**
- Create: `src/lib/notifications.ts`

### Step 1: notifications.ts 생성
```ts
// src/lib/notifications.ts
import { prisma } from '@/lib/prisma'

interface SendNotificationInput {
  employeeId: string
  triggerType: string
  title: string
  body: string
  link?: string
}

/**
 * 알림을 fire-and-forget으로 발송합니다.
 * DB에 notifications 레코드 생성 (FCM/SES 연동은 Phase 2)
 */
export function sendNotification(input: SendNotificationInput): void {
  prisma.notification
    .create({
      data: {
        employeeId: input.employeeId,
        triggerType: input.triggerType,
        title: input.title,
        body: input.body,
        channel: 'IN_APP',
        link: input.link ?? null,
      },
    })
    .catch(() => {
      // fire-and-forget: 알림 실패가 비즈니스 로직에 영향 없어야 함
    })
}

/**
 * 여러 직원에게 동시에 알림 발송
 */
export function sendNotifications(inputs: SendNotificationInput[]): void {
  for (const input of inputs) {
    sendNotification(input)
  }
}
```

### Step 2: TypeScript 확인
```bash
cd /Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub && npx tsc --noEmit 2>&1 | head -20
```

---

## Task 2: claude.ts에 AI 함수 2개 추가

**Files:**
- Modify: `src/lib/claude.ts`

### Step 1: 온보딩 체크인 요약 함수 추가

`src/lib/claude.ts` 맨 끝에 추가:
```ts
// ─── Onboarding Checkin Summary ──────────────────────────

interface CheckinData {
  week: number
  mood: string
  energy: number
  belonging: number
  comment: string | null
}

interface OnboardingCheckinSummaryResult {
  overall_sentiment: 'POSITIVE' | 'MIXED' | 'CONCERNING'
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING'
  key_observations: string[]
  recommended_actions: string[]
}

export async function onboardingCheckinSummary(
  employeeName: string,
  checkins: CheckinData[],
  companyId: string,
  employeeId: string,
): Promise<OnboardingCheckinSummaryResult> {
  const prompt = `다음은 ${employeeName} 신입사원의 온보딩 체크인 데이터입니다:

${checkins
  .map(
    (c) =>
      `${c.week}주차: mood=${c.mood}, energy=${c.energy}/5, belonging=${c.belonging}/5${c.comment ? `, comment="${c.comment}"` : ''}`,
  )
  .join('\n')}

위 데이터를 분석하여 아래 JSON 형식으로 응답하세요:
{
  "overall_sentiment": "POSITIVE" | "MIXED" | "CONCERNING",
  "trend": "IMPROVING" | "STABLE" | "DECLINING",
  "key_observations": ["관찰 사항 1", "관찰 사항 2"],
  "recommended_actions": ["권장 조치 1", "권장 조치 2"]
}

JSON만 응답하세요.`

  const result = await callClaude({
    feature: 'ONBOARDING_CHECKIN_SUMMARY',
    prompt,
    maxTokens: 1024,
    companyId,
    employeeId,
  })

  try {
    return JSON.parse(result.content) as OnboardingCheckinSummaryResult
  } catch {
    throw serviceUnavailable('AI 분석 결과 파싱에 실패했습니다.')
  }
}

// ─── Exit Interview Summary ───────────────────────────────

interface ExitInterviewSummaryResult {
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
  key_issues: string[]
  retention_insight: string
  action_needed: string | null
}

export async function exitInterviewSummary(
  employeeName: string,
  tenureMonths: number,
  resignType: string,
  primaryReason: string,
  satisfactionScore: number,
  feedbackText: string,
  companyId: string,
  employeeId: string,
): Promise<ExitInterviewSummaryResult> {
  const prompt = `다음은 ${employeeName}(재직 ${tenureMonths}개월)의 퇴직 면담 정보입니다:
퇴직 유형: ${resignType}
주요 퇴사 사유: ${primaryReason}
만족도: ${satisfactionScore}/5
의견: "${feedbackText}"

위 내용을 분석하여 아래 JSON 형식으로 응답하세요:
{
  "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
  "key_issues": ["핵심 이슈 1", "핵심 이슈 2"],
  "retention_insight": "이 직원을 유지할 수 있었던 방법에 대한 인사이트",
  "action_needed": "필요한 조직 개선 행동 또는 null"
}

JSON만 응답하세요.`

  const result = await callClaude({
    feature: 'EXIT_INTERVIEW_SUMMARY',
    prompt,
    maxTokens: 1024,
    companyId,
    employeeId,
  })

  try {
    return JSON.parse(result.content) as ExitInterviewSummaryResult
  } catch {
    throw serviceUnavailable('AI 분석 결과 파싱에 실패했습니다.')
  }
}
```

### Step 2: TypeScript 확인
```bash
cd /Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub && npx tsc --noEmit 2>&1 | head -20
```

---

## Task 3: Onboarding Template API

**Files:**
- Create: `src/app/api/v1/onboarding/templates/route.ts`
- Create: `src/app/api/v1/onboarding/templates/[id]/route.ts`
- Create: `src/app/api/v1/onboarding/templates/[id]/tasks/route.ts`
- Create: `src/app/api/v1/onboarding/templates/[id]/tasks/reorder/route.ts`

### Step 1: 디렉토리 생성
```bash
mkdir -p /Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/api/v1/onboarding/templates/\[id\]/tasks/reorder
```

### Step 2: GET/POST /api/v1/onboarding/templates 생성

```ts
// src/app/api/v1/onboarding/templates/route.ts
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, DEFAULT_PAGE_SIZE, DEFAULT_PAGE } from '@/lib/constants'
import type { SessionUser } from '@/types'

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  targetType: z.enum(['NEW_HIRE', 'TRANSFER', 'REHIRE']),
  companyId: z.string().uuid().optional(),
})

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const p = Object.fromEntries(req.nextUrl.searchParams)
    const page = Number(p.page ?? DEFAULT_PAGE)
    const limit = Number(p.limit ?? DEFAULT_PAGE_SIZE)
    const companyId = user.role === 'SUPER_ADMIN' ? (p.companyId ?? undefined) : user.companyId

    const where = {
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
    }

    const [total, templates] = await Promise.all([
      prisma.onboardingTemplate.count({ where }),
      prisma.onboardingTemplate.findMany({
        where,
        include: { _count: { select: { onboardingTasks: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return apiPaginated(templates, buildPagination(page, limit, total))
  },
  perm(MODULE.ONBOARDING, ACTION.VIEW),
)

export const POST = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })

    const { name, description, targetType, companyId: reqCompanyId } = parsed.data
    const companyId = user.role === 'SUPER_ADMIN' ? (reqCompanyId ?? user.companyId) : user.companyId

    const template = await prisma.onboardingTemplate.create({
      data: { name, description, targetType, companyId, isActive: true },
    })

    return apiSuccess(template, 201)
  },
  perm(MODULE.ONBOARDING, ACTION.CREATE),
)
```

### Step 3: GET/PUT/DELETE /api/v1/onboarding/templates/[id] 생성
```ts
// src/app/api/v1/onboarding/templates/[id]/route.ts
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  targetType: z.enum(['NEW_HIRE', 'TRANSFER', 'REHIRE']).optional(),
  isActive: z.boolean().optional(),
})

export const GET = withPermission(
  async (_req, ctx, user: SessionUser) => {
    const { id } = await ctx.params
    const template = await prisma.onboardingTemplate.findFirst({
      where: { id, deletedAt: null, ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}) },
      include: { onboardingTasks: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!template) throw notFound('템플릿을 찾을 수 없습니다.')
    return apiSuccess(template)
  },
  perm(MODULE.ONBOARDING, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req, ctx, user: SessionUser) => {
    const { id } = await ctx.params
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })

    const existing = await prisma.onboardingTemplate.findFirst({
      where: { id, deletedAt: null, ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}) },
    })
    if (!existing) throw notFound('템플릿을 찾을 수 없습니다.')

    const updated = await prisma.onboardingTemplate.update({
      where: { id },
      data: parsed.data,
    })
    return apiSuccess(updated)
  },
  perm(MODULE.ONBOARDING, ACTION.UPDATE),
)

export const DELETE = withPermission(
  async (_req, ctx, user: SessionUser) => {
    const { id } = await ctx.params
    const existing = await prisma.onboardingTemplate.findFirst({
      where: { id, deletedAt: null, ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}) },
    })
    if (!existing) throw notFound('템플릿을 찾을 수 없습니다.')
    await prisma.onboardingTemplate.update({ where: { id }, data: { deletedAt: new Date() } })
    return apiSuccess({ deleted: true })
  },
  perm(MODULE.ONBOARDING, ACTION.DELETE),
)
```

### Step 4: tasks CRUD + reorder API 생성

```ts
// src/app/api/v1/onboarding/templates/[id]/tasks/route.ts
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const taskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  assigneeType: z.enum(['EMPLOYEE', 'MANAGER', 'HR', 'BUDDY']),
  dueDaysAfter: z.number().int().min(0),
  isRequired: z.boolean().default(true),
  category: z.enum(['DOCUMENT', 'TRAINING', 'SETUP', 'INTRODUCTION', 'OTHER']),
})

async function getTemplateOrThrow(id: string, user: SessionUser) {
  const template = await prisma.onboardingTemplate.findFirst({
    where: { id, deletedAt: null, ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}) },
  })
  if (!template) throw notFound('템플릿을 찾을 수 없습니다.')
  return template
}

export const GET = withPermission(
  async (_req, ctx, user: SessionUser) => {
    const { id } = await ctx.params
    await getTemplateOrThrow(id, user)
    const tasks = await prisma.onboardingTask.findMany({
      where: { templateId: id },
      orderBy: { sortOrder: 'asc' },
    })
    return apiSuccess(tasks)
  },
  perm(MODULE.ONBOARDING, ACTION.VIEW),
)

export const POST = withPermission(
  async (req, ctx, user: SessionUser) => {
    const { id } = await ctx.params
    await getTemplateOrThrow(id, user)
    const body = await req.json()
    const parsed = taskSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })

    const maxOrder = await prisma.onboardingTask.aggregate({
      where: { templateId: id },
      _max: { sortOrder: true },
    })
    const sortOrder = (maxOrder._max.sortOrder ?? 0) + 1

    const task = await prisma.onboardingTask.create({
      data: { ...parsed.data, templateId: id, sortOrder },
    })
    return apiSuccess(task, 201)
  },
  perm(MODULE.ONBOARDING, ACTION.CREATE),
)

// PUT (update) and DELETE on tasks use separate [id]/tasks/[taskId] - simplified version handles via reorder
```

```ts
// src/app/api/v1/onboarding/templates/[id]/tasks/reorder/route.ts
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const reorderSchema = z.object({
  taskIds: z.array(z.string().uuid()),
})

export const PUT = withPermission(
  async (req: NextRequest, ctx, user: SessionUser) => {
    const { id } = await ctx.params
    const template = await prisma.onboardingTemplate.findFirst({
      where: { id, deletedAt: null, ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}) },
    })
    if (!template) throw notFound('템플릿을 찾을 수 없습니다.')

    const body = await req.json()
    const parsed = reorderSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })

    await prisma.$transaction(
      parsed.data.taskIds.map((taskId, idx) =>
        prisma.onboardingTask.update({
          where: { id: taskId },
          data: { sortOrder: idx + 1 },
        }),
      ),
    )

    return apiSuccess({ reordered: true })
  },
  perm(MODULE.ONBOARDING, ACTION.UPDATE),
)
```

### Step 5: TypeScript 확인
```bash
cd /Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub && npx tsc --noEmit 2>&1 | grep -v "prisma.ts\|redis.ts" | head -20
```

---

## Task 4: Onboarding Settings UI (/settings/onboarding)

**Files:**
- Create: `src/app/(dashboard)/settings/onboarding/page.tsx`
- Create: `src/app/(dashboard)/settings/onboarding/OnboardingSettingsClient.tsx`

### Step 1: 디렉토리 생성
```bash
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/(dashboard)/settings/onboarding"
```

### Step 2: Server Page 생성
```tsx
// src/app/(dashboard)/settings/onboarding/page.tsx
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { OnboardingSettingsClient } from './OnboardingSettingsClient'

export default async function OnboardingSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return <OnboardingSettingsClient user={user} />
}
```

### Step 3: Client Component 생성 (OnboardingSettingsClient.tsx)
기능: 온보딩 템플릿 DataTable + 생성/수정/삭제 다이얼로그 + 태스크 드래그 정렬

```tsx
'use client'
// src/app/(dashboard)/settings/onboarding/OnboardingSettingsClient.tsx

import { useState, useEffect, useCallback } from 'react'
import {
  DndContext, closestCenter, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, GripVertical, Pencil, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// 템플릿 + 태스크 관리 UI
// DataTable 컬럼: 템플릿명 / 대상 유형 / 태스크 수 / 상태 / 액션
// 클릭 → 태스크 서랍(Drawer or Dialog)
// 태스크: DndContext + SortableContext로 드래그 정렬
// 정렬 변경 후 PUT /api/v1/onboarding/templates/:id/tasks/reorder 호출

// [전체 코드 구현 - 패턴은 EmployeeListClient.tsx와 동일]
// 주요 포인트:
// 1. useEffect로 apiClient.getList('/api/v1/onboarding/templates') 호출
// 2. 생성: Dialog open → form submit → apiClient.post → reload
// 3. 태스크 DnD: DragEndEvent → arrayMove → PUT reorder
// 4. 태스크 category 뱃지: DOCUMENT=blue / TRAINING=green / SETUP=yellow / INTRODUCTION=purple / OTHER=gray
```

> **주의:** 위 파일은 200줄 이상의 완전한 구현이 필요합니다. `EmployeeListClient.tsx` 패턴을 참조하여 완전히 구현하세요. DataTable + Dialog + DnD 패턴을 모두 포함해야 합니다.

### Step 4: 빌드 확인
```bash
cd /Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub && npx tsc --noEmit 2>&1 | grep -v "prisma.ts\|redis.ts" | head -20
```

---

## Task 5: Onboarding Dashboard API + UI

**Files:**
- Create: `src/app/api/v1/onboarding/dashboard/route.ts`
- Create: `src/app/api/v1/onboarding/tasks/[id]/complete/route.ts`
- Create: `src/app/api/v1/onboarding/[id]/force-complete/route.ts`
- Create: `src/app/(dashboard)/onboarding/page.tsx`
- Create: `src/app/(dashboard)/onboarding/OnboardingDashboardClient.tsx`

### Step 1: 디렉토리 생성
```bash
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/api/v1/onboarding/dashboard"
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/api/v1/onboarding/tasks/[id]/complete"
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/api/v1/onboarding/[id]/force-complete"
```

### Step 2: GET /api/v1/onboarding/dashboard
```ts
// src/app/api/v1/onboarding/dashboard/route.ts
// 반환: EmployeeOnboarding[] + employee + tasks + 진행률(completedTasks/totalTasks)
// 지연 기준: status=IN_PROGRESS AND 기한 초과 태스크 1개 이상 (task.completedAt IS NULL AND dueDate < now)

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const p = Object.fromEntries(req.nextUrl.searchParams)
    const page = Number(p.page ?? 1)
    const limit = Number(p.limit ?? 20)
    const status = p.status ?? undefined
    const companyId = user.role === 'SUPER_ADMIN' ? (p.companyId ?? undefined) : user.companyId

    const where = {
      ...(status ? { status } : { status: { in: ['IN_PROGRESS', 'COMPLETED'] } }),
      employee: { ...(companyId ? { companyId } : {}) },
    }

    const [total, onboardings] = await Promise.all([
      prisma.employeeOnboarding.count({ where }),
      prisma.employeeOnboarding.findMany({
        where,
        include: {
          employee: { select: { id: true, name: true, hireDate: true, companyId: true } },
          buddy: { select: { id: true, name: true } },
          template: { select: { id: true, name: true } },
          tasks: {
            include: { task: { select: { isRequired: true, dueDaysAfter: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    // 진행률 계산 + 지연 여부 판단
    const enriched = onboardings.map((ob) => {
      const total = ob.tasks.length
      const completed = ob.tasks.filter((t) => t.status === 'DONE').length
      const now = new Date()
      const isDelayed = ob.tasks.some((t) => {
        if (t.status === 'DONE') return false
        const dueDate = ob.startedAt
          ? new Date(ob.startedAt.getTime() + t.task.dueDaysAfter * 86400000)
          : null
        return dueDate ? dueDate < now : false
      })
      return { ...ob, progress: { total, completed }, isDelayed }
    })

    return apiPaginated(enriched, buildPagination(page, limit, total))
  },
  perm(MODULE.ONBOARDING, ACTION.VIEW),
)
```

### Step 3: PUT /api/v1/onboarding/tasks/[id]/complete
```ts
// src/app/api/v1/onboarding/tasks/[id]/complete/route.ts
// 태스크 완료 → status=DONE, completedAt, completedBy
// 전체 isRequired 태스크 완료 시 → EmployeeOnboarding.status=COMPLETED + Employee.onboardedAt

export const PUT = withPermission(
  async (_req, ctx, user: SessionUser) => {
    const { id } = await ctx.params

    const task = await prisma.employeeOnboardingTask.findUnique({
      where: { id },
      include: { employeeOnboarding: { include: { tasks: { include: { task: true } } } } },
    })
    if (!task) throw notFound('태스크를 찾을 수 없습니다.')

    await prisma.$transaction(async (tx) => {
      await tx.employeeOnboardingTask.update({
        where: { id },
        data: { status: 'DONE', completedAt: new Date(), completedBy: user.employeeId },
      })

      // 전체 required 태스크 완료 확인
      const updatedTasks = task.employeeOnboarding.tasks.map((t) =>
        t.id === id ? { ...t, status: 'DONE' } : t,
      )
      const allRequiredDone = updatedTasks
        .filter((t) => t.task.isRequired)
        .every((t) => t.status === 'DONE')

      if (allRequiredDone && task.employeeOnboarding.status !== 'COMPLETED') {
        await tx.employeeOnboarding.update({
          where: { id: task.employeeOnboardingId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        })
        await tx.employee.update({
          where: { id: task.employeeOnboarding.employeeId },
          data: { onboardedAt: new Date() },
        })
      }
    })

    return apiSuccess({ completed: true })
  },
  perm(MODULE.ONBOARDING, ACTION.UPDATE),
)
```

### Step 4: PUT /api/v1/onboarding/[id]/force-complete
```ts
// src/app/api/v1/onboarding/[id]/force-complete/route.ts
// HR 강제 완료: 미완료 태스크 SKIPPED + 사유 note 기록 → EmployeeOnboarding.status=COMPLETED

const forceCompleteSchema = z.object({ reason: z.string().min(1) })

export const PUT = withPermission(
  async (req, ctx, user: SessionUser) => {
    const { id } = await ctx.params
    const body = await req.json()
    const parsed = forceCompleteSchema.safeParse(body)
    if (!parsed.success) throw badRequest('사유를 입력해주세요.')

    const onboarding = await prisma.employeeOnboarding.findUnique({
      where: { id },
      include: { tasks: true, employee: { select: { companyId: true } } },
    })
    if (!onboarding) throw notFound('온보딩 기록을 찾을 수 없습니다.')
    if (user.role !== 'SUPER_ADMIN' && onboarding.employee.companyId !== user.companyId) {
      throw forbidden('권한이 없습니다.')
    }

    await prisma.$transaction(async (tx) => {
      const pendingTaskIds = onboarding.tasks
        .filter((t) => t.status !== 'DONE')
        .map((t) => t.id)

      if (pendingTaskIds.length > 0) {
        await tx.employeeOnboardingTask.updateMany({
          where: { id: { in: pendingTaskIds } },
          data: { status: 'SKIPPED', completedAt: new Date(), note: parsed.data.reason },
        })
      }

      await tx.employeeOnboarding.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })
      await tx.employee.update({
        where: { id: onboarding.employeeId },
        data: { onboardedAt: new Date() },
      })
    })

    return apiSuccess({ forceCompleted: true })
  },
  perm(MODULE.ONBOARDING, ACTION.APPROVE),
)
```

### Step 5: Onboarding Dashboard Page
```tsx
// src/app/(dashboard)/onboarding/page.tsx — Server Page (표준 패턴)
// src/app/(dashboard)/onboarding/OnboardingDashboardClient.tsx — Client Component
// 기능:
// - DataTable: 직원명 / 입사일 / 버디 / 템플릿 / 진행률(Progress Bar) / 상태 / 지연여부
// - isDelayed=true → 행 bg-yellow-50 하이라이트
// - 필터: status (ALL / IN_PROGRESS / COMPLETED / DELAYED)
// - "강제 완료" 버튼 (HR_ADMIN만) → Dialog(사유 입력) → PUT /force-complete

// Progress Bar 컴포넌트 (인라인):
// <div className="flex items-center gap-2">
//   <div className="flex-1 bg-gray-200 rounded-full h-2">
//     <div className="bg-ctr-primary h-2 rounded-full" style={{ width: `${(completed/total)*100}%` }} />
//   </div>
//   <span className="text-sm text-gray-600">{completed}/{total}</span>
// </div>
```

### Step 6: TypeScript 확인
```bash
cd /Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub && npx tsc --noEmit 2>&1 | grep -v "prisma.ts\|redis.ts" | head -20
```

---

## Task 6: Employee Onboarding View (me)

**Files:**
- Create: `src/app/api/v1/onboarding/me/route.ts`
- Create: `src/app/(dashboard)/onboarding/me/page.tsx`
- Create: `src/app/(dashboard)/onboarding/me/OnboardingMeClient.tsx`

### Step 1: 디렉토리 생성
```bash
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/api/v1/onboarding/me"
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/(dashboard)/onboarding/me"
```

### Step 2: GET /api/v1/onboarding/me
```ts
// src/app/api/v1/onboarding/me/route.ts
// 본인 온보딩 조회 — 인증된 사용자의 가장 최신 IN_PROGRESS 또는 최근 온보딩 반환

export const GET = withPermission(
  async (_req, _ctx, user: SessionUser) => {
    const onboarding = await prisma.employeeOnboarding.findFirst({
      where: { employeeId: user.employeeId },
      orderBy: { createdAt: 'desc' },
      include: {
        buddy: { select: { id: true, name: true, jobCategory: { select: { name: true } } } },
        template: { select: { id: true, name: true } },
        tasks: {
          include: {
            task: {
              select: {
                id: true, title: true, description: true,
                assigneeType: true, dueDaysAfter: true,
                isRequired: true, category: true, sortOrder: true,
              },
            },
          },
          orderBy: { task: { sortOrder: 'asc' } },
        },
      },
    })

    return apiSuccess(onboarding)
  },
  perm(MODULE.ONBOARDING, ACTION.VIEW),
)
```

### Step 3: Onboarding Me Page
```tsx
// src/app/(dashboard)/onboarding/me/page.tsx — Server Page
// src/app/(dashboard)/onboarding/me/OnboardingMeClient.tsx — Client Component
//
// UI 구조:
// 상단: 환영 배너 (이름 + "CTR HR Hub에 오신 것을 환영합니다!")
// 버디 정보 카드: 아바타 + 이름 + 직책
// 전체 진행률 프로그레스 바
//
// 태스크 목록 (카테고리별 그룹핑):
// const CATEGORY_ICONS = {
//   DOCUMENT: '📄',  TRAINING: '🎓',  SETUP: '💻',  INTRODUCTION: '👋',  OTHER: '📌'
// }
// const CATEGORY_LABELS = { DOCUMENT: '서류', TRAINING: '교육', SETUP: '장비', INTRODUCTION: '소개', OTHER: '기타' }
//
// 각 태스크: Checkbox + 제목 + assigneeType 뱃지 + 기한 + 상태
// 체크박스 클릭 → PUT /api/v1/onboarding/tasks/:id/complete
// isRequired=false인 태스크는 "(선택)" 텍스트 표시
```

### Step 4: TypeScript 확인
```bash
cd /Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub && npx tsc --noEmit 2>&1 | grep -v "prisma.ts\|redis.ts" | head -20
```

---

## Task 7: Onboarding Check-in API + UI

**Files:**
- Create: `src/app/api/v1/onboarding/checkin/route.ts`
- Create: `src/app/api/v1/onboarding/checkins/route.ts`
- Create: `src/app/api/v1/onboarding/checkins/[employeeId]/route.ts`
- Create: `src/app/api/v1/ai/onboarding-checkin-summary/route.ts`
- Create: `src/app/(dashboard)/onboarding/checkin/page.tsx`
- Create: `src/app/(dashboard)/onboarding/checkin/CheckinFormClient.tsx`
- Create: `src/app/(dashboard)/onboarding/checkins/page.tsx`
- Create: `src/app/(dashboard)/onboarding/checkins/CheckinsAdminClient.tsx`

### Step 1: 디렉토리 생성
```bash
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/api/v1/onboarding/checkin"
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/api/v1/onboarding/checkins/[employeeId]"
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/api/v1/ai/onboarding-checkin-summary"
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/(dashboard)/onboarding/checkin"
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/(dashboard)/onboarding/checkins"
```

### Step 2: POST /api/v1/onboarding/checkin
```ts
// src/app/api/v1/onboarding/checkin/route.ts
const checkinSchema = z.object({
  checkinWeek: z.number().int().min(1).max(52),
  mood: z.enum(['GREAT', 'GOOD', 'NEUTRAL', 'STRUGGLING', 'BAD']),
  energy: z.number().int().min(1).max(5),
  belonging: z.number().int().min(1).max(5),
  comment: z.string().optional(),
})

export const POST = withPermission(
  async (req, _ctx, user: SessionUser) => {
    const body = await req.json()
    const parsed = checkinSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })

    const checkin = await prisma.onboardingCheckin.create({
      data: {
        ...parsed.data,
        employeeId: user.employeeId,
        companyId: user.companyId,
        submittedAt: new Date(),
      },
    })
    return apiSuccess(checkin, 201)
  },
  perm(MODULE.ONBOARDING, ACTION.CREATE),
)
```

### Step 3: GET /api/v1/onboarding/checkins (HR_ADMIN)
```ts
// src/app/api/v1/onboarding/checkins/route.ts
// 전체 체크인 목록 반환 (company_id 필터 + 페이지네이션)
export const GET = withPermission(
  async (req, _ctx, user) => {
    const p = Object.fromEntries(req.nextUrl.searchParams)
    const page = Number(p.page ?? 1)
    const limit = Number(p.limit ?? 20)
    const companyId = user.role === 'SUPER_ADMIN' ? (p.companyId ?? undefined) : user.companyId

    const where = { ...(companyId ? { companyId } : {}) }
    const [total, checkins] = await Promise.all([
      prisma.onboardingCheckin.count({ where }),
      prisma.onboardingCheckin.findMany({
        where,
        include: { employee: { select: { id: true, name: true } } },
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])
    return apiPaginated(checkins, buildPagination(page, limit, total))
  },
  perm(MODULE.ONBOARDING, ACTION.VIEW),
)
```

### Step 4: GET /api/v1/onboarding/checkins/[employeeId]
```ts
// src/app/api/v1/onboarding/checkins/[employeeId]/route.ts
// 직원별 체크인 이력 반환
export const GET = withPermission(
  async (_req, ctx, user) => {
    const { employeeId } = await ctx.params
    const checkins = await prisma.onboardingCheckin.findMany({
      where: { employeeId, ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}) },
      orderBy: { checkinWeek: 'asc' },
    })
    return apiSuccess(checkins)
  },
  perm(MODULE.ONBOARDING, ACTION.VIEW),
)
```

### Step 5: POST /api/v1/ai/onboarding-checkin-summary
```ts
// src/app/api/v1/ai/onboarding-checkin-summary/route.ts
import { onboardingCheckinSummary } from '@/lib/claude'

const schema = z.object({ employeeId: z.string().uuid() })

export const POST = withPermission(
  async (req, _ctx, user) => {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })

    const employee = await prisma.employee.findFirst({
      where: { id: parsed.data.employeeId, ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}) },
    })
    if (!employee) throw notFound('직원을 찾을 수 없습니다.')

    const checkins = await prisma.onboardingCheckin.findMany({
      where: { employeeId: parsed.data.employeeId },
      orderBy: { checkinWeek: 'asc' },
    })
    if (checkins.length === 0) throw badRequest('체크인 데이터가 없습니다.')

    const summary = await onboardingCheckinSummary(
      employee.name,
      checkins.map((c) => ({
        week: c.checkinWeek, mood: c.mood, energy: c.energy,
        belonging: c.belonging, comment: c.comment,
      })),
      user.companyId,
      employee.id,
    )

    // 가장 최근 체크인에 ai_summary 저장
    const latestCheckin = checkins[checkins.length - 1]
    await prisma.onboardingCheckin.update({
      where: { id: latestCheckin.id },
      data: { aiSummary: JSON.stringify(summary) },
    })

    return apiSuccess({ summary, aiGenerated: true })
  },
  perm(MODULE.ONBOARDING, ACTION.APPROVE),
)
```

### Step 6: CheckinFormClient (EMPLOYEE)
```tsx
// src/app/(dashboard)/onboarding/checkin/CheckinFormClient.tsx
// mood 5단계 이모지 선택:
// const MOODS = [
//   { value: 'GREAT', emoji: '😃', label: '최고예요' },
//   { value: 'GOOD', emoji: '🙂', label: '좋아요' },
//   { value: 'NEUTRAL', emoji: '😐', label: '보통이에요' },
//   { value: 'STRUGGLING', emoji: '😟', label: '힘들어요' },
//   { value: 'BAD', emoji: '😢', label: '매우 힘들어요' },
// ]
// energy, belonging: 슬라이더 1~5 (<input type="range" min=1 max=5>)
// 제출 → POST /api/v1/onboarding/checkin
```

### Step 7: CheckinsAdminClient (HR_ADMIN)
```tsx
// src/app/(dashboard)/onboarding/checkins/CheckinsAdminClient.tsx
// DataTable: 직원명 / 주차 / Mood(이모지) / Energy / Belonging / 제출일
// 위험 신호 하이라이트: mood STRUGGLING/BAD OR belonging<=2 → bg-red-50
// 추세 차트 (Recharts LineChart):
// import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
// 직원별 mood(숫자변환) + energy + belonging 추이
// "AI 요약" 버튼 → POST /api/v1/ai/onboarding-checkin-summary → AiGeneratedBadge 표시
```

### Step 8: TypeScript 확인
```bash
cd /Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub && npx tsc --noEmit 2>&1 | grep -v "prisma.ts\|redis.ts" | head -20
```

---

## Task 8: Offboarding Checklist API + Settings UI

**Files:**
- Create: `src/app/api/v1/offboarding/checklists/route.ts`
- Create: `src/app/api/v1/offboarding/checklists/[id]/route.ts`
- Create: `src/app/api/v1/offboarding/checklists/[id]/tasks/route.ts`
- Create: `src/app/(dashboard)/settings/offboarding/page.tsx`
- Create: `src/app/(dashboard)/settings/offboarding/OffboardingSettingsClient.tsx`

### Step 1: 디렉토리 생성
```bash
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/api/v1/offboarding/checklists/[id]/tasks"
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/(dashboard)/settings/offboarding"
```

### Step 2: Offboarding Checklists API
온보딩 템플릿 API와 동일한 패턴. 차이점:
- `targetType`: `z.enum(['VOLUNTARY', 'INVOLUNTARY', 'RETIREMENT', 'CONTRACT_END', 'MUTUAL'])`
- 태스크 `assigneeType`: `z.enum(['EMPLOYEE', 'MANAGER', 'HR', 'IT', 'FINANCE'])`
- 태스크 기한: `dueDaysBefore` (퇴직일 기준 이전 N일)

```ts
// src/app/api/v1/offboarding/checklists/route.ts — GET, POST
// src/app/api/v1/offboarding/checklists/[id]/route.ts — GET, PUT, DELETE (soft delete)
// src/app/api/v1/offboarding/checklists/[id]/tasks/route.ts — GET, POST
// 온보딩 템플릿 API와 동일한 구조, 모델명/필드명만 변경:
// OnboardingTemplate → OffboardingChecklist
// onboardingTasks → offboardingTasks
// targetType enum: VOLUNTARY/INVOLUNTARY/RETIREMENT/CONTRACT_END/MUTUAL
// task: dueDaysBefore (not dueDaysAfter)
// OffboardingChecklist은 deletedAt이 없으므로 isActive로 비활성화
```

> **주의:** OffboardingChecklist은 schema에 deletedAt 없음. `isActive: false`로 비활성화.

### Step 3: Offboarding Settings UI
온보딩 설정 UI와 동일한 패턴 (DataTable + Dialog + 태스크 관리)
```tsx
// src/app/(dashboard)/settings/offboarding/OffboardingSettingsClient.tsx
// DataTable 컬럼: 체크리스트명 / 대상 유형(뱃지) / 태스크 수 / 상태
// 대상 유형 한국어:
// VOLUNTARY=자발적퇴사, INVOLUNTARY=비자발적퇴사, RETIREMENT=정년퇴직, CONTRACT_END=계약만료, MUTUAL=합의퇴직
// assigneeType 뱃지: EMPLOYEE=회색, MANAGER=파랑, HR=초록, IT=보라, FINANCE=주황
```

### Step 4: TypeScript 확인
```bash
cd /Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub && npx tsc --noEmit 2>&1 | grep -v "prisma.ts\|redis.ts" | head -20
```

---

## Task 9: 퇴직 처리 시작 API

**Files:**
- Create: `src/app/api/v1/employees/[id]/offboarding/start/route.ts`
- Modify: `src/app/(dashboard)/employees/[id]/EmployeeDetailClient.tsx`

### Step 1: 디렉토리 생성
```bash
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/api/v1/employees/[id]/offboarding/start"
```

### Step 2: POST /api/v1/employees/:id/offboarding/start

```ts
// src/app/api/v1/employees/[id]/offboarding/start/route.ts
import { sendNotifications } from '@/lib/notifications'
import { logAudit } from '@/lib/audit'

const startOffboardingSchema = z.object({
  resignType: z.enum(['VOLUNTARY', 'INVOLUNTARY', 'RETIREMENT', 'CONTRACT_END', 'MUTUAL']),
  lastWorkingDate: z.string().datetime(),
  resignReasonCode: z.string().optional(),
  resignReasonDetail: z.string().optional(),
  handoverToId: z.string().uuid().optional(),
})

export const POST = withPermission(
  async (req: NextRequest, ctx, user: SessionUser) => {
    const { id } = await ctx.params
    const body = await req.json()
    const parsed = startOffboardingSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })

    const employee = await prisma.employee.findFirst({
      where: { id, deletedAt: null, status: 'ACTIVE', ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}) },
      include: { manager: true },
    })
    if (!employee) throw notFound('재직 중인 직원을 찾을 수 없습니다.')

    // 퇴직 유형에 맞는 체크리스트 매칭
    const checklist = await prisma.offboardingChecklist.findFirst({
      where: { companyId: employee.companyId, targetType: parsed.data.resignType, isActive: true },
      include: { offboardingTasks: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!checklist) throw badRequest(`${parsed.data.resignType} 유형의 체크리스트가 없습니다. 설정에서 먼저 생성하세요.`)

    const newStatus = parsed.data.resignType === 'INVOLUNTARY' ? 'TERMINATED' : 'RESIGNED'
    const changeType = parsed.data.resignType === 'INVOLUNTARY' ? 'TERMINATE' : 'RESIGN'
    const lastWorkingDate = new Date(parsed.data.lastWorkingDate)

    const offboarding = await prisma.$transaction(async (tx) => {
      // 1. employees.status 변경
      await tx.employee.update({
        where: { id },
        data: { status: newStatus as 'RESIGNED' | 'TERMINATED', resignDate: lastWorkingDate },
      })

      // 2. employee_histories INSERT
      await tx.employeeHistory.create({
        data: {
          employeeId: id,
          companyId: employee.companyId,
          changeType: changeType as 'RESIGN' | 'TERMINATE',
          effectiveDate: lastWorkingDate,
          reason: parsed.data.resignReasonDetail,
          changedBy: user.employeeId,
        },
      })

      // 3. employee_offboarding INSERT
      const ob = await tx.employeeOffboarding.create({
        data: {
          employeeId: id,
          checklistId: checklist.id,
          resignType: parsed.data.resignType as ResignType,
          lastWorkingDate,
          resignReasonCode: parsed.data.resignReasonCode,
          resignReasonDetail: parsed.data.resignReasonDetail,
          handoverToId: parsed.data.handoverToId,
          status: 'IN_PROGRESS',
          startedAt: new Date(),
        },
      })

      // 4. 체크리스트 태스크 자동 생성
      if (checklist.offboardingTasks.length > 0) {
        await tx.employeeOffboardingTask.createMany({
          data: checklist.offboardingTasks.map((t) => ({
            employeeOffboardingId: ob.id,
            taskId: t.id,
            status: 'PENDING' as const,
          })),
        })
      }

      return ob
    })

    // 5. 알림 발송 (fire-and-forget)
    const daysUntilLeave = Math.round((lastWorkingDate.getTime() - Date.now()) / 86400000)
    const notifications = []

    if (employee.managerId) {
      notifications.push({
        employeeId: employee.managerId,
        triggerType: 'OFFBOARDING_START',
        title: '팀원 퇴직 처리',
        body: `팀원 ${employee.name}님이 퇴직 처리되었습니다.`,
        link: `/offboarding`,
      })
    }
    if (parsed.data.handoverToId) {
      notifications.push({
        employeeId: parsed.data.handoverToId,
        triggerType: 'HANDOVER_REQUEST',
        title: '업무 인수인계 요청',
        body: `${employee.name}님의 업무 인수인계가 요청되었습니다.`,
        link: `/offboarding`,
      })
    }
    // IT / 재무 알림은 실제로는 역할 기반으로 발송해야 하나 여기서는 HR 담당자에게
    sendNotifications(notifications)

    logAudit({
      actorId: user.employeeId,
      action: 'OFFBOARDING_START',
      resourceType: 'employee_offboarding',
      resourceId: offboarding.id,
      companyId: employee.companyId,
      changes: { resignType: parsed.data.resignType, lastWorkingDate: parsed.data.lastWorkingDate },
    })

    return apiSuccess(offboarding, 201)
  },
  perm(MODULE.ONBOARDING, ACTION.APPROVE), // OFFBOARDING 모듈 사용
)
```

> **참고:** `ResignType` import는 `@/generated/prisma/enums`에서 가져옴 (`import type { ResignType } from '@/generated/prisma/enums'`)

### Step 3: EmployeeDetailClient.tsx에 "퇴직 처리" 버튼 추가
`src/app/(dashboard)/employees/[id]/EmployeeDetailClient.tsx`를 읽고:
- `status === 'ACTIVE'` 조건 확인
- HR_ADMIN 권한 체크
- "퇴직 처리" 버튼 추가 (빨간색 `variant="destructive"`)
- 클릭 → Dialog: Step Wizard (1단계: 퇴직유형+날짜, 2단계: 사유+인수자, 3단계: 확인)
- 제출 → POST /api/v1/employees/:id/offboarding/start → 성공 시 /offboarding 이동

### Step 4: TypeScript 확인
```bash
cd /Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub && npx tsc --noEmit 2>&1 | grep -v "prisma.ts\|redis.ts" | head -20
```

---

## Task 10: Offboarding Dashboard API + UI

**Files:**
- Create: `src/app/api/v1/offboarding/dashboard/route.ts`
- Create: `src/app/api/v1/employees/[id]/offboarding/route.ts`
- Create: `src/app/api/v1/offboarding/[id]/tasks/[taskId]/complete/route.ts`
- Create: `src/app/api/v1/offboarding/[id]/cancel/route.ts`
- Create: `src/app/(dashboard)/offboarding/page.tsx`
- Create: `src/app/(dashboard)/offboarding/OffboardingDashboardClient.tsx`

### Step 1: 디렉토리 생성
```bash
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/api/v1/offboarding/dashboard"
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/api/v1/employees/[id]/offboarding"
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/api/v1/offboarding/[id]/tasks/[taskId]/complete"
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/api/v1/offboarding/[id]/cancel"
```

### Step 2: GET /api/v1/offboarding/dashboard
```ts
// D-7=7일 이하, D-3=3일 이하 경고 계산
// 반환: enriched EmployeeOffboarding[] with isD7, isD3, progress(completed/total)
export const GET = withPermission(
  async (req, _ctx, user) => {
    // company 필터 + status 필터 + 페이지네이션
    // include employee, checklist, offboardingTasks(with task)
    // 진행률: completed tasks / total tasks
    // D-3, D-7: Math.ceil((lastWorkingDate - now) / 86400000) <=3, <=7
    // 담당자 유형 필터: assigneeType query param
  },
  perm(MODULE.ONBOARDING, ACTION.VIEW),
)
```

### Step 3: PUT /api/v1/offboarding/[id]/tasks/[taskId]/complete
```ts
// 태스크 완료 처리
// 전체 isRequired 태스크 완료 시:
//   → EmployeeOffboarding.status = COMPLETED, completedAt
//   → IT 계정 비활성화 로직 호출 (Task 12에서 구현)
```

### Step 4: PUT /api/v1/offboarding/[id]/cancel
```ts
// 퇴직 취소 (HR만)
// employees.status = ACTIVE, resignDate = null
// employee_offboarding.status = CANCELLED
// employee_histories INSERT (RESIGN 취소 기록)
```

### Step 5: Offboarding Dashboard Page
```tsx
// src/app/(dashboard)/offboarding/OffboardingDashboardClient.tsx
// DataTable 컬럼: 직원명 / 법인 / 퇴직유형 / 최종근무일 / 진행률 / 상태 / 경고
// isD3 → 🔴 아이콘, isD7 → 🟡 아이콘 (최종근무일 컬럼에 표시)
// 탭: IN_PROGRESS / COMPLETED (별도 탭)
// 필터: 법인(CompanySelector) + assigneeType(IT미완료만, 재무미완료만 토글)
// 행 클릭 → /offboarding/:id 상세 페이지
```

### Step 6: TypeScript 확인
```bash
cd /Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub && npx tsc --noEmit 2>&1 | grep -v "prisma.ts\|redis.ts" | head -20
```

---

## Task 11: Exit Interview API + UI

**Files:**
- Create: `src/app/api/v1/offboarding/[id]/exit-interview/route.ts`
- Create: `src/app/api/v1/offboarding/[id]/exit-interview/ai-summary/route.ts`
- Create: `src/app/(dashboard)/offboarding/[id]/page.tsx`
- Create: `src/app/(dashboard)/offboarding/[id]/OffboardingDetailClient.tsx`

### Step 1: 디렉토리 생성
```bash
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/api/v1/offboarding/[id]/exit-interview/ai-summary"
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/(dashboard)/offboarding/[id]"
```

### Step 2: GET/POST /api/v1/offboarding/[id]/exit-interview
```ts
const exitInterviewSchema = z.object({
  interviewDate: z.string().datetime(),
  interviewerId: z.string().uuid().optional(), // 없으면 현재 사용자
  primaryReason: z.enum([
    'COMPENSATION', 'CAREER_GROWTH', 'WORK_LIFE_BALANCE',
    'MANAGEMENT', 'CULTURE', 'RELOCATION', 'PERSONAL', 'OTHER',
  ]),
  satisfactionScore: z.number().int().min(1).max(5),
  wouldRecommend: z.boolean().optional(),
  feedbackText: z.string().min(1),
})

export const POST = withPermission(
  async (req, ctx, user) => {
    const { id } = await ctx.params  // offboarding id
    // offboarding 조회 (company 권한 확인)
    // ExitInterview INSERT
    // EmployeeOffboarding.exitInterviewCompleted = true
    // return apiSuccess(interview, 201)
  },
  perm(MODULE.ONBOARDING, ACTION.CREATE),
)

export const GET = withPermission(
  async (_req, ctx, user) => {
    // exit interview 조회 + interviewer 정보 포함
  },
  perm(MODULE.ONBOARDING, ACTION.VIEW),
)
```

### Step 3: POST /api/v1/offboarding/[id]/exit-interview/ai-summary
```ts
import { exitInterviewSummary } from '@/lib/claude'
// 면담 기록 조회 → exitInterviewSummary() 호출 → ai_summary 저장
// AiGeneratedBadge용 aiGenerated: true 반환
```

### Step 4: Offboarding Detail Page (퇴직 상세)
```tsx
// src/app/(dashboard)/offboarding/[id]/OffboardingDetailClient.tsx
// 탭 구조:
//   1. 태스크 목록 (assigneeType 뱃지 + 상태 + 기한 + 완료 버튼)
//   2. 인수인계 (handoverToId + 문서 업로드)
//   3. 퇴직 면담 (ExitInterview 폼 or 결과 표시 + AI 요약 버튼)
//
// 퇴직 면담 폼:
// - 면담 일자 (DatePicker)
// - 면담자 (자동: 현재 사용자)
// - 주요 퇴사 사유 (Select)
// - 만족도 (별점 UI: ⭐ 1~5)
// - 추천 의향 (Switch)
// - 의견 (Textarea)
// - "저장" → POST exit-interview
// - "AI 분석" → POST ai-summary → AiGeneratedBadge
```

### Step 5: TypeScript 확인
```bash
cd /Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub && npx tsc --noEmit 2>&1 | grep -v "prisma.ts\|redis.ts" | head -20
```

---

## Task 12: 인수인계 + IT 계정 비활성화

**Files:**
- Create: `src/app/api/v1/files/presigned/route.ts`
- Create: `src/lib/offboarding-complete.ts`
- Modify: `src/app/api/v1/offboarding/[id]/tasks/[taskId]/complete/route.ts` (Task 10의 완성)

### Step 1: Presigned Upload URL API
```bash
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/api/v1/files/presigned"
```
```ts
// src/app/api/v1/files/presigned/route.ts
import { getPresignedUploadUrl, buildS3Key } from '@/lib/s3'

const schema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  entityType: z.string().min(1),  // e.g. 'handover', 'document'
  entityId: z.string().uuid(),
})

export const POST = withPermission(
  async (req, _ctx, user) => {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })

    const key = buildS3Key(user.companyId, parsed.data.entityType, parsed.data.entityId, parsed.data.filename)
    const uploadUrl = await getPresignedUploadUrl(key, parsed.data.contentType)

    return apiSuccess({ uploadUrl, key })
  },
  perm(MODULE.EMPLOYEES, ACTION.UPDATE),
)
```

### Step 2: IT 계정 비활성화 helper
```ts
// src/lib/offboarding-complete.ts
import { prisma } from '@/lib/prisma'

/**
 * 퇴직 완료 시 IT 계정 비활성화
 * - it_account_deactivated = true
 * - sso_sessions 모두 revoke
 * - employee_auth locked_until = 영구 (2099-12-31)
 */
export async function deactivateItAccount(
  tx: Awaited<ReturnType<typeof prisma.$transaction>>['0'] extends undefined
    ? typeof prisma
    : typeof prisma,
  employeeId: string,
): Promise<void> {
  await tx.employeeOffboarding.updateMany({
    where: { employeeId },
    data: { itAccountDeactivated: true },
  })

  await tx.ssoSession.updateMany({
    where: { employeeId, revokedAt: null },
    data: { revokedAt: new Date() },
  })

  await tx.employeeAuth.updateMany({
    where: { employeeId },
    data: { lockedUntil: new Date('2099-12-31') },
  })
}
```

> **주의:** Prisma transaction 타입 처리가 복잡할 수 있음. 함수 시그니처를 단순화하여 `tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]` 패턴 사용.

실제 구현 시 간단하게:
```ts
// lib/offboarding-complete.ts
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'

export async function deactivateItAccount(
  tx: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  employeeId: string,
): Promise<void> {
  await tx.employeeOffboarding.updateMany({
    where: { employeeId },
    data: { itAccountDeactivated: true },
  })
  await tx.ssoSession.updateMany({
    where: { employeeId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  await tx.employeeAuth.updateMany({
    where: { employeeId },
    data: { lockedUntil: new Date('2099-12-31') },
  })
}
```

### Step 3: offboarding task complete route 완성 (IT 비활성화 포함)
```ts
// src/app/api/v1/offboarding/[id]/tasks/[taskId]/complete/route.ts
import { deactivateItAccount } from '@/lib/offboarding-complete'

export const PUT = withPermission(
  async (_req, ctx, user) => {
    const { id, taskId } = await ctx.params

    const offboarding = await prisma.employeeOffboarding.findFirst({
      where: { id },
      include: {
        offboardingTasks: { include: { task: { select: { isRequired: true } } } },
        employee: { select: { companyId: true } },
      },
    })
    if (!offboarding) throw notFound('퇴직 기록을 찾을 수 없습니다.')
    if (user.role !== 'SUPER_ADMIN' && offboarding.employee.companyId !== user.companyId) {
      throw forbidden('권한이 없습니다.')
    }

    await prisma.$transaction(async (tx) => {
      await tx.employeeOffboardingTask.update({
        where: { id: taskId },
        data: { status: 'DONE', completedAt: new Date(), completedBy: user.employeeId },
      })

      const updatedTasks = offboarding.offboardingTasks.map((t) =>
        t.id === taskId ? { ...t, status: 'DONE' } : t,
      )
      const allRequiredDone = updatedTasks
        .filter((t) => t.task.isRequired)
        .every((t) => t.status === 'DONE')

      if (allRequiredDone && offboarding.status !== 'COMPLETED') {
        await tx.employeeOffboarding.update({
          where: { id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        })
        // IT 계정 비활성화
        await deactivateItAccount(tx, offboarding.employeeId)
      }
    })

    return apiSuccess({ completed: true })
  },
  perm(MODULE.ONBOARDING, ACTION.UPDATE),
)
```

### Step 4: TypeScript 확인
```bash
cd /Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub && npx tsc --noEmit 2>&1 | grep -v "prisma.ts\|redis.ts" | head -20
```

---

## Task 13: Self-Service Profile Change

**Files:**
- Create: `src/app/api/v1/profile/change-requests/route.ts`
- Create: `src/app/api/v1/profile/change-requests/pending/route.ts`
- Create: `src/app/api/v1/profile/change-requests/[id]/review/route.ts`
- Create: `src/app/(dashboard)/employees/me/page.tsx`
- Create: `src/app/(dashboard)/employees/me/ProfileSelfServiceClient.tsx`
- Create: `src/app/(dashboard)/settings/profile-requests/page.tsx`
- Create: `src/app/(dashboard)/settings/profile-requests/ProfileRequestsClient.tsx`

### Step 1: 디렉토리 생성
```bash
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/api/v1/profile/change-requests/[id]/review"
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/api/v1/profile/change-requests/pending"
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/(dashboard)/employees/me"
mkdir -p "/Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/(dashboard)/settings/profile-requests"
```

### Step 2: GET/POST /api/v1/profile/change-requests (EMPLOYEE)
```ts
// src/app/api/v1/profile/change-requests/route.ts
const ALLOWED_FIELDS = ['phone', 'emergencyContactName', 'emergencyContactPhone'] as const

const createSchema = z.object({
  fieldName: z.enum(ALLOWED_FIELDS),
  newValue: z.string().min(1),
})

export const GET = withPermission(
  async (_req, _ctx, user) => {
    const requests = await prisma.profileChangeRequest.findMany({
      where: { employeeId: user.employeeId },
      orderBy: { createdAt: 'desc' },
    })
    return apiSuccess(requests)
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)

export const POST = withPermission(
  async (req, _ctx, user) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })

    // 현재 값 조회
    const employee = await prisma.employee.findUnique({ where: { id: user.employeeId } })
    if (!employee) throw notFound('직원 정보를 찾을 수 없습니다.')

    const oldValue = String(employee[parsed.data.fieldName as keyof typeof employee] ?? '')

    const request = await prisma.profileChangeRequest.create({
      data: {
        employeeId: user.employeeId,
        fieldName: parsed.data.fieldName,
        oldValue,
        newValue: parsed.data.newValue,
        status: 'PENDING',
      },
    })
    return apiSuccess(request, 201)
  },
  perm(MODULE.EMPLOYEES, ACTION.UPDATE),
)
```

### Step 3: GET /api/v1/profile/change-requests/pending (HR_ADMIN)
```ts
// src/app/api/v1/profile/change-requests/pending/route.ts
// company_id 필터 적용
export const GET = withPermission(
  async (req, _ctx, user) => {
    const requests = await prisma.profileChangeRequest.findMany({
      where: {
        status: 'PENDING',
        employee: { companyId: user.role !== 'SUPER_ADMIN' ? user.companyId : undefined },
      },
      include: { employee: { select: { id: true, name: true, companyId: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return apiSuccess(requests)
  },
  perm(MODULE.EMPLOYEES, ACTION.APPROVE),
)
```

### Step 4: PUT /api/v1/profile/change-requests/[id]/review
```ts
// src/app/api/v1/profile/change-requests/[id]/review/route.ts
import { sendNotification } from '@/lib/notifications'
import { logAudit } from '@/lib/audit'

const reviewSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z.string().optional(),
})

export const PUT = withPermission(
  async (req, ctx, user) => {
    const { id } = await ctx.params
    const body = await req.json()
    const parsed = reviewSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })
    if (parsed.data.action === 'REJECT' && !parsed.data.rejectionReason) {
      throw badRequest('반려 사유를 입력해주세요.')
    }

    const request = await prisma.profileChangeRequest.findFirst({
      where: { id, status: 'PENDING' },
      include: { employee: true },
    })
    if (!request) throw notFound('처리할 요청이 없습니다.')
    if (user.role !== 'SUPER_ADMIN' && request.employee.companyId !== user.companyId) {
      throw forbidden('권한이 없습니다.')
    }

    if (parsed.data.action === 'APPROVE') {
      await prisma.$transaction(async (tx) => {
        // employees 테이블 해당 필드 반영
        await tx.employee.update({
          where: { id: request.employeeId },
          data: { [request.fieldName]: request.newValue },
        })
        await tx.profileChangeRequest.update({
          where: { id },
          data: { status: 'APPROVED', reviewedBy: user.employeeId, reviewedAt: new Date() },
        })
      })
      logAudit({
        actorId: user.employeeId, action: 'PROFILE_CHANGE_APPROVED',
        resourceType: 'profile_change_request', resourceId: id,
        companyId: user.companyId,
        changes: { fieldName: request.fieldName, newValue: request.newValue },
      })
      sendNotification({
        employeeId: request.employeeId,
        triggerType: 'PROFILE_CHANGE_APPROVED',
        title: '정보 수정 승인',
        body: '정보 수정 요청이 승인되었습니다.',
        link: '/employees/me',
      })
    } else {
      await prisma.profileChangeRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedBy: user.employeeId,
          reviewedAt: new Date(),
          rejectionReason: parsed.data.rejectionReason,
        },
      })
      sendNotification({
        employeeId: request.employeeId,
        triggerType: 'PROFILE_CHANGE_REJECTED',
        title: '정보 수정 반려',
        body: `정보 수정 요청이 반려되었습니다: ${parsed.data.rejectionReason}`,
        link: '/employees/me',
      })
    }

    return apiSuccess({ processed: true })
  },
  perm(MODULE.EMPLOYEES, ACTION.APPROVE),
)
```

### Step 5: ProfileSelfServiceClient (EMPLOYEE 본인 뷰)
```tsx
// src/app/(dashboard)/employees/me/ProfileSelfServiceClient.tsx
// 기능:
// 1. 본인 프로필 표시 (GET /api/v1/employees/:employeeId)
// 2. 수정 가능 필드: 전화번호(phone), 비상연락처 이름(emergencyContactName), 비상연락처 전화(emergencyContactPhone)
// 3. "수정 요청" 버튼 → Dialog: 필드 선택 + 현재값 표시 + 새 값 입력 → POST /api/v1/profile/change-requests
// 4. 내 요청 이력 목록 (상태 뱃지: PENDING=노랑, APPROVED=초록, REJECTED=빨강)
```

### Step 6: ProfileRequestsClient (HR_ADMIN)
```tsx
// src/app/(dashboard)/settings/profile-requests/ProfileRequestsClient.tsx
// DataTable 컬럼: 직원명 / 필드 / 현재값 → 새값 / 요청일 / 상태 / 액션
// 필드 한국어: phone=전화번호, emergencyContactName=비상연락처 이름, emergencyContactPhone=비상연락처 전화
// 승인/반려 버튼 (상태=PENDING인 경우만)
// 반려 시 Dialog → 사유 입력
```

### Step 7: TypeScript 확인
```bash
cd /Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub && npx tsc --noEmit 2>&1 | grep -v "prisma.ts\|redis.ts" | head -20
```

---

## Task 14: Final TypeScript Verification

### Step 1: 전체 빌드 오류 확인
```bash
cd /Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub && npx tsc --noEmit 2>&1
```
Expected: pre-existing 2개 오류 (`prisma.ts`, `redis.ts`) 외 0개

### Step 2: 오류 수정
TypeScript 오류 발생 시:
1. 오류 메시지 분석
2. 타입 단언 `as unknown as T` 사용 금지 — 실제 타입 수정
3. import 누락 확인 (`@/generated/prisma/enums` vs `@/generated/prisma/client`)
4. Zod v4: `.error?.issues` (NOT `.errors`)

### Step 3: 사이드바에 메뉴 추가 확인
```bash
grep -n "onboarding\|offboarding" /Users/sangwoo/Documents/VibeCoding/HR_Hub/ctr-hr-hub/src/app/(dashboard)/DashboardShell.tsx | head -20
```
사이드바에 온보딩, 오프보딩 메뉴가 없다면 DashboardShell.tsx에 추가:
- 온보딩: `/onboarding` (아이콘: UserCheck)
- 퇴직관리: `/offboarding` (아이콘: UserMinus)

### Step 4: context.md 업데이트
```bash
# STEP3 완료 후 context.md에 신규 파일 목록 추가
```

---

## 완료 기준 체크리스트

### API Routes (생성 필요)
- [ ] GET/POST /api/v1/onboarding/templates
- [ ] GET/PUT/DELETE /api/v1/onboarding/templates/[id]
- [ ] GET/POST /api/v1/onboarding/templates/[id]/tasks
- [ ] PUT /api/v1/onboarding/templates/[id]/tasks/reorder
- [ ] GET /api/v1/onboarding/dashboard
- [ ] GET /api/v1/onboarding/me
- [ ] PUT /api/v1/onboarding/tasks/[id]/complete
- [ ] PUT /api/v1/onboarding/[id]/force-complete
- [ ] POST /api/v1/onboarding/checkin
- [ ] GET /api/v1/onboarding/checkins
- [ ] GET /api/v1/onboarding/checkins/[employeeId]
- [ ] POST /api/v1/ai/onboarding-checkin-summary
- [ ] GET/POST /api/v1/offboarding/checklists
- [ ] GET/PUT/DELETE /api/v1/offboarding/checklists/[id]
- [ ] GET/POST /api/v1/offboarding/checklists/[id]/tasks
- [ ] POST /api/v1/employees/[id]/offboarding/start
- [ ] GET /api/v1/employees/[id]/offboarding
- [ ] GET /api/v1/offboarding/dashboard
- [ ] PUT /api/v1/offboarding/[id]/tasks/[taskId]/complete
- [ ] PUT /api/v1/offboarding/[id]/cancel
- [ ] GET/POST /api/v1/offboarding/[id]/exit-interview
- [ ] POST /api/v1/offboarding/[id]/exit-interview/ai-summary
- [ ] POST /api/v1/files/presigned
- [ ] GET/POST /api/v1/profile/change-requests
- [ ] GET /api/v1/profile/change-requests/pending
- [ ] PUT /api/v1/profile/change-requests/[id]/review

### Pages (생성 필요)
- [ ] /settings/onboarding
- [ ] /onboarding (대시보드)
- [ ] /onboarding/me
- [ ] /onboarding/checkin
- [ ] /onboarding/checkins
- [ ] /settings/offboarding
- [ ] /offboarding (대시보드)
- [ ] /offboarding/[id] (상세)
- [ ] /employees/me
- [ ] /settings/profile-requests

### Lib Files (생성/수정)
- [ ] lib/notifications.ts (신규)
- [ ] lib/offboarding-complete.ts (신규)
- [ ] lib/claude.ts에 onboardingCheckinSummary, exitInterviewSummary 추가
- [ ] lib/constants.ts에 CTR_VALUES 추가

### 최종 검증
- [ ] npx tsc --noEmit → pre-existing 오류 외 0개
- [ ] 사이드바 온보딩/퇴직관리 메뉴 확인
- [ ] context.md 업데이트

---

## Session 종료 시 context.md 업데이트 항목

```
## STEP3 신규 파일 (2026-02-27)

### API Routes
- src/app/api/v1/onboarding/templates/ (GET/POST)
- src/app/api/v1/onboarding/templates/[id]/ (GET/PUT/DELETE)
- src/app/api/v1/onboarding/templates/[id]/tasks/ (GET/POST)
- src/app/api/v1/onboarding/templates/[id]/tasks/reorder/ (PUT)
- src/app/api/v1/onboarding/dashboard/ (GET)
- src/app/api/v1/onboarding/me/ (GET)
- src/app/api/v1/onboarding/tasks/[id]/complete/ (PUT)
- src/app/api/v1/onboarding/[id]/force-complete/ (PUT)
- src/app/api/v1/onboarding/checkin/ (POST)
- src/app/api/v1/onboarding/checkins/ (GET)
- src/app/api/v1/onboarding/checkins/[employeeId]/ (GET)
- src/app/api/v1/ai/onboarding-checkin-summary/ (POST)
- src/app/api/v1/offboarding/checklists/ (GET/POST)
- src/app/api/v1/offboarding/checklists/[id]/ (GET/PUT/DELETE)
- src/app/api/v1/offboarding/checklists/[id]/tasks/ (GET/POST)
- src/app/api/v1/employees/[id]/offboarding/start/ (POST)
- src/app/api/v1/employees/[id]/offboarding/ (GET)
- src/app/api/v1/offboarding/dashboard/ (GET)
- src/app/api/v1/offboarding/[id]/tasks/[taskId]/complete/ (PUT)
- src/app/api/v1/offboarding/[id]/cancel/ (PUT)
- src/app/api/v1/offboarding/[id]/exit-interview/ (GET/POST)
- src/app/api/v1/offboarding/[id]/exit-interview/ai-summary/ (POST)
- src/app/api/v1/files/presigned/ (POST)
- src/app/api/v1/profile/change-requests/ (GET/POST)
- src/app/api/v1/profile/change-requests/pending/ (GET)
- src/app/api/v1/profile/change-requests/[id]/review/ (PUT)

### Pages
- src/app/(dashboard)/settings/onboarding/ + OnboardingSettingsClient.tsx
- src/app/(dashboard)/onboarding/ + OnboardingDashboardClient.tsx
- src/app/(dashboard)/onboarding/me/ + OnboardingMeClient.tsx
- src/app/(dashboard)/onboarding/checkin/ + CheckinFormClient.tsx
- src/app/(dashboard)/onboarding/checkins/ + CheckinsAdminClient.tsx
- src/app/(dashboard)/settings/offboarding/ + OffboardingSettingsClient.tsx
- src/app/(dashboard)/offboarding/ + OffboardingDashboardClient.tsx
- src/app/(dashboard)/offboarding/[id]/ + OffboardingDetailClient.tsx
- src/app/(dashboard)/employees/me/ + ProfileSelfServiceClient.tsx
- src/app/(dashboard)/settings/profile-requests/ + ProfileRequestsClient.tsx

### Lib Files
- src/lib/notifications.ts (알림 발송 helper)
- src/lib/offboarding-complete.ts (IT 계정 비활성화)
- src/lib/claude.ts: onboardingCheckinSummary, exitInterviewSummary 추가
- src/lib/constants.ts: CTR_VALUES 추가
- src/components/icons/CoreValueIcons.tsx: Ctr prefix aliases 추가

### claude.ts 추가 함수
- onboardingCheckinSummary (ONBOARDING_CHECKIN_SUMMARY feature)
- exitInterviewSummary (EXIT_INTERVIEW_SUMMARY feature)

### 퇴직 프로세스 상태 머신
IN_PROGRESS → COMPLETED (모든 필수 태스크 완료 + IT 계정 비활성화)
IN_PROGRESS → CANCELLED (HR 취소 + employee.status 복원)

### 다음 세션 (STEP4) 시작 전 확인
- recharts + @dnd-kit 패키지 설치 여부 확인
- DB 추가 인덱스 8개 적용 여부 확인
- /offboarding, /onboarding 페이지 정상 로드 확인
- 사이드바 메뉴 정상 표시 확인
```

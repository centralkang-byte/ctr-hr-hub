# STEP 6A Phase 1: EMS 유틸 + 평가사이클 + MBO 목표 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** EMS 9블록 산출 유틸, 평가 사이클 CRUD + 상태머신, MBO 목표 CRUD + 승인 플로우 + 진행률 관리를 구현한다.

**Architecture:** API-First 방식. lib/ems.ts에 9블록 산출 로직을 분리하고, 평가 사이클(CRUD + 상태전환)과 MBO 목표(CRUD + 승인 + 진행률) API를 구현한 후, 기존 discipline 패턴의 Server→Client 컴포넌트 구조로 페이지를 만든다.

**Tech Stack:** Next.js 14 App Router, Prisma, Zod, recharts 3.7.0, shadcn/ui, date-fns

---

## 스키마 참조 (이미 prisma/schema.prisma에 정의됨)
- PerformanceCycle: id, companyId, name, year, half(CycleHalf), goalStart, goalEnd, evalStart, evalEnd, status(CycleStatus), createdAt
- MboGoal: id, cycleId, employeeId, companyId, title, description?, weight(Decimal), targetMetric?, targetValue?, status(GoalStatus), achievementScore?(Decimal), approvedBy?, approvedAt?, aiGenerated, createdAt, updatedAt
- MboProgress: id, goalId, progressPct(Int), note?, createdBy, createdAt
- EmsBlockConfig: id, companyId, performanceAxisLabels(Json), competencyAxisLabels(Json), blockDefinitions(Json), performanceThresholds(Json), competencyThresholds(Json), isActive, createdAt

## 기존 패턴 참조
- API: `withPermission(handler, perm(MODULE.PERFORMANCE, ACTION.VIEW))` / `apiSuccess()` / `apiPaginated()` / `badRequest()` / `handlePrismaError()`
- 페이지: Server Component(getServerSession → redirect → <Client user={user} />) → Client Component(`apiClient.getList<T>()`)
- constants: MODULE.PERFORMANCE, ACTION.VIEW/CREATE/UPDATE/DELETE/APPROVE
- Decimal 필드: Number() 변환 필수

---

### Task 1: EMS 9블록 산출 유틸 (lib/ems.ts)

**Files:**
- Create: `src/lib/ems.ts`

**Step 1: lib/ems.ts 생성**

```ts
// src/lib/ems.ts
// EMS 9블록 산출 로직
// thresholds: [0, 2.33, 3.67, 5.01] → Low(0~2.33), Mid(2.33~3.67), High(3.67~5.01)

export interface EmsBlockResult {
  block: string          // "3C", "2B", "1A" 등
  blockNumber: number    // 1~9
  label: string
  color: string
  performanceBand: 'Low' | 'Mid' | 'High'
  competencyBand: 'Low' | 'Mid' | 'High'
}

export interface BlockDefinition {
  row: number
  col: string
  label: string
  color: string
}

const DEFAULT_THRESHOLDS = [0, 2.33, 3.67, 5.01]

function getBand(score: number, thresholds: number[]): 1 | 2 | 3 {
  if (score < thresholds[1]) return 1  // Low
  if (score < thresholds[2]) return 2  // Mid
  return 3                              // High
}

const BAND_LABELS: Record<number, 'Low' | 'Mid' | 'High'> = {
  1: 'Low',
  2: 'Mid',
  3: 'High',
}

const COL_MAP: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C' }

// 9블록 번호 매핑: [performanceBand][competencyBand]
// 스펙 기준: 1=LowLow, 2=MidLow, 3=HighLow, 4=LowMid, 5=MidMid, 6=HighMid, 7=LowHigh, 8=MidHigh, 9=HighHigh
const BLOCK_NUMBER_MAP: Record<string, number> = {
  '1A': 1, '2A': 2, '3A': 3,
  '1B': 4, '2B': 5, '3B': 6,
  '1C': 7, '2C': 8, '3C': 9,
}

export function calculateEmsBlock(
  performanceScore: number,
  competencyScore: number,
  blockDefinitions: BlockDefinition[],
  performanceThresholds: number[] = DEFAULT_THRESHOLDS,
  competencyThresholds: number[] = DEFAULT_THRESHOLDS,
): EmsBlockResult {
  const perfBand = getBand(performanceScore, performanceThresholds)
  const compBand = getBand(competencyScore, competencyThresholds)
  const col = COL_MAP[compBand]
  const blockKey = `${perfBand}${col}`
  const definition = blockDefinitions.find(d => d.row === perfBand && d.col === col)

  return {
    block: blockKey,
    blockNumber: BLOCK_NUMBER_MAP[blockKey] || 0,
    label: definition?.label || 'Unknown',
    color: definition?.color || 'gray',
    performanceBand: BAND_LABELS[perfBand],
    competencyBand: BAND_LABELS[compBand],
  }
}

// peer_weight 반영 역량 점수 조정 (다면평가용)
export function adjustCompetencyWithPeerReview(
  competencyScore: number,
  peerReviewAvg: number,
  peerWeight: number = 0.3,
): number {
  return competencyScore * (1 - peerWeight) + peerReviewAvg * peerWeight
}
```

**Step 2: Commit**
```bash
git add src/lib/ems.ts
git commit -m "feat(step6a): add EMS 9-block calculation utility"
```

---

### Task 2: 평가 사이클 API — 목록 + 생성

**Files:**
- Create: `src/app/api/v1/performance/cycles/route.ts`

**Step 1: GET(목록) + POST(생성) API**

```ts
// src/app/api/v1/performance/cycles/route.ts
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { MODULE, ACTION, ROLE, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'
import type { SessionUser } from '@/types'

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  year: z.coerce.number().int().optional(),
  status: z.string().optional(),
})

const createSchema = z.object({
  name: z.string().min(1).max(100),
  year: z.number().int().min(2020).max(2100),
  half: z.enum(['H1', 'H2', 'ANNUAL']),
  goalStart: z.string().datetime(),
  goalEnd: z.string().datetime(),
  evalStart: z.string().datetime(),
  evalEnd: z.string().datetime(),
})

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = searchSchema.safeParse(params)
    if (!parsed.success) throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })

    const { page, limit, year, status } = parsed.data
    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }
    const where = {
      ...companyFilter,
      ...(year && { year }),
      ...(status && { status: status as any }),
    }

    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      prisma.performanceCycle.findMany({
        where,
        orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: { company: { select: { name: true } } },
      }),
      prisma.performanceCycle.count({ where }),
    ])
    return apiPaginated(items, buildPagination(page, limit, total))
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })

    try {
      const cycle = await prisma.performanceCycle.create({
        data: {
          ...parsed.data,
          goalStart: new Date(parsed.data.goalStart),
          goalEnd: new Date(parsed.data.goalEnd),
          evalStart: new Date(parsed.data.evalStart),
          evalEnd: new Date(parsed.data.evalEnd),
          companyId: user.companyId,
          status: 'DRAFT',
        },
      })
      await logAudit({ actorId: user.employeeId, action: 'performance_cycle.create', targetType: 'PerformanceCycle', targetId: cycle.id, companyId: user.companyId })
      return apiSuccess(cycle, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.CREATE),
)
```

**Step 2: Commit**
```bash
git add src/app/api/v1/performance/cycles/route.ts
git commit -m "feat(step6a): add performance cycle list & create API"
```

---

### Task 3: 평가 사이클 API — 상세 + 수정 + 상태전환

**Files:**
- Create: `src/app/api/v1/performance/cycles/[id]/route.ts`
- Create: `src/app/api/v1/performance/cycles/[id]/advance/route.ts`

**Step 1: [id] GET + PUT**

```ts
// src/app/api/v1/performance/cycles/[id]/route.ts
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  goalStart: z.string().datetime().optional(),
  goalEnd: z.string().datetime().optional(),
  evalStart: z.string().datetime().optional(),
  evalEnd: z.string().datetime().optional(),
})

export const GET = withPermission(
  async (_req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params
    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }
    const cycle = await prisma.performanceCycle.findFirst({
      where: { id, ...companyFilter },
      include: {
        company: { select: { name: true } },
        _count: { select: { mboGoals: true, performanceEvaluations: true } },
      },
    })
    if (!cycle) throw notFound('평가 사이클을 찾을 수 없습니다.')
    return apiSuccess(cycle)
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })

    try {
      const data: Record<string, unknown> = {}
      if (parsed.data.name) data.name = parsed.data.name
      if (parsed.data.goalStart) data.goalStart = new Date(parsed.data.goalStart)
      if (parsed.data.goalEnd) data.goalEnd = new Date(parsed.data.goalEnd)
      if (parsed.data.evalStart) data.evalStart = new Date(parsed.data.evalStart)
      if (parsed.data.evalEnd) data.evalEnd = new Date(parsed.data.evalEnd)

      const cycle = await prisma.performanceCycle.update({ where: { id }, data })
      await logAudit({ actorId: user.employeeId, action: 'performance_cycle.update', targetType: 'PerformanceCycle', targetId: id, companyId: user.companyId })
      return apiSuccess(cycle)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.UPDATE),
)
```

**Step 2: 상태 전환 API (advance)**

```ts
// src/app/api/v1/performance/cycles/[id]/advance/route.ts
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

const STATUS_FLOW: Record<string, string> = {
  DRAFT: 'ACTIVE',
  ACTIVE: 'EVAL_OPEN',
  EVAL_OPEN: 'CALIBRATION',
  CALIBRATION: 'CLOSED',
}

export const PUT = withPermission(
  async (_req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params
    const cycle = await prisma.performanceCycle.findFirst({
      where: { id, ...(user.role !== ROLE.SUPER_ADMIN ? { companyId: user.companyId } : {}) },
    })
    if (!cycle) throw notFound('평가 사이클을 찾을 수 없습니다.')

    const nextStatus = STATUS_FLOW[cycle.status]
    if (!nextStatus) throw badRequest(`현재 상태(${cycle.status})에서 더 이상 전환할 수 없습니다.`)

    try {
      const updated = await prisma.performanceCycle.update({
        where: { id },
        data: { status: nextStatus as any },
      })
      await logAudit({
        actorId: user.employeeId,
        action: 'performance_cycle.advance',
        targetType: 'PerformanceCycle',
        targetId: id,
        companyId: user.companyId,
        meta: { from: cycle.status, to: nextStatus },
      })
      return apiSuccess(updated)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
```

**Step 3: Commit**
```bash
git add src/app/api/v1/performance/cycles/
git commit -m "feat(step6a): add cycle detail, update, and status advance API"
```

---

### Task 4: MBO 목표 API — CRUD + 승인

**Files:**
- Create: `src/app/api/v1/performance/goals/route.ts`
- Create: `src/app/api/v1/performance/goals/[id]/route.ts`
- Create: `src/app/api/v1/performance/goals/[id]/submit/route.ts`
- Create: `src/app/api/v1/performance/goals/[id]/approve/route.ts`
- Create: `src/app/api/v1/performance/goals/[id]/request-revision/route.ts`
- Create: `src/app/api/v1/performance/goals/[id]/progress/route.ts`
- Create: `src/app/api/v1/performance/team-goals/route.ts`

각 파일의 상세 코드는 discipline 패턴과 동일한 구조로:
- GET 목록: withPermission + Zod search 파싱 + Prisma findMany/count + apiPaginated
- POST 생성: withPermission + Zod body 파싱 + create + logAudit + apiSuccess(201)
- GET [id]: findFirst + notFound 처리
- PUT [id]: update + logAudit
- DELETE [id]: 물리 삭제 (deletedAt 없음)
- PUT submit: status DRAFT→PENDING_APPROVAL + 가중치 합계=100% 검증
- PUT approve: PENDING_APPROVAL→APPROVED + approvedBy + approvedAt
- PUT request-revision: PENDING_APPROVAL→REJECTED + 코멘트
- POST progress: MboProgress INSERT + MboGoal.achievementScore 업데이트
- GET team-goals: MANAGER의 직속 부하 목표 조회

**핵심 검증 로직 (submit 시):**
```ts
// 가중치 합계 100% 검증
const goals = await prisma.mboGoal.findMany({
  where: { cycleId, employeeId: user.employeeId },
})
const totalWeight = goals.reduce((sum, g) => sum + Number(g.weight), 0)
if (Math.abs(totalWeight - 100) > 0.01) {
  throw badRequest('목표 가중치 합계가 100%가 아닙니다.', { totalWeight })
}
```

**Step: 각 파일 생성 후 Commit**
```bash
git add src/app/api/v1/performance/goals/ src/app/api/v1/performance/team-goals/
git commit -m "feat(step6a): add MBO goal CRUD, approval flow, and progress API"
```

---

### Task 5: 사이드바 업데이트 — 성과관리 메뉴 확장

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**변경 내용:**
기존 성과관리 그룹에 캘리브레이션, Pulse 메뉴 추가. 사이클 관리는 settings 하위로.

기존 메뉴:
- 성과평가, 목표관리, 1:1 미팅, 역량평가

추가/수정:
- 성과평가 → 유지 (대시보드)
- 목표관리 → 유지
- 평가 사이클 → `/settings/performance-cycles` (HR_ADMIN, settings 그룹에)
- 캘리브레이션 → `/performance/calibration` (HR_ADMIN)
- 성과 결과 → `/performance/results`
- 1:1 미팅 → 유지
- 칭찬/인정 그룹 → 유지

Pulse 새 그룹:
```ts
{ label: '설문조사', icon: BarChart3, module: MODULE.PULSE, items: [
  { label: 'Pulse 응답', href: '/pulse', icon: MessageSquare },
  { label: '설문 관리', href: '/pulse/surveys', icon: Settings, roles: [ROLE.HR_ADMIN] },
  { label: '결과 분석', href: '/pulse/results', icon: BarChart3, roles: [ROLE.HR_ADMIN] },
]}
```

**Commit**
```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(step6a): expand sidebar with performance cycle, calibration, pulse menus"
```

---

### Task 6: 평가 사이클 관리 페이지

**Files:**
- Create: `src/app/(dashboard)/settings/performance-cycles/page.tsx`
- Create: `src/app/(dashboard)/settings/performance-cycles/PerformanceCyclesClient.tsx`
- Create: `src/app/(dashboard)/settings/performance-cycles/new/page.tsx`
- Create: `src/app/(dashboard)/settings/performance-cycles/new/NewCycleClient.tsx`
- Create: `src/app/(dashboard)/settings/performance-cycles/[id]/page.tsx`
- Create: `src/app/(dashboard)/settings/performance-cycles/[id]/CycleDetailClient.tsx`

**UI 패턴:**
- 목록 페이지: PageHeader("평가 사이클 관리") + 필터(연도, 상태) + 커스텀 table
- 사이클 생성: 폼(이름, 연도, 유형, 기간) + zodResolver
- 사이클 상세: 정보 카드 + 상태 전환 버튼 + 목표/평가 현황 요약

**상태 전환 버튼 (CycleDetailClient):**
```tsx
const STATUS_LABEL: Record<string, string> = {
  DRAFT: '초안', ACTIVE: '진행중', EVAL_OPEN: '평가중', CALIBRATION: '캘리브레이션', CLOSED: '확정'
}
const NEXT_STATUS: Record<string, string> = {
  DRAFT: '목표설정 시작', ACTIVE: '평가 시작', EVAL_OPEN: '캘리브레이션 시작', CALIBRATION: '결과 확정'
}
// "다음 단계" 버튼 → PUT /api/v1/performance/cycles/:id/advance
```

**Commit**
```bash
git add src/app/(dashboard)/settings/performance-cycles/
git commit -m "feat(step6a): add performance cycle management pages (list, create, detail)"
```

---

### Task 7: MBO 목표 관리 페이지 — 직원용

**Files:**
- Create: `src/app/(dashboard)/performance/goals/page.tsx`
- Create: `src/app/(dashboard)/performance/goals/GoalsClient.tsx`
- Create: `src/app/(dashboard)/performance/goals/new/page.tsx`
- Create: `src/app/(dashboard)/performance/goals/new/NewGoalClient.tsx`

**UI:**
- 목록: 현재 사이클의 내 목표 카드 형태 (목표명, 가중치%, 상태 뱃지, 달성률 프로그레스바)
- 하단: 가중치 합계 표시 (100%면 녹색, 아니면 빨간색)
- "제출" 버튼: 가중치 100% 검증 후 PUT submit
- 목표 생성 폼: 제목, 설명, 카테고리(Select), 가중치(Number), KPI, 목표값, 기한(DatePicker)
- 진행률 추가: 목표 카드 내 "진행 기록" 버튼 → Dialog(현재 달성률, 메모)

**상태 뱃지 스타일:**
```tsx
const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}
```

**Commit**
```bash
git add src/app/(dashboard)/performance/goals/
git commit -m "feat(step6a): add MBO goal management pages for employees"
```

---

### Task 8: 팀 목표 관리 페이지 — 매니저용

**Files:**
- Create: `src/app/(dashboard)/performance/team-goals/page.tsx`
- Create: `src/app/(dashboard)/performance/team-goals/TeamGoalsClient.tsx`

**UI:**
- DataTable: 직원명, 목표 수, 평균 달성률, 제출 상태
- 직원 행 클릭 → 해당 직원의 목표 상세 표시 (아코디언 또는 패널)
- 각 목표에 "승인" / "수정요청" 인라인 액션 버튼
- 수정요청 시 코멘트 입력 Dialog

**Commit**
```bash
git add src/app/(dashboard)/performance/team-goals/
git commit -m "feat(step6a): add team goals management page for managers"
```

---

### Task 9: 성과관리 대시보드 페이지

**Files:**
- Create: `src/app/(dashboard)/performance/page.tsx`
- Create: `src/app/(dashboard)/performance/PerformanceClient.tsx`

**역할별 UI:**
- EMPLOYEE: 현재 사이클 + 내 목표 요약 + 최근 결과
- MANAGER: 팀 목표 현황 + 평가 진행 현황
- HR_ADMIN: 전사 사이클 현황 + 평가 완료율

**Commit**
```bash
git add src/app/(dashboard)/performance/page.tsx src/app/(dashboard)/performance/PerformanceClient.tsx
git commit -m "feat(step6a): add performance dashboard page"
```

---

### Task 10: TypeScript 빌드 검증 + 최종 점검

**Step 1:** `npx tsc --noEmit` 에러 0개 확인
**Step 2:** dev 서버 실행하여 각 페이지 렌더링 확인
**Step 3:** API 호출 테스트 (dev tools Network 탭)

**Commit (필요시 수정 반영)**
```bash
git add -A
git commit -m "fix(step6a): resolve TypeScript errors and finalize Phase 1"
```

---

## Phase 2~6 요약 (Phase 1 완료 후 별도 계획 작성)

| Phase | 내용 | 예상 Task 수 |
|-------|------|-------------|
| 2 | 자기평가 + 매니저 평가 + AI 코멘트 | 8 |
| 3 | 캘리브레이션 규칙/세션 + 9블록 매트릭스 + 결과 조회 | 10 |
| 4 | 1:1 미팅 + Recognition | 8 |
| 5 | Pulse Survey 관리 + 응답 + 결과 분석 | 8 |
| 6 | 다면평가 추천엔진 + 선정 + 실시 + 결과 | 10 |


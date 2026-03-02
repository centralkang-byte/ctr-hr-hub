# B3-1: Competency Framework + 법인별 리뷰 설정 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** CTR Value System 2.0 13개 행동지표를 DB로 관리하고, B1 `evaluation_settings`에 따라 법인별로 다른 평가폼을 렌더링한다.

**Architecture:** 기존 `CompetencyLibrary` 테이블 유지 + 신규 5개 테이블(3-tier 역량 라이브러리) 병행. `/settings/competencies` 페이지를 신규 Admin UI로 교체. 매니저 평가폼은 `evaluation_settings.mboGrades`/`beiGrades`에서 동적으로 등급 버튼을 렌더링하도록 전환.

**Tech Stack:** Next.js 14 App Router, Prisma ORM, TypeScript, Tailwind CSS, Zod, React Hook Form

---

## 사전 확인 사항

- `context/TRACK_B.md` 에 미완료 migrate 없음 (B4 완료, B5 미시작)
- 기존 `CompetencyLibrary` 모델은 유지 (병행 운영)
- migrate 접두사: `a_` (A트랙 규칙)

---

## Task 1: DB 마이그레이션 — 5개 신규 테이블 + PerformanceEvaluation 필드 추가

**Files:**
- Modify: `prisma/schema.prisma`

### Step 1: schema.prisma에 Company 모델 역참조 추가 및 5개 모델 추가

`prisma/schema.prisma` 파일에서 `Company` 모델 찾기 (line ~677). `competencyLibrary CompetencyLibrary[]` 아래에 역참조 추가 후, 파일 끝에 5개 모델 추가.

**Company 모델에 추가 (competencyLibrary 줄 다음):**
```prisma
  competencyRequirements CompetencyRequirement[]
```

**파일 끝 (또는 CompetencyLibrary 모델 바로 뒤)에 5개 모델 추가:**
```prisma
// ================================================================
// B3-1: Competency Framework — 3-tier 역량 라이브러리
// ================================================================

model CompetencyCategory {
  id           String       @id @default(uuid()) @db.Uuid
  code         String       @unique @db.VarChar(50)
  name         String       @db.VarChar(100)
  nameEn       String?      @db.VarChar(100)
  description  String?      @db.Text
  displayOrder Int          @default(0) @map("display_order")
  isActive     Boolean      @default(true) @map("is_active")
  competencies Competency[]
  createdAt    DateTime     @default(now()) @map("created_at")
  updatedAt    DateTime     @updatedAt @map("updated_at")

  @@map("competency_categories")
}

model Competency {
  id           String              @id @default(uuid()) @db.Uuid
  categoryId   String              @db.Uuid @map("category_id")
  category     CompetencyCategory  @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  code         String              @db.VarChar(50)
  name         String              @db.VarChar(100)
  nameEn       String?             @db.VarChar(100) @map("name_en")
  description  String?             @db.Text
  displayOrder Int                 @default(0) @map("display_order")
  isActive     Boolean             @default(true) @map("is_active")
  levels       CompetencyLevel[]
  indicators   CompetencyIndicator[]
  requirements CompetencyRequirement[]
  createdAt    DateTime            @default(now()) @map("created_at")
  updatedAt    DateTime            @updatedAt @map("updated_at")

  @@unique([categoryId, code])
  @@map("competencies")
}

model CompetencyLevel {
  id           String     @id @default(uuid()) @db.Uuid
  competencyId String     @db.Uuid @map("competency_id")
  competency   Competency @relation(fields: [competencyId], references: [id], onDelete: Cascade)
  level        Int
  label        String     @db.VarChar(100)
  description  String?    @db.Text
  createdAt    DateTime   @default(now()) @map("created_at")

  @@unique([competencyId, level])
  @@map("competency_levels")
}

model CompetencyIndicator {
  id              String     @id @default(uuid()) @db.Uuid
  competencyId    String     @db.Uuid @map("competency_id")
  competency      Competency @relation(fields: [competencyId], references: [id], onDelete: Cascade)
  indicatorText   String     @db.Text @map("indicator_text")
  indicatorTextEn String?    @db.Text @map("indicator_text_en")
  displayOrder    Int        @default(0) @map("display_order")
  isActive        Boolean    @default(true) @map("is_active")
  createdAt       DateTime   @default(now()) @map("created_at")
  updatedAt       DateTime   @updatedAt @map("updated_at")

  @@map("competency_indicators")
}

model CompetencyRequirement {
  id            String     @id @default(uuid()) @db.Uuid
  competencyId  String     @db.Uuid @map("competency_id")
  competency    Competency @relation(fields: [competencyId], references: [id], onDelete: Cascade)
  jobId         String?    @db.Uuid @map("job_id")
  jobLevelCode  String?    @db.VarChar(20) @map("job_level_code")
  expectedLevel Int        @map("expected_level")
  companyId     String?    @db.Uuid @map("company_id")
  company       Company?   @relation(fields: [companyId], references: [id])
  createdAt     DateTime   @default(now()) @map("created_at")

  @@unique([competencyId, jobId, jobLevelCode, companyId])
  @@map("competency_requirements")
}
```

### Step 2: PerformanceEvaluation 모델에 grade 필드 추가

`prisma/schema.prisma`에서 `model PerformanceEvaluation` 찾기 (line ~2010). `competencyDetail Json?` 줄 다음에 추가:

```prisma
  performanceGrade  String?    @db.VarChar(20) @map("performance_grade")
  competencyGrade   String?    @db.VarChar(20) @map("competency_grade")
```

### Step 3: migrate 실행

```bash
cd /Users/sangwoo/Documents/VibeCoding/GHR/ctr-hr-hub
npx prisma migrate dev --name a_b3_competency_framework
```

Expected: 새 마이그레이션 파일 생성, `prisma generate` 자동 실행.

### Step 4: 타입 확인

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors 또는 신규 모델 관련 에러만.

---

## Task 2: 시드 데이터 — 역량 라이브러리 초기 데이터

**Files:**
- Modify: `prisma/seed.ts`

### Step 1: seed.ts의 `main()` 함수 끝 부분에 역량 시드 함수 추가

`prisma/seed.ts`에서 `console.log('====` 시작 부분 바로 앞에 다음 시드 블록 삽입:

```typescript
  // ================================================================
  // B3-1: Competency Framework Seed
  // ================================================================

  // ── 카테고리 ────────────────────────────────────────────────────
  const catCoreValue = deterministicUUID('compcat', 'core_value')
  const catLeadership = deterministicUUID('compcat', 'leadership')
  const catTechnical = deterministicUUID('compcat', 'technical')

  await prisma.competencyCategory.upsert({
    where: { code: 'core_value' },
    update: {},
    create: { id: catCoreValue, code: 'core_value', name: '핵심가치 역량', nameEn: 'Core Value Competency', displayOrder: 1 },
  })
  await prisma.competencyCategory.upsert({
    where: { code: 'leadership' },
    update: {},
    create: { id: catLeadership, code: 'leadership', name: '리더십 역량', nameEn: 'Leadership Competency', displayOrder: 2 },
  })
  await prisma.competencyCategory.upsert({
    where: { code: 'technical' },
    update: {},
    create: { id: catTechnical, code: 'technical', name: '직무 전문 역량', nameEn: 'Technical Competency', displayOrder: 3 },
  })

  // ── 핵심가치 역량 ────────────────────────────────────────────────
  const coreValues = [
    { code: 'challenge', name: '도전', nameEn: 'Challenge', order: 1, indicators: [
      '현재에 안주하지 않고 더 높은 목표를 설정한다',
      '새로운 방법을 시도하며 실패를 학습 기회로 활용한다',
      '변화에 능동적으로 대응하고 개선을 주도한다',
      '도전적 과제를 자발적으로 수행한다',
    ]},
    { code: 'trust', name: '신뢰', nameEn: 'Trust', order: 2, indicators: [
      '약속을 지키고 일관된 행동으로 신뢰를 쌓는다',
      '투명하게 정보를 공유하고 솔직하게 소통한다',
      '동료의 역량을 믿고 적절히 위임한다',
    ]},
    { code: 'responsibility', name: '책임', nameEn: 'Responsibility', order: 3, indicators: [
      '맡은 업무에 대해 끝까지 책임지고 완수한다',
      '문제 발생 시 원인을 찾고 해결책을 제시한다',
      '조직의 목표를 개인 업무에 연결하여 실행한다',
    ]},
    { code: 'respect', name: '존중', nameEn: 'Respect', order: 4, indicators: [
      '다양한 의견을 경청하고 건설적으로 반응한다',
      '동료의 기여를 인정하고 감사를 표현한다',
      '다른 문화와 배경을 이해하고 존중한다',
    ]},
  ]

  for (const cv of coreValues) {
    const compId = deterministicUUID('competency', cv.code)
    await prisma.competency.upsert({
      where: { categoryId_code: { categoryId: catCoreValue, code: cv.code } },
      update: {},
      create: { id: compId, categoryId: catCoreValue, code: cv.code, name: cv.name, nameEn: cv.nameEn, displayOrder: cv.order },
    })
    // 행동지표
    for (let i = 0; i < cv.indicators.length; i++) {
      const indId = deterministicUUID('indicator', `${cv.code}_${i}`)
      await prisma.competencyIndicator.upsert({
        where: { id: indId },
        update: {},
        create: { id: indId, competencyId: compId, indicatorText: cv.indicators[i], displayOrder: i + 1 },
      })
    }
    // 숙련도 레벨 5단계 (공통)
    const levelLabels = ['기초', '보통', '우수', '탁월', '전문가']
    for (let lvl = 1; lvl <= 5; lvl++) {
      const lvlId = deterministicUUID('complevel', `${cv.code}_${lvl}`)
      await prisma.competencyLevel.upsert({
        where: { competencyId_level: { competencyId: compId, level: lvl } },
        update: {},
        create: { id: lvlId, competencyId: compId, level: lvl, label: levelLabels[lvl - 1] },
      })
    }
    // 직급별 기대 레벨 (companyId NULL = 전 법인 공통)
    const levelMap: Record<string, number> = { S1: 2, S2: 3, S3: 4, S4: 4 }
    for (const [jlCode, expectedLevel] of Object.entries(levelMap)) {
      const reqId = deterministicUUID('compreq', `${cv.code}_${jlCode}`)
      await prisma.competencyRequirement.upsert({
        where: { competencyId_jobId_jobLevelCode_companyId: { competencyId: compId, jobId: null, jobLevelCode: jlCode, companyId: null } },
        update: {},
        create: { id: reqId, competencyId: compId, jobLevelCode: jlCode, expectedLevel },
      })
    }
  }

  // ── 리더십 역량 ────────────────────────────────────────────────
  const leadershipComps = [
    { code: 'strategic_thinking', name: '전략적 사고', nameEn: 'Strategic Thinking', order: 1 },
    { code: 'team_building', name: '팀 빌딩', nameEn: 'Team Building', order: 2 },
    { code: 'decision_making', name: '의사결정', nameEn: 'Decision Making', order: 3 },
  ]
  for (const lc of leadershipComps) {
    const compId = deterministicUUID('competency', lc.code)
    await prisma.competency.upsert({
      where: { categoryId_code: { categoryId: catLeadership, code: lc.code } },
      update: {},
      create: { id: compId, categoryId: catLeadership, code: lc.code, name: lc.name, nameEn: lc.nameEn, displayOrder: lc.order },
    })
    const levelLabels = ['기초', '보통', '우수', '탁월', '전문가']
    for (let lvl = 1; lvl <= 5; lvl++) {
      const lvlId = deterministicUUID('complevel', `${lc.code}_${lvl}`)
      await prisma.competencyLevel.upsert({
        where: { competencyId_level: { competencyId: compId, level: lvl } },
        update: {},
        create: { id: lvlId, competencyId: compId, level: lvl, label: levelLabels[lvl - 1] },
      })
    }
    // 리더십은 S3, S4에만 기대 레벨 설정
    for (const [jlCode, expectedLevel] of [['S3', 3], ['S4', 4]] as const) {
      const reqId = deterministicUUID('compreq', `${lc.code}_${jlCode}`)
      await prisma.competencyRequirement.upsert({
        where: { competencyId_jobId_jobLevelCode_companyId: { competencyId: compId, jobId: null, jobLevelCode: jlCode, companyId: null } },
        update: {},
        create: { id: reqId, competencyId: compId, jobLevelCode: jlCode, expectedLevel },
      })
    }
  }

  // ── 직무 전문 역량 ────────────────────────────────────────────────
  const technicalComps = [
    { code: 'welding', name: '용접 기술', nameEn: 'Welding Technology', order: 1 },
    { code: 'quality_mgmt', name: '품질 관리', nameEn: 'Quality Management', order: 2 },
    { code: 'mold_design', name: '금형 설계', nameEn: 'Mold Design', order: 3 },
    { code: 'injection_molding', name: '사출성형', nameEn: 'Injection Molding', order: 4 },
    { code: 'plc_programming', name: 'PLC 프로그래밍', nameEn: 'PLC Programming', order: 5 },
  ]
  for (const tc of technicalComps) {
    const compId = deterministicUUID('competency', tc.code)
    await prisma.competency.upsert({
      where: { categoryId_code: { categoryId: catTechnical, code: tc.code } },
      update: {},
      create: { id: compId, categoryId: catTechnical, code: tc.code, name: tc.name, nameEn: tc.nameEn, displayOrder: tc.order },
    })
    const levelLabels = ['기초', '보통', '우수', '탁월', '전문가']
    for (let lvl = 1; lvl <= 5; lvl++) {
      const lvlId = deterministicUUID('complevel', `${tc.code}_${lvl}`)
      await prisma.competencyLevel.upsert({
        where: { competencyId_level: { competencyId: compId, level: lvl } },
        update: {},
        create: { id: lvlId, competencyId: compId, level: lvl, label: levelLabels[lvl - 1] },
      })
    }
  }

  const competencyCount = await prisma.competency.count()
  const indicatorCount = await prisma.competencyIndicator.count()
  console.log(`  Competencies:        ${competencyCount}`)
  console.log(`  Indicators:          ${indicatorCount}`)
```

### Step 2: 시드 실행

```bash
cd /Users/sangwoo/Documents/VibeCoding/GHR/ctr-hr-hub
npx prisma db seed
```

Expected: `Competencies: 12`, `Indicators: 13` (또는 실제 수치)

---

## Task 3: Competency API Routes

**Files:**
- Create: `src/app/api/v1/competencies/route.ts`
- Create: `src/app/api/v1/competencies/[id]/route.ts`
- Create: `src/app/api/v1/competencies/[id]/indicators/route.ts`
- Create: `src/app/api/v1/competencies/[id]/levels/route.ts`

### Step 1: 역량 목록/생성 API 생성

`src/app/api/v1/competencies/route.ts`:

```typescript
// GET /api/v1/competencies?categoryCode=core_value
// POST /api/v1/competencies

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const listSchema = z.object({
  categoryCode: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
})

const createSchema = z.object({
  categoryId: z.string().uuid(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  nameEn: z.string().max(100).optional(),
  description: z.string().optional(),
  displayOrder: z.number().int().default(0),
})

export const GET = withPermission(
  async (req: NextRequest, _ctx, _user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = listSchema.safeParse(params)
    if (!parsed.success) throw badRequest('잘못된 파라미터', { issues: parsed.error.issues })

    const { categoryCode, isActive, page, limit } = parsed.data

    const where = {
      ...(categoryCode ? { category: { code: categoryCode } } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.competency.findMany({
        where,
        orderBy: [{ category: { displayOrder: 'asc' } }, { displayOrder: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: { select: { id: true, code: true, name: true } },
          _count: { select: { indicators: { where: { isActive: true } }, levels: true } },
        },
      }),
      prisma.competency.count({ where }),
    ])

    return apiPaginated(items, buildPagination(page, limit, total))
  },
  perm(MODULE.SETTINGS, ACTION.READ),
)

export const POST = withPermission(
  async (req: NextRequest, _ctx, _user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청 데이터', { issues: parsed.error.issues })

    try {
      const item = await prisma.competency.create({ data: parsed.data })
      return apiSuccess(item, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.CREATE),
)
```

### Step 2: 역량 상세/수정/삭제 API

`src/app/api/v1/competencies/[id]/route.ts`:

```typescript
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  nameEn: z.string().max(100).optional(),
  description: z.string().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export const GET = withPermission(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }, _user: SessionUser) => {
    const { id } = await ctx.params
    const item = await prisma.competency.findUnique({
      where: { id },
      include: {
        category: true,
        indicators: { where: { isActive: true }, orderBy: { displayOrder: 'asc' } },
        levels: { orderBy: { level: 'asc' } },
        requirements: true,
      },
    })
    if (!item) throw notFound('역량을 찾을 수 없습니다.')
    return apiSuccess(item)
  },
  perm(MODULE.SETTINGS, ACTION.READ),
)

export const PUT = withPermission(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }, _user: SessionUser) => {
    const { id } = await ctx.params
    const body: unknown = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청 데이터', { issues: parsed.error.issues })

    try {
      const item = await prisma.competency.update({ where: { id }, data: parsed.data })
      return apiSuccess(item)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)

export const DELETE = withPermission(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }, _user: SessionUser) => {
    const { id } = await ctx.params
    try {
      await prisma.competency.delete({ where: { id } })
      return apiSuccess({ deleted: true })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.DELETE),
)
```

### Step 3: 행동지표 API (bulk replace 패턴)

`src/app/api/v1/competencies/[id]/indicators/route.ts`:

```typescript
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const indicatorSchema = z.object({
  id: z.string().uuid().optional(),
  indicatorText: z.string().min(1),
  indicatorTextEn: z.string().optional(),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
})

const bulkSchema = z.object({ indicators: z.array(indicatorSchema) })

export const GET = withPermission(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }, _user: SessionUser) => {
    const { id } = await ctx.params
    const items = await prisma.competencyIndicator.findMany({
      where: { competencyId: id },
      orderBy: { displayOrder: 'asc' },
    })
    return apiSuccess(items)
  },
  perm(MODULE.SETTINGS, ACTION.READ),
)

// PUT — bulk replace: 전체 행동지표를 교체
export const PUT = withPermission(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }, _user: SessionUser) => {
    const { id: competencyId } = await ctx.params
    const body: unknown = await req.json()
    const parsed = bulkSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청', { issues: parsed.error.issues })

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 기존 지표 삭제
        await tx.competencyIndicator.deleteMany({ where: { competencyId } })
        // 신규 지표 생성
        const created = await tx.competencyIndicator.createMany({
          data: parsed.data.indicators.map((ind, idx) => ({
            competencyId,
            indicatorText: ind.indicatorText,
            indicatorTextEn: ind.indicatorTextEn,
            displayOrder: ind.displayOrder ?? idx + 1,
            isActive: ind.isActive,
          })),
        })
        return created
      })
      return apiSuccess(result)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)
```

### Step 4: 숙련도 레벨 API

`src/app/api/v1/competencies/[id]/levels/route.ts`:

```typescript
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const levelSchema = z.object({
  level: z.number().int().min(1).max(10),
  label: z.string().min(1).max(100),
  description: z.string().optional(),
})
const bulkSchema = z.object({ levels: z.array(levelSchema) })

export const GET = withPermission(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }, _user: SessionUser) => {
    const { id } = await ctx.params
    const items = await prisma.competencyLevel.findMany({
      where: { competencyId: id },
      orderBy: { level: 'asc' },
    })
    return apiSuccess(items)
  },
  perm(MODULE.SETTINGS, ACTION.READ),
)

export const PUT = withPermission(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }, _user: SessionUser) => {
    const { id: competencyId } = await ctx.params
    const body: unknown = await req.json()
    const parsed = bulkSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청', { issues: parsed.error.issues })

    try {
      const result = await prisma.$transaction(async (tx) => {
        await tx.competencyLevel.deleteMany({ where: { competencyId } })
        return tx.competencyLevel.createMany({
          data: parsed.data.levels.map((l) => ({
            competencyId,
            level: l.level,
            label: l.label,
            description: l.description,
          })),
        })
      })
      return apiSuccess(result)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)
```

### Step 5: tsc 확인

```bash
cd /Users/sangwoo/Documents/VibeCoding/GHR/ctr-hr-hub
npx tsc --noEmit 2>&1 | grep -E "error|Error" | head -20
```

Expected: 0 errors

---

## Task 4: CompetencyLibraryAdmin UI — `/settings/competencies` 교체

**Files:**
- Replace: `src/app/(dashboard)/settings/competencies/CompetencyListClient.tsx`
- (page.tsx는 그대로 유지)

### Step 1: 신규 CompetencyLibraryAdmin 컴포넌트 작성

기존 `CompetencyListClient.tsx` 전체를 새 코드로 교체:

```typescript
'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Competency Library Admin (B3-1)
// 3-tier 역량 라이브러리 관리: 카테고리 탭 + 역량 CRUD
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Plus, Pencil, Trash2, Loader2, ChevronRight, X } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import IndicatorEditor from './IndicatorEditor'
import CompetencyLevelEditor from './CompetencyLevelEditor'

// ─── Types ─────────────────────────────────────────────────

interface CompetencyCategory {
  id: string; code: string; name: string; displayOrder: number; isActive: boolean
}
interface Competency {
  id: string; categoryId: string; code: string; name: string; nameEn: string | null
  description: string | null; displayOrder: number; isActive: boolean
  category: { id: string; code: string; name: string }
  _count: { indicators: number; levels: number }
}
interface CompetencyDetail extends Competency {
  indicators: Indicator[]
  levels: Level[]
}
interface Indicator {
  id: string; indicatorText: string; indicatorTextEn: string | null; displayOrder: number; isActive: boolean
}
interface Level {
  id: string; level: number; label: string; description: string | null
}

type ActivePanel = 'none' | 'detail' | 'add'

// ─── Hardcoded categories (fetched from seed) ──────────────

const CATEGORY_TABS = [
  { code: 'core_value', label: '핵심가치 역량' },
  { code: 'leadership', label: '리더십 역량' },
  { code: 'technical', label: '직무 전문 역량' },
]

// ─── Component ─────────────────────────────────────────────

export function CompetencyListClient({ user: _user }: { user: SessionUser }) {
  const [activeCategory, setActiveCategory] = useState('core_value')
  const [competencies, setCompetencies] = useState<Competency[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCompetency, setSelectedCompetency] = useState<CompetencyDetail | null>(null)
  const [panel, setPanel] = useState<ActivePanel>('none')
  const [detailLoading, setDetailLoading] = useState(false)

  // Add form state
  const [addName, setAddName] = useState('')
  const [addNameEn, setAddNameEn] = useState('')
  const [addCode, setAddCode] = useState('')
  const [addDesc, setAddDesc] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.getList<Competency>('/api/v1/competencies', { categoryCode: activeCategory, limit: 100 })
      setCompetencies(res.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [activeCategory])

  useEffect(() => { fetchList() }, [fetchList])

  const openDetail = async (comp: Competency) => {
    setPanel('detail')
    setDetailLoading(true)
    try {
      const res = await apiClient.get<CompetencyDetail>(`/api/v1/competencies/${comp.id}`)
      setSelectedCompetency(res.data)
    } catch { /* ignore */ }
    finally { setDetailLoading(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('역량을 삭제하시겠습니까? 관련 행동지표와 레벨도 모두 삭제됩니다.')) return
    try {
      await apiClient.delete(`/api/v1/competencies/${id}`)
      await fetchList()
      if (selectedCompetency?.id === id) { setSelectedCompetency(null); setPanel('none') }
    } catch { alert('삭제에 실패했습니다.') }
  }

  const handleAdd = async () => {
    if (!addName || !addCode) return alert('이름과 코드를 입력하세요.')
    const cat = CATEGORY_TABS.find((c) => c.code === activeCategory)
    if (!cat) return
    // Get categoryId from list
    const existing = competencies[0]
    if (!existing) return alert('카테고리 정보를 불러올 수 없습니다. 역량이 없는 카테고리에 추가하려면 새로고침 후 시도하세요.')
    const categoryId = existing.category.id

    setAddSaving(true)
    try {
      await apiClient.post('/api/v1/competencies', { categoryId, code: addCode, name: addName, nameEn: addNameEn, description: addDesc })
      setAddName(''); setAddCode(''); setAddNameEn(''); setAddDesc('')
      setPanel('none')
      await fetchList()
    } catch { alert('추가에 실패했습니다.') }
    finally { setAddSaving(false) }
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="역량 라이브러리 관리" description="CTR Value System 2.0 핵심가치 행동지표 및 리더십·직무 역량을 관리합니다." />

      {/* Category tabs */}
      <div className="flex border-b border-[#E8E8E8]">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.code}
            onClick={() => { setActiveCategory(tab.code); setPanel('none'); setSelectedCompetency(null) }}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeCategory === tab.code
                ? 'border-b-2 border-[#00C853] text-[#00C853]'
                : 'text-[#666] hover:text-[#333]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Competency list */}
        <div className="flex-1">
          <div className="rounded-xl border border-[#E8E8E8] bg-white">
            <div className="px-5 py-4 border-b border-[#E8E8E8] flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#1A1A1A] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#666]" />
                {CATEGORY_TABS.find((t) => t.code === activeCategory)?.label}
              </h2>
              <Button size="sm" onClick={() => setPanel('add')} className="bg-[#00C853] hover:bg-[#00A844] text-white">
                <Plus className="w-4 h-4 mr-1" /> 역량 추가
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-[#00C853]" /></div>
            ) : competencies.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-[#999]">역량이 없습니다. 역량을 추가하세요.</div>
            ) : (
              <div className="divide-y divide-[#F5F5F5]">
                {competencies.map((comp) => (
                  <div key={comp.id} className={`flex items-center justify-between px-5 py-4 hover:bg-[#FAFAFA] cursor-pointer transition-colors ${selectedCompetency?.id === comp.id ? 'bg-[#E8F5E9]' : ''}`} onClick={() => openDetail(comp)}>
                    <div>
                      <p className="text-sm font-medium text-[#1A1A1A]">{comp.name} {comp.nameEn && <span className="text-[#999] font-normal">({comp.nameEn})</span>}</p>
                      <p className="text-xs text-[#999] mt-0.5">행동지표 {comp._count.indicators}개 | 숙련도 레벨 {comp._count.levels}단계</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={comp.isActive ? 'default' : 'secondary'} className={comp.isActive ? 'bg-[#D1FAE5] text-[#047857]' : ''}>{comp.isActive ? '활성' : '비활성'}</Badge>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(comp.id) }} className="p-1.5 rounded-lg hover:bg-[#FEE2E2] text-[#999] hover:text-[#DC2626] transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-[#999]" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Side panel */}
        {panel !== 'none' && (
          <div className="w-96 shrink-0">
            {panel === 'add' && (
              <div className="rounded-xl border border-[#E8E8E8] bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-[#1A1A1A]">역량 추가</h3>
                  <button onClick={() => setPanel('none')}><X className="w-4 h-4 text-[#999]" /></button>
                </div>
                {[
                  { label: '코드 (영문)', value: addCode, onChange: setAddCode, placeholder: 'challenge' },
                  { label: '이름 (한국어)', value: addName, onChange: setAddName, placeholder: '도전' },
                  { label: '이름 (영문, 선택)', value: addNameEn, onChange: setAddNameEn, placeholder: 'Challenge' },
                  { label: '설명 (선택)', value: addDesc, onChange: setAddDesc, placeholder: '역량 설명...' },
                ].map(({ label, value, onChange, placeholder }) => (
                  <div key={label}>
                    <label className="text-xs font-medium text-[#333] mb-1 block">{label}</label>
                    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
                      className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 placeholder:text-[#999]" />
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => setPanel('none')} className="flex-1">취소</Button>
                  <Button size="sm" onClick={handleAdd} disabled={addSaving} className="flex-1 bg-[#00C853] hover:bg-[#00A844] text-white">
                    {addSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : '추가'}
                  </Button>
                </div>
              </div>
            )}

            {panel === 'detail' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-[#E8E8E8] bg-white p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-[#1A1A1A]">{selectedCompetency?.name ?? '...'}
                      {selectedCompetency?.nameEn && <span className="text-sm font-normal text-[#999] ml-1">({selectedCompetency.nameEn})</span>}
                    </h3>
                    <button onClick={() => { setPanel('none'); setSelectedCompetency(null) }}><X className="w-4 h-4 text-[#999]" /></button>
                  </div>
                  {detailLoading && <div className="flex items-center justify-center h-16"><Loader2 className="w-4 h-4 animate-spin text-[#00C853]" /></div>}
                </div>

                {selectedCompetency && !detailLoading && (
                  <>
                    <IndicatorEditor
                      competencyId={selectedCompetency.id}
                      competencyName={selectedCompetency.name}
                      initialIndicators={selectedCompetency.indicators}
                      onSaved={() => openDetail(selectedCompetency)}
                    />
                    <CompetencyLevelEditor
                      competencyId={selectedCompetency.id}
                      competencyName={selectedCompetency.name}
                      initialLevels={selectedCompetency.levels}
                      onSaved={() => openDetail(selectedCompetency)}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

---

## Task 5: IndicatorEditor 컴포넌트

**Files:**
- Create: `src/app/(dashboard)/settings/competencies/IndicatorEditor.tsx`

```typescript
'use client'

import { useState } from 'react'
import { Plus, Trash2, ArrowUp, ArrowDown, Save, Loader2 } from 'lucide-react'
import { apiClient } from '@/lib/api'

interface Indicator {
  id?: string; indicatorText: string; indicatorTextEn: string | null; displayOrder: number; isActive: boolean
}

interface Props {
  competencyId: string
  competencyName: string
  initialIndicators: Indicator[]
  onSaved: () => void
}

export default function IndicatorEditor({ competencyId, competencyName, initialIndicators, onSaved }: Props) {
  const [indicators, setIndicators] = useState<Indicator[]>(
    [...initialIndicators].sort((a, b) => a.displayOrder - b.displayOrder)
  )
  const [saving, setSaving] = useState(false)

  const update = (idx: number, field: keyof Indicator, value: string | boolean) => {
    setIndicators((prev) => prev.map((ind, i) => i === idx ? { ...ind, [field]: value } : ind))
  }

  const moveUp = (idx: number) => {
    if (idx === 0) return
    setIndicators((prev) => {
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next.map((ind, i) => ({ ...ind, displayOrder: i + 1 }))
    })
  }

  const moveDown = (idx: number) => {
    if (idx === indicators.length - 1) return
    setIndicators((prev) => {
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next.map((ind, i) => ({ ...ind, displayOrder: i + 1 }))
    })
  }

  const addNew = () => {
    setIndicators((prev) => [...prev, { indicatorText: '', indicatorTextEn: null, displayOrder: prev.length + 1, isActive: true }])
  }

  const remove = (idx: number) => {
    setIndicators((prev) => prev.filter((_, i) => i !== idx).map((ind, i) => ({ ...ind, displayOrder: i + 1 })))
  }

  const handleSave = async () => {
    if (indicators.some((ind) => !ind.indicatorText.trim())) return alert('빈 행동지표가 있습니다.')
    setSaving(true)
    try {
      await apiClient.put(`/api/v1/competencies/${competencyId}/indicators`, {
        indicators: indicators.map((ind, idx) => ({
          indicatorText: ind.indicatorText,
          indicatorTextEn: ind.indicatorTextEn,
          displayOrder: idx + 1,
          isActive: ind.isActive,
        })),
      })
      onSaved()
    } catch { alert('저장에 실패했습니다.') }
    finally { setSaving(false) }
  }

  return (
    <div className="rounded-xl border border-[#E8E8E8] bg-white">
      <div className="px-4 py-3 border-b border-[#E8E8E8] flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[#1A1A1A]">{competencyName} — 행동지표</h4>
        <button onClick={addNew} className="flex items-center gap-1 text-xs text-[#00C853] hover:text-[#00A844]">
          <Plus className="w-3.5 h-3.5" /> 추가
        </button>
      </div>
      <div className="divide-y divide-[#F5F5F5]">
        {indicators.length === 0 && <div className="px-4 py-4 text-xs text-[#999] text-center">행동지표가 없습니다.</div>}
        {indicators.map((ind, idx) => (
          <div key={idx} className="px-4 py-3 space-y-1.5">
            <div className="flex items-start gap-2">
              <span className="text-xs text-[#999] mt-2.5 w-4 shrink-0">{idx + 1}.</span>
              <textarea
                value={ind.indicatorText}
                onChange={(e) => update(idx, 'indicatorText', e.target.value)}
                rows={2}
                placeholder="행동지표를 입력하세요"
                className="flex-1 px-2.5 py-1.5 border border-[#D4D4D4] rounded-lg text-xs focus:ring-2 focus:ring-[#00C853]/10 resize-none"
              />
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => moveUp(idx)} className="p-1 rounded hover:bg-[#F5F5F5] disabled:opacity-30" disabled={idx === 0}>
                  <ArrowUp className="w-3 h-3 text-[#666]" />
                </button>
                <button onClick={() => moveDown(idx)} className="p-1 rounded hover:bg-[#F5F5F5] disabled:opacity-30" disabled={idx === indicators.length - 1}>
                  <ArrowDown className="w-3 h-3 text-[#666]" />
                </button>
                <button onClick={() => remove(idx)} className="p-1 rounded hover:bg-[#FEE2E2] text-[#999] hover:text-[#DC2626]">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            <input
              value={ind.indicatorTextEn ?? ''}
              onChange={(e) => update(idx, 'indicatorTextEn', e.target.value)}
              placeholder="English (optional)"
              className="w-full ml-6 px-2.5 py-1 border border-[#E8E8E8] rounded-lg text-xs text-[#666] focus:ring-1 focus:ring-[#00C853]/10"
            />
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-[#E8E8E8]">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg text-xs font-medium disabled:opacity-50">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          저장
        </button>
      </div>
    </div>
  )
}
```

---

## Task 6: CompetencyLevelEditor 컴포넌트

**Files:**
- Create: `src/app/(dashboard)/settings/competencies/CompetencyLevelEditor.tsx`

```typescript
'use client'

import { useState } from 'react'
import { Plus, Trash2, Save, Loader2 } from 'lucide-react'
import { apiClient } from '@/lib/api'

interface Level {
  id?: string; level: number; label: string; description: string | null
}

interface Props {
  competencyId: string
  competencyName: string
  initialLevels: Level[]
  onSaved: () => void
}

export default function CompetencyLevelEditor({ competencyId, competencyName, initialLevels, onSaved }: Props) {
  const [levels, setLevels] = useState<Level[]>(
    [...initialLevels].sort((a, b) => a.level - b.level)
  )
  const [saving, setSaving] = useState(false)

  const update = (idx: number, field: 'label' | 'description', value: string) => {
    setLevels((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }

  const addLevel = () => {
    const nextLevel = levels.length > 0 ? Math.max(...levels.map((l) => l.level)) + 1 : 1
    setLevels((prev) => [...prev, { level: nextLevel, label: '', description: null }])
  }

  const removeLevel = (idx: number) => {
    setLevels((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    if (levels.some((l) => !l.label.trim())) return alert('레벨 라벨을 입력하세요.')
    setSaving(true)
    try {
      await apiClient.put(`/api/v1/competencies/${competencyId}/levels`, { levels })
      onSaved()
    } catch { alert('저장에 실패했습니다.') }
    finally { setSaving(false) }
  }

  return (
    <div className="rounded-xl border border-[#E8E8E8] bg-white">
      <div className="px-4 py-3 border-b border-[#E8E8E8] flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[#1A1A1A]">{competencyName} — 숙련도 레벨</h4>
        <button onClick={addLevel} className="flex items-center gap-1 text-xs text-[#00C853] hover:text-[#00A844]">
          <Plus className="w-3.5 h-3.5" /> 레벨 추가
        </button>
      </div>
      <div className="divide-y divide-[#F5F5F5]">
        {levels.length === 0 && <div className="px-4 py-4 text-xs text-[#999] text-center">레벨이 없습니다.</div>}
        {levels.map((lvl, idx) => (
          <div key={idx} className="px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#666] w-16 shrink-0">Level {lvl.level}</span>
              <input
                value={lvl.label}
                onChange={(e) => update(idx, 'label', e.target.value)}
                placeholder="레벨 라벨 (예: 기초)"
                className="flex-1 px-2.5 py-1.5 border border-[#D4D4D4] rounded-lg text-xs focus:ring-2 focus:ring-[#00C853]/10"
              />
              <button onClick={() => removeLevel(idx)} className="p-1 rounded hover:bg-[#FEE2E2] text-[#999] hover:text-[#DC2626]">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            <textarea
              value={lvl.description ?? ''}
              onChange={(e) => update(idx, 'description', e.target.value)}
              rows={2}
              placeholder="이 레벨의 기대 행동 설명 (선택)"
              className="w-full ml-[72px] px-2.5 py-1.5 border border-[#E8E8E8] rounded-lg text-xs text-[#666] focus:ring-1 focus:ring-[#00C853]/10 resize-none"
            />
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-[#E8E8E8]">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg text-xs font-medium disabled:opacity-50">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          저장
        </button>
      </div>
    </div>
  )
}
```

---

## Task 7: Manager Eval API 업데이트 — 등급 코드 + BEI 지표 로드

**Files:**
- Modify: `src/app/api/v1/performance/evaluations/manager/route.ts`

### Step 1: 스키마 + GET에 evaluation_settings, BEI 지표 추가

`route.ts`의 `upsertSchema` 수정 (기존 `competencyScoreSchema` 아래):

```typescript
// 기존 competencyScoreSchema 대신 새 스키마 추가
const beiIndicatorScoreSchema = z.object({
  indicatorId: z.string().uuid(),
  checked: z.boolean(),                // BEI: 해당 행동 관찰 여부
})

const upsertSchema = z.object({
  cycleId: z.string().cuid(),
  employeeId: z.string(),
  goalScores: z.array(goalScoreSchema),
  // 기존 호환성 유지
  competencyScores: z.array(competencyScoreSchema).optional().default([]),
  // 새 필드
  performanceGrade: z.string().max(20).optional(),
  competencyGrade: z.string().max(20).optional(),
  beiIndicatorScores: z.array(beiIndicatorScoreSchema).optional().default([]),
  overallComment: z.string().max(3000).optional(),
  status: z.enum(['DRAFT', 'SUBMITTED']),
})
```

GET 응답에 `evaluationSettings`와 BEI 지표 추가. GET 핸들러 내 `return apiPaginated(result, ...)` 전에:

```typescript
    // evaluation_settings 로드
    const { getCompanySettings } = await import('@/lib/settings/getSettings')
    const settingsRes = await getCompanySettings('evaluationSetting', user.companyId)
    const evalSettings = settingsRes.data

    // BEI 지표 로드 (methodology = MBO_BEI 일 때만)
    let beiIndicators: { competencyId: string; competencyName: string; indicators: { id: string; indicatorText: string; displayOrder: number }[] }[] = []
    if (evalSettings?.methodology === 'MBO_BEI') {
      const coreValueComps = await prisma.competency.findMany({
        where: { category: { code: 'core_value' }, isActive: true },
        orderBy: { displayOrder: 'asc' },
        include: {
          indicators: { where: { isActive: true }, orderBy: { displayOrder: 'asc' }, select: { id: true, indicatorText: true, displayOrder: true } },
        },
      })
      beiIndicators = coreValueComps.map((c) => ({
        competencyId: c.id,
        competencyName: c.name,
        indicators: c.indicators,
      }))
    }

    return apiPaginated({ members: result, evalSettings, beiIndicators }, buildPagination(page, limit, total > 0 ? total : teamMembers.length))
```

POST 핸들러에서 `evalData` 객체에 grade 필드 추가:

```typescript
      const evalData = {
        performanceScore,
        competencyScore,
        emsBlock: emsResult.block,
        performanceDetail: goalScores as unknown as Prisma.InputJsonValue,
        competencyDetail: {
          scores: parsed.data.competencyScores,
          beiIndicators: parsed.data.beiIndicatorScores,
          gradeCode: parsed.data.competencyGrade,
        } as unknown as Prisma.InputJsonValue,
        performanceGrade: parsed.data.performanceGrade ?? null,
        competencyGrade: parsed.data.competencyGrade ?? null,
        comment: overallComment ?? null,
        status: status as EvalStatus,
        submittedAt: status === 'SUBMITTED' ? new Date() : null,
      }
```

---

## Task 8: ManagerEvalClient 업데이트 — 동적 평가 폼

**Files:**
- Modify: `src/app/(dashboard)/performance/manager-eval/ManagerEvalClient.tsx`

### Step 1: 타입 및 상태 추가

파일 상단 types 섹션에 추가:

```typescript
import type { EvaluationSettings, GradeItem } from '@/types/settings'

interface BeiIndicatorGroup {
  competencyId: string
  competencyName: string
  indicators: { id: string; indicatorText: string; displayOrder: number }[]
}

interface BeiCheck { [indicatorId: string]: boolean }
```

컴포넌트 state에 추가:

```typescript
  const [evalSettings, setEvalSettings] = useState<EvaluationSettings | null>(null)
  const [beiIndicators, setBeiIndicators] = useState<BeiIndicatorGroup[]>([])
  const [performanceGrade, setPerformanceGrade] = useState<string>('')
  const [competencyGrade, setCompetencyGrade] = useState<string>('')
  const [beiChecks, setBeiChecks] = useState<BeiCheck>({})
```

### Step 2: fetchTeam에서 settings 수신

기존 `fetchTeam`의 `setTeamMembers(res.data)` 부분을 교체:

```typescript
      // API 응답이 { members, evalSettings, beiIndicators } 형태
      const payload = res.data as unknown as {
        members: TeamMemberEval[]
        evalSettings: EvaluationSettings | null
        beiIndicators: BeiIndicatorGroup[]
      }
      setTeamMembers(Array.isArray(res.data) ? res.data : payload.members)
      if (payload.evalSettings) setEvalSettings(payload.evalSettings)
      if (payload.beiIndicators) setBeiIndicators(payload.beiIndicators)
```

> **주의**: API 응답 구조가 변경되어 `apiPaginated`의 data가 객체가 됩니다. GET 응답 구조를 확인하고 필요 시 조정.

### Step 3: 업적 등급 버튼 섹션 추가

기존 `{goals.length > 0 && (` 블록 아래, 역량 평가 섹션 앞에 업적 등급 섹션 추가:

```typescript
              {/* 업적 등급 선택 */}
              {evalSettings && evalSettings.mboGrades.length > 0 && (
                <div className="rounded-xl border border-[#E8E8E8] bg-white p-5">
                  <h3 className="text-base font-semibold text-[#1A1A1A] mb-3">업적 등급</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(evalSettings.mboGrades as GradeItem[]).map((g) => (
                      <button
                        key={g.code}
                        onClick={() => setPerformanceGrade(g.code)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                          performanceGrade === g.code
                            ? 'bg-[#00C853] text-white border-[#00C853]'
                            : 'bg-white text-[#333] border-[#D4D4D4] hover:bg-[#FAFAFA]'
                        }`}
                      >
                        {g.label} ({g.code})
                      </button>
                    ))}
                  </div>
                </div>
              )}
```

### Step 4: BEI 섹션 추가 (기존 역량 평가 섹션 교체)

기존 `{competencies.length > 0 && (` 섹션을 다음으로 교체:

```typescript
              {/* BEI 역량 평가 — methodology = MBO_BEI일 때만 */}
              {evalSettings?.methodology === 'MBO_BEI' && beiIndicators.length > 0 && (
                <div className="rounded-xl border border-[#E8E8E8] bg-white">
                  <div className="px-5 py-4 border-b border-[#E8E8E8]">
                    <h3 className="text-base font-semibold text-[#1A1A1A]">역량 평가 (BEI)</h3>
                    <p className="text-xs text-[#666] mt-0.5">관찰된 행동에 체크하고 역량 등급을 선택하세요</p>
                  </div>
                  <div className="divide-y divide-[#F5F5F5]">
                    {beiIndicators.map((group) => (
                      <div key={group.competencyId} className="px-5 py-4 space-y-3">
                        <p className="text-sm font-semibold text-[#1A1A1A]">{group.competencyName}</p>
                        <div className="space-y-2 pl-2">
                          {group.indicators.map((ind) => (
                            <label key={ind.id} className="flex items-start gap-2.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!beiChecks[ind.id]}
                                onChange={(e) => setBeiChecks((prev) => ({ ...prev, [ind.id]: e.target.checked }))}
                                className="mt-0.5 w-4 h-4 rounded border-[#D4D4D4] text-[#00C853] focus:ring-[#00C853]/10"
                              />
                              <span className="text-sm text-[#333]">{ind.indicatorText}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* 역량 등급 선택 */}
                  {(evalSettings.beiGrades as GradeItem[]).length > 0 && (
                    <div className="px-5 py-4 border-t border-[#E8E8E8]">
                      <p className="text-sm font-medium text-[#333] mb-2">역량 종합 등급</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {(evalSettings.beiGrades as GradeItem[]).map((g) => (
                          <button
                            key={g.code}
                            onClick={() => setCompetencyGrade(g.code)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                              competencyGrade === g.code
                                ? 'bg-[#4338CA] text-white border-[#4338CA]'
                                : 'bg-white text-[#333] border-[#D4D4D4] hover:bg-[#FAFAFA]'
                            }`}
                          >
                            {g.label} ({g.code})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
```

### Step 5: handleSave에 grade 필드 추가

기존 `await apiClient.post('/api/v1/performance/evaluations/manager', {` 블록에 필드 추가:

```typescript
      await apiClient.post('/api/v1/performance/evaluations/manager', {
        cycleId: selectedCycleId,
        employeeId: selectedEmployee,
        goalScores: Object.values(goalScores),
        competencyScores: [],   // 구 필드 — 빈 배열 유지
        performanceGrade,
        competencyGrade,
        beiIndicatorScores: Object.entries(beiChecks).map(([indicatorId, checked]) => ({ indicatorId, checked })),
        overallComment,
        status,
      })
```

### Step 6: tsc 확인

```bash
npx tsc --noEmit 2>&1 | grep -E "error|Error" | head -30
```

Expected: 0 errors. 에러 발생 시 타입 오류 수정.

---

## Task 9: 종합 등급 표시 (선택, overallGradeEnabled=true일 때)

**Files:**
- Modify: `src/app/(dashboard)/performance/manager-eval/ManagerEvalClient.tsx`

### Step 1: 종합 등급 자동계산 섹션 추가

BEI 섹션 아래, 종합 의견 섹션 앞에:

```typescript
              {/* 종합 등급 (overallGradeEnabled=true일 때만) */}
              {evalSettings?.overallGradeEnabled && performanceGrade && (
                <div className="rounded-xl border border-[#E8F5E9] bg-[#F0FDF4] p-4">
                  <p className="text-sm font-semibold text-[#00A844]">종합 등급 (자동 산출)</p>
                  <p className="text-xs text-[#047857] mt-1">
                    업적 {evalSettings.mboWeight}% ({performanceGrade})
                    {evalSettings.methodology === 'MBO_BEI' && competencyGrade && ` + 역량 ${evalSettings.beiWeight}% (${competencyGrade})`}
                  </p>
                  <p className="text-xs text-[#555] mt-1">최종 등급은 캘리브레이션 세션에서 확정됩니다.</p>
                </div>
              )}
```

---

## Task 10: 컨텍스트 파일 생성 및 최종 검증

**Files:**
- Create: `context/TRACK_A.md`
- Create: `context/SHARED.md` (빈 파일 — 추후 공유 인프라 기록용)

### Step 1: context/TRACK_A.md 생성

```markdown
# Track A — CTR HR Hub 구현 이력

---

## B3-1 완료 (2026-03-02)

### DB 테이블 (신규 5개)
- `competency_categories` — 카테고리 (core_value / leadership / technical)
- `competencies` — 역량 (도전/신뢰/책임/존중 + 리더십 + 직무전문)
- `competency_levels` — 역량별 숙련도 레벨 (1~5단계)
- `competency_indicators` — 행동지표 (Admin 편집 가능, 0~N개 가변)
- `competency_requirements` — 직급별 기대 레벨 (companyId NULL = 전 법인 공통)
- migrate 이름: `a_b3_competency_framework`

### PerformanceEvaluation 필드 추가
- `performance_grade String?` — MBO 등급 코드 (S/A/B/C 또는 O/E/M/S)
- `competency_grade String?` — BEI 역량 등급 코드

### 핵심 아키텍처
- BEI 평가 = `competency_categories.code = 'core_value'` 필터
- 등급 버튼은 `evaluation_settings.mboGrades` / `beiGrades`에서 동적 렌더링
- 행동지표 스냅샷: `competencyDetail` JSONB에 `{ beiIndicators: [...], gradeCode: string }` 저장
- 기존 `CompetencyLibrary` 테이블 유지 (병행 운영, InterviewEvaluation 참조)

### API
- `GET/POST /api/v1/competencies` — 역량 목록/생성
- `GET/PUT/DELETE /api/v1/competencies/[id]` — 역량 CRUD
- `GET/PUT /api/v1/competencies/[id]/indicators` — 행동지표 (bulk replace)
- `GET/PUT /api/v1/competencies/[id]/levels` — 숙련도 레벨 (bulk replace)

### 컴포넌트
- `CompetencyListClient` (`/settings/competencies`) — 3-tier 역량 라이브러리 Admin
- `IndicatorEditor` — 행동지표 추가/삭제/순서변경
- `CompetencyLevelEditor` — 숙련도 레벨 편집
- `ManagerEvalClient` — BEI 섹션 + 동적 등급 버튼 추가 (`/performance/manager-eval`)

### B 트랙 참고사항
- 이 세션 테이블은 B 트랙과 독립적 (충돌 없음)
- B4 완료 시점 기준 (B5 미시작)

### 다음 세션 주의사항 (A 트랙)
- B3-2: `DynamicEvalForm` 위에 사이드패널(목표-원온원-리뷰 연결) 추가
- B3-2: `competency_requirements`를 Talent Review 9-Block → 승계계획에서 참조
- B4: 채용 면접 질문 생성 시 `competencies` 테이블 참조 가능
- B8-3: `competency_requirements.expectedLevel`이 스킬 갭 분석 "기대 수준" — **스키마 변경 금지**
- B10-2: 배지 카테고리가 핵심가치와 연결될 수 있음

### API 구조 주의사항
- `GET /api/v1/performance/evaluations/manager` 응답:
  - `data` 필드가 `{ members, evalSettings, beiIndicators }` 객체 (배열이 아님)
  - `apiPaginated`를 이 구조로 사용 중 — 클라이언트에서 타입 조정 필요
```

### Step 2: tsc + build 최종 검증

```bash
cd /Users/sangwoo/Documents/VibeCoding/GHR/ctr-hr-hub
npx tsc --noEmit 2>&1 | tail -5
```

Expected: `Found 0 errors.`

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` or similar success output.

에러 발생 시 타입 오류 수정 후 재실행.

---

## 완료 체크리스트

- [ ] `prisma migrate dev --name a_b3_competency_framework` 성공
- [ ] `npx prisma db seed` 성공 (Competencies: 12, Indicators: 13)
- [ ] `GET /api/v1/competencies?categoryCode=core_value` → 4개 역량 반환
- [ ] `PUT /api/v1/competencies/[id]/indicators` → 행동지표 교체 동작
- [ ] `/settings/competencies` 페이지 카테고리 탭 전환 동작
- [ ] IndicatorEditor 저장 동작
- [ ] CompetencyLevelEditor 저장 동작
- [ ] `/performance/manager-eval` — CTR-KR 법인: BEI 섹션 표시, S/A/B+/B/C 등급 버튼
- [ ] `/performance/manager-eval` — CTR-US 법인: BEI 섹션 미표시 (methodology=MBO_ONLY)
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` = 성공
- [ ] `context/TRACK_A.md` 생성 완료

---

## 알려진 리스크

1. **GET 응답 구조 변경**: `apiPaginated`의 data를 객체로 래핑하면 기존 클라이언트 타입이 깨질 수 있음. 클라이언트에서 `res.data as unknown as { members, evalSettings, beiIndicators }` 캐스팅 필요.

2. **CompetencyRequirement unique constraint**: `@@unique([competencyId, jobId, jobLevelCode, companyId])`에서 `jobId` / `companyId`가 NULL인 경우 PostgreSQL에서 NULL ≠ NULL로 처리됨 → upsert의 `where` 절에서 NULL 필드 주의. seed에서는 `upsert` 대신 `findFirst + create` 패턴으로 변경 필요할 수 있음.

3. **UUID vs CUID**: 기존 모델은 `@id @default(cuid())`를 사용하지만 신규 모델은 `@id @default(uuid()) @db.Uuid`. 혼용 주의.

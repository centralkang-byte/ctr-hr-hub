# B9-2 복리후생 신청·승인 모듈 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 직원 복리후생 신청→승인→예산관리 워크플로 구축 (법인별 완전 분리)

**Architecture:** 3개 신규 Prisma 모델(BenefitPlan/Claim/Budget) + 직원용 `/my/benefits` 페이지 신규 생성 + 기존 `/benefits` 페이지를 HR 관리 뷰로 전면 교체. B6-2 통합 승인함 UI 구조를 참조해 동일한 2-패널 레이아웃으로 HR 승인 구현.

**Tech Stack:** Next.js App Router, Prisma ORM, Zod, Tailwind CSS (CLAUDE.md 디자인 토큰)

---

## 🔑 핵심 컨벤션 (반드시 준수)

- **`@db.Uuid` 사용 금지** — 기존 프로젝트 전체 컨벤션. `id String @id @default(uuid())` 형태만 사용
- **Prisma Client만** — raw SQL 금지
- **마이그레이션 접두사 `a_`** 필수
- **서버컴포넌트 → page.tsx / 클라이언트 → XxxClient.tsx** 패턴
- **`withPermission` + `perm(MODULE.BENEFITS, ACTION.xxx)`** 미들웨어 패턴
- **`apiSuccess` / `apiPaginated`** 응답 헬퍼 사용
- **`deterministicUUID(namespace, key)`** 시드 패턴

---

## Task 1: Prisma 스키마 — 3개 신규 모델 추가

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: schema.prisma 끝 부분(기존 Benefits 섹션 바로 뒤)에 3개 모델 추가**

```prisma
// ================================================================
// 13-B. Benefit Plans / Claims / Budgets (B9-2)
// ================================================================

model BenefitPlan {
  id              String   @id @default(uuid())
  companyId       String?  @map("company_id")
  company         Company? @relation(fields: [companyId], references: [id])
  code            String   @db.VarChar(30)
  name            String   @db.VarChar(100)
  nameEn          String?  @db.VarChar(100) @map("name_en")
  category        String   @db.VarChar(30)      // financial | health | lifestyle | family | education
  description     String?  @db.Text
  benefitType     String   @db.VarChar(20) @map("benefit_type")  // fixed_amount | reimbursement | subscription | one_time
  amount          Int?
  maxAmount       Int?     @map("max_amount")
  currency        String   @default("KRW") @db.VarChar(3)
  frequency       String   @default("once") @db.VarChar(20)  // once | annual | monthly | per_event
  eligibility     Json?
  requiresApproval Boolean @default(true) @map("requires_approval")
  requiresProof   Boolean  @default(false) @map("requires_proof")
  isActive        Boolean  @default(true) @map("is_active")
  displayOrder    Int      @default(0) @map("display_order")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  claims          BenefitClaim[]

  @@unique([companyId, code])
  @@map("benefit_plans")
}

model BenefitClaim {
  id             String      @id @default(uuid())
  benefitPlanId  String      @map("benefit_plan_id")
  benefitPlan    BenefitPlan @relation(fields: [benefitPlanId], references: [id])
  employeeId     String      @map("employee_id")
  claimAmount    Int         @map("claim_amount")
  approvedAmount Int?        @map("approved_amount")
  eventDate      DateTime?   @db.Date @map("event_date")
  eventDetail    String?     @db.Text @map("event_detail")
  proofPaths     String[]    @default([]) @map("proof_paths")
  status         String      @default("pending") @db.VarChar(20)  // pending | approved | rejected | paid | cancelled
  approvedBy     String?     @map("approved_by")
  approvedAt     DateTime?   @map("approved_at")
  rejectedReason String?     @db.Text @map("rejected_reason")
  paidAt         DateTime?   @map("paid_at")
  notes          String?     @db.Text
  createdAt      DateTime    @default(now()) @map("created_at")
  updatedAt      DateTime    @updatedAt @map("updated_at")

  employee       Employee    @relation(fields: [employeeId], references: [id])
  approver       Employee?   @relation("BenefitClaimApprover", fields: [approvedBy], references: [id])

  @@index([employeeId, status])
  @@map("benefit_claims")
}

model BenefitBudget {
  id          String   @id @default(uuid())
  companyId   String   @map("company_id")
  company     Company  @relation(fields: [companyId], references: [id])
  year        Int
  category    String   @db.VarChar(30)
  totalBudget Int      @map("total_budget")
  usedAmount  Int      @default(0) @map("used_amount")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@unique([companyId, year, category])
  @@map("benefit_budgets")
}
```

**Step 2: Company 모델에 relations 추가**

`prisma/schema.prisma` 에서 `Company` 모델을 찾아 아래 relations 추가:
```prisma
  benefitPlans    BenefitPlan[]
  benefitBudgets  BenefitBudget[]
```

**Step 3: Employee 모델에 relations 추가**

`prisma/schema.prisma` 에서 `Employee` 모델을 찾아 아래 추가:
```prisma
  benefitClaims         BenefitClaim[]
  approvedBenefitClaims BenefitClaim[] @relation("BenefitClaimApprover")
```

**Step 4: 마이그레이션 실행**

```bash
cd /Users/sangwoo/Documents/VibeCoding/GHR/ctr-hr-hub
npx prisma migrate dev --name a_benefit_claims
```

예상 출력: `Your database is now in sync with your schema.`

**Step 5: Prisma Client 재생성 확인**

```bash
npx prisma generate
```

---

## Task 2: Seed 데이터 — BenefitPlan + BenefitBudget

**Files:**
- Modify: `prisma/seed.ts` (기존 STEP 13 아래에 신규 STEP 추가)

**Step 1: seed.ts 상단 컨텍스트 파악**

seed.ts는 3344줄이며 `main()` 함수 내 STEP 26까지 있음. STEP 27로 추가.
`main()` 함수 닫는 `}` 직전(약 3333줄)에 아래 코드 삽입.

**Step 2: STEP 27 — BenefitPlan 시드 추가**

`main()` 끝 `}` 바로 앞에 삽입:

```typescript
  // ----------------------------------------------------------
  // STEP 27: Seed BenefitPlans (B9-2)
  // ----------------------------------------------------------
  console.log('📌 Seeding benefit plans...')

  const benefitPlansKR = [
    { code: 'KR-FAM-WED-SELF', name: '결혼축하금(본인)', nameEn: 'Wedding Gift (Self)', category: 'family', benefitType: 'fixed_amount', amount: 500000, maxAmount: 500000, frequency: 'per_event', requiresProof: true },
    { code: 'KR-FAM-WED-CHILD', name: '결혼축하금(자녀)', nameEn: 'Wedding Gift (Child)', category: 'family', benefitType: 'fixed_amount', amount: 300000, maxAmount: 300000, frequency: 'per_event', requiresProof: true },
    { code: 'KR-FAM-OBT-PARENT', name: '조의금(부모/배우자부모)', nameEn: 'Condolence (Parent)', category: 'family', benefitType: 'fixed_amount', amount: 500000, maxAmount: 500000, frequency: 'per_event', requiresProof: true },
    { code: 'KR-FAM-OBT-GRAND', name: '조의금(조부모)', nameEn: 'Condolence (Grandparent)', category: 'family', benefitType: 'fixed_amount', amount: 300000, maxAmount: 300000, frequency: 'per_event', requiresProof: true },
    { code: 'KR-FAM-BIRTH', name: '출산축하금', nameEn: 'Birth Congratulation', category: 'family', benefitType: 'fixed_amount', amount: 300000, maxAmount: 300000, frequency: 'per_event', requiresProof: true },
    { code: 'KR-EDU-TUITION', name: '대학학자금', nameEn: 'Tuition Support', category: 'education', benefitType: 'reimbursement', amount: null, maxAmount: 2000000, frequency: 'annual', requiresProof: true },
    { code: 'KR-EDU-SELF-DEV', name: '자기개발비', nameEn: 'Self Development', category: 'education', benefitType: 'reimbursement', amount: null, maxAmount: 1000000, frequency: 'annual', requiresProof: true },
    { code: 'KR-HLT-CHECKUP', name: '종합건강검진', nameEn: 'Health Checkup', category: 'health', benefitType: 'reimbursement', amount: null, maxAmount: 500000, frequency: 'annual', requiresProof: true },
    { code: 'KR-HLT-GLASSES', name: '안경/렌즈 지원', nameEn: 'Glasses/Lens Support', category: 'health', benefitType: 'reimbursement', amount: null, maxAmount: 200000, frequency: 'annual', requiresProof: true },
    { code: 'KR-LFS-CLUB', name: '사내동호회', nameEn: 'Club Activity', category: 'lifestyle', benefitType: 'subscription', amount: 50000, maxAmount: 50000, frequency: 'monthly', requiresProof: false },
  ]

  let bpCount = 0
  for (let i = 0; i < benefitPlansKR.length; i++) {
    const bp = benefitPlansKR[i]
    const id = deterministicUUID('benefit-plan', `CTR-KR:${bp.code}`)
    await prisma.benefitPlan.upsert({
      where: { id },
      update: { name: bp.name, isActive: true },
      create: {
        id,
        companyId: ctrKrId,
        code: bp.code,
        name: bp.name,
        nameEn: bp.nameEn,
        category: bp.category,
        benefitType: bp.benefitType,
        amount: bp.amount,
        maxAmount: bp.maxAmount,
        currency: 'KRW',
        frequency: bp.frequency,
        requiresApproval: true,
        requiresProof: bp.requiresProof,
        isActive: true,
        displayOrder: i,
      },
    })
    bpCount++
  }

  // CTR-US benefit plans
  const ctrUsId = companyMap['CTR-US']
  const benefitPlansUS = [
    { code: 'US-FIN-401K', name: '401k Matching', nameEn: '401k Matching', category: 'financial', benefitType: 'subscription', amount: null, maxAmount: null, frequency: 'monthly', requiresProof: false },
    { code: 'US-FIN-ESPP', name: 'Stock Purchase Plan', nameEn: 'Employee Stock Purchase Plan', category: 'financial', benefitType: 'subscription', amount: null, maxAmount: null, frequency: 'monthly', requiresProof: false },
    { code: 'US-HLT-INSURE', name: 'Health Insurance Subsidy', nameEn: 'Health Insurance Subsidy', category: 'health', benefitType: 'subscription', amount: 500, maxAmount: 500, frequency: 'monthly', requiresProof: false },
    { code: 'US-HLT-GYM', name: 'Gym Membership', nameEn: 'Gym Membership Reimbursement', category: 'health', benefitType: 'reimbursement', amount: null, maxAmount: 50, frequency: 'monthly', requiresProof: true },
    { code: 'US-LFS-EAP', name: 'Employee Assistance Program', nameEn: 'Employee Assistance Program', category: 'lifestyle', benefitType: 'subscription', amount: null, maxAmount: null, frequency: 'monthly', requiresProof: false },
  ]

  for (let i = 0; i < benefitPlansUS.length; i++) {
    const bp = benefitPlansUS[i]
    const id = deterministicUUID('benefit-plan', `CTR-US:${bp.code}`)
    await prisma.benefitPlan.upsert({
      where: { id },
      update: { name: bp.name, isActive: true },
      create: {
        id,
        companyId: ctrUsId,
        code: bp.code,
        name: bp.name,
        nameEn: bp.nameEn,
        category: bp.category,
        benefitType: bp.benefitType,
        amount: bp.amount,
        maxAmount: bp.maxAmount,
        currency: 'USD',
        frequency: bp.frequency,
        requiresApproval: true,
        requiresProof: bp.requiresProof,
        isActive: true,
        displayOrder: i,
      },
    })
    bpCount++
  }

  // 나머지 법인 (CN/RU/VN/MX) — 글로벌 기본 2개씩
  const otherCompanies = ['CTR-CN', 'CTR-RU', 'CTR-VN', 'CTR-MX']
  const globalBasePlans = [
    { code: 'GLOBAL-HLT-CHECKUP', name: '건강검진', nameEn: 'Health Checkup', category: 'health', benefitType: 'reimbursement', maxAmount: 500 },
    { code: 'GLOBAL-FAM-OBT', name: '경조금', nameEn: 'Condolence/Celebration', category: 'family', benefitType: 'fixed_amount', maxAmount: 300 },
  ]
  for (const compCode of otherCompanies) {
    const compId = companyMap[compCode]
    if (!compId) continue
    for (let i = 0; i < globalBasePlans.length; i++) {
      const bp = globalBasePlans[i]
      const id = deterministicUUID('benefit-plan', `${compCode}:${bp.code}`)
      await prisma.benefitPlan.upsert({
        where: { id },
        update: {},
        create: {
          id,
          companyId: compId,
          code: bp.code,
          name: bp.name,
          nameEn: bp.nameEn,
          category: bp.category,
          benefitType: bp.benefitType,
          maxAmount: bp.maxAmount,
          currency: 'USD',
          frequency: 'per_event',
          requiresApproval: true,
          requiresProof: false,
          isActive: true,
          displayOrder: i,
        },
      })
      bpCount++
    }
  }

  console.log(`  ✅ ${bpCount} benefit plans`)

  // ----------------------------------------------------------
  // STEP 28: Seed BenefitBudgets 2025 (B9-2)
  // ----------------------------------------------------------
  console.log('📌 Seeding benefit budgets...')

  const krBudgets = [
    { category: 'family', totalBudget: 20000000 },
    { category: 'education', totalBudget: 15000000 },
    { category: 'health', totalBudget: 10000000 },
    { category: 'lifestyle', totalBudget: 5000000 },
  ]
  const usBudgets = [
    { category: 'financial', totalBudget: 50000 },
    { category: 'health', totalBudget: 30000 },
    { category: 'lifestyle', totalBudget: 10000 },
  ]

  let budgetCount = 0
  for (const b of krBudgets) {
    const id = deterministicUUID('benefit-budget', `CTR-KR:2025:${b.category}`)
    await prisma.benefitBudget.upsert({
      where: { companyId_year_category: { companyId: ctrKrId, year: 2025, category: b.category } },
      update: { totalBudget: b.totalBudget },
      create: { id, companyId: ctrKrId, year: 2025, category: b.category, totalBudget: b.totalBudget, usedAmount: 0 },
    })
    budgetCount++
  }
  for (const b of usBudgets) {
    const id = deterministicUUID('benefit-budget', `CTR-US:2025:${b.category}`)
    await prisma.benefitBudget.upsert({
      where: { companyId_year_category: { companyId: ctrUsId, year: 2025, category: b.category } },
      update: { totalBudget: b.totalBudget },
      create: { id, companyId: ctrUsId, year: 2025, category: b.category, totalBudget: b.totalBudget, usedAmount: 0 },
    })
    budgetCount++
  }

  console.log(`  ✅ ${budgetCount} benefit budgets (2025)`)
  console.log('========================================\n')
```

**Step 3: 시드 실행**

```bash
npx prisma db seed
```

예상: `✅ XX benefit plans`, `✅ 7 benefit budgets (2025)`

---

## Task 3: API — BenefitPlan 목록 조회

**Files:**
- Create: `src/app/api/v1/benefit-plans/route.ts`

**Step 1: GET /api/v1/benefit-plans 구현**

```typescript
// src/app/api/v1/benefit-plans/route.ts
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (_req: NextRequest, _ctx, user: SessionUser) => {
    const companyId = user.companyId
    const plans = await prisma.benefitPlan.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }],
    })
    return apiSuccess(plans)
  },
  perm(MODULE.BENEFITS, ACTION.VIEW),
)
```

---

## Task 4: API — BenefitClaim CRUD (직원용)

**Files:**
- Create: `src/app/api/v1/benefit-claims/route.ts`
- Create: `src/app/api/v1/benefit-claims/[id]/route.ts`

**Step 1: GET/POST /api/v1/benefit-claims 구현**

```typescript
// src/app/api/v1/benefit-claims/route.ts
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { z } from 'zod'
import type { SessionUser } from '@/types'

const createSchema = z.object({
  benefitPlanId: z.string().uuid(),
  claimAmount: z.number().int().positive(),
  eventDate: z.string().optional(),
  eventDetail: z.string().max(500).optional(),
  proofPaths: z.array(z.string()).default([]),
  notes: z.string().max(500).optional(),
})

// GET — 목록 (직원: 본인 / HR: 법인 전체)
export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const view = searchParams.get('view') ?? 'mine'
    const status = searchParams.get('status')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)))
    const skip = (page - 1) * limit

    const isHR = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN

    let where: Record<string, unknown> = {}

    if (view === 'mine' || !isHR) {
      where.employeeId = user.employeeId
    } else if (isHR && view === 'all') {
      // HR: 법인 전체 조회
      where = {
        employee: {
          assignments: {
            some: { companyId: user.companyId, isPrimary: true, endDate: null },
          },
        },
      }
    } else if (isHR && view === 'pending') {
      where = {
        status: 'pending',
        employee: {
          assignments: {
            some: { companyId: user.companyId, isPrimary: true, endDate: null },
          },
        },
      }
    }

    if (status) where.status = status

    const [claims, total] = await Promise.all([
      prisma.benefitClaim.findMany({
        where,
        include: {
          benefitPlan: { select: { id: true, name: true, category: true, benefitType: true, currency: true } },
          employee: { select: { id: true, name: true, employeeNo: true } },
          approver: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.benefitClaim.count({ where }),
    ])

    return apiPaginated(claims, buildPagination(page, limit, total))
  },
  perm(MODULE.BENEFITS, ACTION.VIEW),
)

// POST — 신청 생성
export const POST = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)
    const { benefitPlanId, claimAmount, eventDate, eventDetail, proofPaths, notes } = parsed.data

    // 1. 플랜 존재 + 법인 검증
    const plan = await prisma.benefitPlan.findFirst({
      where: { id: benefitPlanId, companyId: user.companyId, isActive: true },
    })
    if (!plan) throw badRequest('복리후생 항목을 찾을 수 없습니다.')

    // 2. 증빙 필수 검증
    if (plan.requiresProof && proofPaths.length === 0) {
      throw badRequest('이 복리후생 항목은 증빙 서류가 필요합니다.')
    }

    // 3. 금액 검증
    if (plan.benefitType === 'fixed_amount' && plan.amount && claimAmount !== plan.amount) {
      throw badRequest(`고정금액 항목입니다. 신청금액: ${plan.amount.toLocaleString()}원`)
    }
    if (plan.maxAmount && claimAmount > plan.maxAmount) {
      throw badRequest(`최대 신청 한도(${plan.maxAmount.toLocaleString()})를 초과했습니다.`)
    }

    // 4. 연간 한도 잔여 검증 (annual 타입)
    if (plan.frequency === 'annual' && plan.maxAmount) {
      const year = new Date().getFullYear()
      const startOfYear = new Date(year, 0, 1)
      const endOfYear = new Date(year + 1, 0, 1)
      const usedThisYear = await prisma.benefitClaim.aggregate({
        where: {
          benefitPlanId,
          employeeId: user.employeeId!,
          status: { in: ['pending', 'approved', 'paid'] },
          createdAt: { gte: startOfYear, lt: endOfYear },
        },
        _sum: { claimAmount: true },
      })
      const usedAmount = usedThisYear._sum.claimAmount ?? 0
      if (usedAmount + claimAmount > plan.maxAmount) {
        throw badRequest(
          `연간 한도 초과. 잔여 한도: ${(plan.maxAmount - usedAmount).toLocaleString()}`
        )
      }
    }

    const claim = await prisma.benefitClaim.create({
      data: {
        benefitPlanId,
        employeeId: user.employeeId!,
        claimAmount,
        eventDate: eventDate ? new Date(eventDate) : null,
        eventDetail: eventDetail ?? null,
        proofPaths,
        notes: notes ?? null,
        status: 'pending',
      },
      include: {
        benefitPlan: { select: { id: true, name: true, category: true, benefitType: true, currency: true } },
      },
    })

    return apiSuccess(claim, 201)
  },
  perm(MODULE.BENEFITS, ACTION.CREATE),
)
```

**Step 2: GET/PATCH /api/v1/benefit-claims/[id] 구현**

```typescript
// src/app/api/v1/benefit-claims/[id]/route.ts
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { z } from 'zod'
import type { SessionUser } from '@/types'

// HR 승인/반려 스키마
const approveSchema = z.object({
  action: z.enum(['approve', 'reject']),
  approvedAmount: z.number().int().positive().optional(),
  rejectedReason: z.string().max(500).optional(),
})

// 직원 취소 스키마
const cancelSchema = z.object({
  action: z.literal('cancel'),
})

export const GET = withPermission(
  async (_req, context, user: SessionUser) => {
    const { id } = await context.params
    const claim = await prisma.benefitClaim.findUnique({
      where: { id },
      include: {
        benefitPlan: true,
        employee: { select: { id: true, name: true, employeeNo: true } },
        approver: { select: { id: true, name: true } },
      },
    })
    if (!claim) throw notFound('신청 내역을 찾을 수 없습니다.')
    const isHR = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN
    if (!isHR && claim.employeeId !== user.employeeId) throw forbidden()
    return apiSuccess(claim)
  },
  perm(MODULE.BENEFITS, ACTION.VIEW),
)

export const PATCH = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params
    const body = await req.json()
    const isHR = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN

    const claim = await prisma.benefitClaim.findUnique({
      where: { id },
      include: { benefitPlan: true },
    })
    if (!claim) throw notFound('신청 내역을 찾을 수 없습니다.')

    // 직원 취소
    if (body.action === 'cancel') {
      if (claim.employeeId !== user.employeeId) throw forbidden()
      if (claim.status !== 'pending') throw badRequest('대기중 상태만 취소 가능합니다.')
      const updated = await prisma.benefitClaim.update({
        where: { id },
        data: { status: 'cancelled' },
      })
      return apiSuccess(updated)
    }

    // HR 승인/반려
    if (!isHR) throw forbidden('HR 권한이 필요합니다.')
    const parsed = approveSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)
    const { action, approvedAmount, rejectedReason } = parsed.data

    if (claim.status !== 'pending') throw badRequest('이미 처리된 신청입니다.')
    if (action === 'reject' && !rejectedReason) throw badRequest('반려 사유를 입력해 주세요.')

    const now = new Date()
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.benefitClaim.update({
        where: { id },
        data: {
          status: action === 'approve' ? 'approved' : 'rejected',
          approvedBy: user.employeeId ?? null,
          approvedAt: action === 'approve' ? now : null,
          approvedAmount: action === 'approve' ? (approvedAmount ?? claim.claimAmount) : null,
          rejectedReason: action === 'reject' ? rejectedReason : null,
        },
        include: { benefitPlan: true },
      })

      // 승인 시 BenefitBudget.usedAmount 자동 증가
      if (action === 'approve') {
        const year = now.getFullYear()
        const finalAmount = approvedAmount ?? claim.claimAmount
        await tx.benefitBudget.updateMany({
          where: {
            companyId: user.companyId,
            year,
            category: claim.benefitPlan.category,
          },
          data: { usedAmount: { increment: finalAmount } },
        })
      }

      return result
    })

    return apiSuccess(updated)
  },
  perm(MODULE.BENEFITS, ACTION.UPDATE),
)
```

---

## Task 5: API — BenefitBudget 관리 (HR용)

**Files:**
- Create: `src/app/api/v1/benefit-budgets/route.ts`

**Step 1: GET/PUT /api/v1/benefit-budgets 구현**

```typescript
// src/app/api/v1/benefit-budgets/route.ts
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { z } from 'zod'
import type { SessionUser } from '@/types'

const upsertSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  category: z.string().min(1).max(30),
  totalBudget: z.number().int().nonnegative(),
})

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const year = Number(searchParams.get('year') ?? new Date().getFullYear())
    const companyId = user.companyId

    const budgets = await prisma.benefitBudget.findMany({
      where: { companyId, year },
      orderBy: { category: 'asc' },
    })
    return apiSuccess(budgets)
  },
  perm(MODULE.BENEFITS, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const isHR = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN
    if (!isHR) throw forbidden('HR 권한이 필요합니다.')

    const body = await req.json()
    const parsed = upsertSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)
    const { year, category, totalBudget } = parsed.data

    const budget = await prisma.benefitBudget.upsert({
      where: { companyId_year_category: { companyId: user.companyId, year, category } },
      update: { totalBudget },
      create: {
        companyId: user.companyId,
        year,
        category,
        totalBudget,
        usedAmount: 0,
      },
    })
    return apiSuccess(budget)
  },
  perm(MODULE.BENEFITS, ACTION.UPDATE),
)
```

---

## Task 6: API — 직원 사용 현황 요약

**Files:**
- Create: `src/app/api/v1/benefit-claims/summary/route.ts`

**Step 1: GET /api/v1/benefit-claims/summary 구현**

```typescript
// src/app/api/v1/benefit-claims/summary/route.ts
// 직원의 올해 복리후생 사용 현황 (항목별 사용금액)
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const year = Number(searchParams.get('year') ?? new Date().getFullYear())
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year + 1, 0, 1)

    // 해당 법인의 활성 플랜 목록
    const plans = await prisma.benefitPlan.findMany({
      where: { companyId: user.companyId, isActive: true, frequency: { in: ['annual', 'monthly'] } },
      orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }],
    })

    // 올해 신청 내역 집계
    const claims = await prisma.benefitClaim.findMany({
      where: {
        employeeId: user.employeeId!,
        createdAt: { gte: startOfYear, lt: endOfYear },
        status: { in: ['pending', 'approved', 'paid'] },
      },
      select: { benefitPlanId: true, claimAmount: true, status: true },
    })

    const usageByPlan: Record<string, { used: number; pending: number }> = {}
    for (const c of claims) {
      if (!usageByPlan[c.benefitPlanId]) usageByPlan[c.benefitPlanId] = { used: 0, pending: 0 }
      if (c.status === 'pending') usageByPlan[c.benefitPlanId].pending += c.claimAmount
      else usageByPlan[c.benefitPlanId].used += c.claimAmount
    }

    const summary = plans.map((p) => ({
      planId: p.id,
      planName: p.name,
      category: p.category,
      maxAmount: p.maxAmount,
      currency: p.currency,
      used: usageByPlan[p.id]?.used ?? 0,
      pending: usageByPlan[p.id]?.pending ?? 0,
    }))

    return apiSuccess({ year, summary })
  },
  perm(MODULE.BENEFITS, ACTION.VIEW),
)
```

---

## Task 7: 직원용 UI — /my/benefits

**Files:**
- Create: `src/app/(dashboard)/my/benefits/page.tsx`
- Create: `src/app/(dashboard)/my/benefits/MyBenefitsClient.tsx`

**Step 1: page.tsx (서버 컴포넌트)**

```typescript
// src/app/(dashboard)/my/benefits/page.tsx
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { MyBenefitsClient } from './MyBenefitsClient'

export default async function MyBenefitsPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')
  return <MyBenefitsClient user={session.user} />
}
```

**Step 2: MyBenefitsClient.tsx 구현**

전체 파일 (~400줄):

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api'
import {
  Gift, Plus, Loader2, AlertTriangle, CheckCircle2, XCircle, Clock,
  ChevronRight, Upload, FileText,
} from 'lucide-react'
import type { SessionUser } from '@/types'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

// ─── 타입 ─────────────────────────────────────────────────

interface BenefitPlan {
  id: string
  code: string
  name: string
  category: string
  benefitType: string
  amount: number | null
  maxAmount: number | null
  currency: string
  frequency: string
  requiresApproval: boolean
  requiresProof: boolean
}

interface UsageSummaryItem {
  planId: string
  planName: string
  category: string
  maxAmount: number | null
  currency: string
  used: number
  pending: number
}

interface BenefitClaim {
  id: string
  benefitPlanId: string
  claimAmount: number
  approvedAmount: number | null
  eventDate: string | null
  eventDetail: string | null
  status: string
  createdAt: string
  benefitPlan: { id: string; name: string; category: string; benefitType: string; currency: string }
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: '승인대기', color: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]', icon: <Clock className="w-3 h-3" /> },
  approved: { label: '승인', color: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]', icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected: { label: '반려', color: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]', icon: <XCircle className="w-3 h-3" /> },
  paid: { label: '지급완료', color: 'bg-[#E8F5E9] text-[#00A844] border-[#E8F5E9]', icon: <CheckCircle2 className="w-3 h-3" /> },
  cancelled: { label: '취소', color: 'bg-[#FAFAFA] text-[#555] border-[#E8E8E8]', icon: null },
}

const CATEGORY_LABELS: Record<string, string> = {
  family: '경조금', health: '건강', education: '교육', lifestyle: '생활', financial: '금융',
}

const formatCurrency = (amount: number, currency: string) =>
  currency === 'KRW' ? `₩${amount.toLocaleString()}` : `$${amount.toLocaleString()}`

// ─── 신청 모달 ─────────────────────────────────────────────

function ClaimModal({ plans, onClose, onSubmit }: {
  plans: BenefitPlan[]
  onClose: () => void
  onSubmit: () => void
}) {
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [claimAmount, setClaimAmount] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventDetail, setEventDetail] = useState('')
  const [proofFiles, setProofFiles] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedPlan = plans.find((p) => p.id === selectedPlanId)

  // 플랜 선택 시 고정금액 자동 입력
  useEffect(() => {
    if (selectedPlan?.benefitType === 'fixed_amount' && selectedPlan.amount) {
      setClaimAmount(String(selectedPlan.amount))
    } else {
      setClaimAmount('')
    }
  }, [selectedPlan])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    // 파일 경로만 저장 (실제 업로드는 추후 S3 연동)
    const paths = files.map((f) => `benefit-claims/${Date.now()}-${f.name}`)
    setProofFiles((prev) => [...prev, ...paths])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPlanId) { setError('복리후생 항목을 선택해 주세요.'); return }
    if (!claimAmount || Number(claimAmount) <= 0) { setError('신청 금액을 입력해 주세요.'); return }
    if (selectedPlan?.requiresProof && proofFiles.length === 0) {
      setError('증빙 서류를 첨부해 주세요.'); return
    }

    setSubmitting(true)
    setError(null)
    try {
      await apiClient.post('/api/v1/benefit-claims', {
        benefitPlanId: selectedPlanId,
        claimAmount: Number(claimAmount),
        eventDate: eventDate || undefined,
        eventDetail: eventDetail || undefined,
        proofPaths: proofFiles,
        notes: notes || undefined,
      })
      onSubmit()
      onClose()
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? '신청 중 오류가 발생했습니다.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-5 border-b border-[#E8E8E8]">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">복리후생 신청</h2>
          <button onClick={onClose} className="text-[#999] hover:text-[#555]">✕</button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-[#FEE2E2] rounded-lg text-sm text-[#B91C1C]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* 항목 선택 */}
          <div>
            <label className="text-sm font-medium text-[#333] mb-1 block">복리후생 항목 *</label>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
            >
              <option value="">항목을 선택하세요</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  [{CATEGORY_LABELS[p.category] ?? p.category}] {p.name}
                  {p.maxAmount ? ` (최대 ${formatCurrency(p.maxAmount, p.currency)})` : ''}
                </option>
              ))}
            </select>
            {selectedPlan && (
              <p className="text-xs text-[#666] mt-1">
                {selectedPlan.benefitType === 'fixed_amount' ? '고정금액' : '실비 상환'}
                {selectedPlan.requiresProof && ' · 증빙 필수'}
              </p>
            )}
          </div>

          {/* 금액 */}
          <div>
            <label className="text-sm font-medium text-[#333] mb-1 block">신청 금액 *</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#666]">{selectedPlan?.currency === 'USD' ? '$' : '₩'}</span>
              <input
                type="number"
                value={claimAmount}
                onChange={(e) => setClaimAmount(e.target.value)}
                readOnly={selectedPlan?.benefitType === 'fixed_amount'}
                placeholder="0"
                className="flex-1 px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 disabled:bg-[#FAFAFA]"
              />
            </div>
            {selectedPlan?.maxAmount && (
              <p className="text-xs text-[#666] mt-1">
                한도: {formatCurrency(selectedPlan.maxAmount, selectedPlan.currency)}
              </p>
            )}
          </div>

          {/* 이벤트 날짜 */}
          <div>
            <label className="text-sm font-medium text-[#333] mb-1 block">이벤트 날짜</label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
            />
          </div>

          {/* 상세 */}
          <div>
            <label className="text-sm font-medium text-[#333] mb-1 block">상세 내용</label>
            <input
              type="text"
              value={eventDetail}
              onChange={(e) => setEventDetail(e.target.value)}
              placeholder="예: 본인 결혼"
              className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
            />
          </div>

          {/* 증빙 파일 */}
          <div>
            <label className="text-sm font-medium text-[#333] mb-1 block">
              증빙 서류 {selectedPlan?.requiresProof && <span className="text-[#EF4444]">*</span>}
            </label>
            <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-[#D4D4D4] rounded-lg cursor-pointer hover:bg-[#FAFAFA] text-sm text-[#666]">
              <Upload className="w-4 h-4" />
              파일 첨부
              <input type="file" multiple onChange={handleFileChange} className="hidden" />
            </label>
            {proofFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {proofFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-[#555]">
                    <FileText className="w-3 h-3" />
                    {f.split('/').pop()}
                    <button
                      type="button"
                      onClick={() => setProofFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="text-[#EF4444] hover:underline ml-auto"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* 푸터 */}
        <div className="flex justify-end gap-3 p-5 border-t border-[#E8E8E8]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-[#D4D4D4] hover:bg-[#FAFAFA] text-[#333] rounded-lg text-sm font-medium"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            신청
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────

export function MyBenefitsClient({ user }: { user: SessionUser }) {
  const [plans, setPlans] = useState<BenefitPlan[]>([])
  const [summary, setSummary] = useState<UsageSummaryItem[]>([])
  const [claims, setClaims] = useState<BenefitClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const year = new Date().getFullYear()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [plansRes, summaryRes, claimsRes] = await Promise.all([
        apiClient.get<BenefitPlan[]>('/api/v1/benefit-plans'),
        apiClient.get<{ year: number; summary: UsageSummaryItem[] }>('/api/v1/benefit-claims/summary', { year: String(year) }),
        apiClient.get<{ data: BenefitClaim[]; pagination: unknown }>('/api/v1/benefit-claims', { view: 'mine', limit: '20' }),
      ])
      setPlans(plansRes.data ?? [])
      setSummary(summaryRes.data.summary ?? [])
      const raw = claimsRes as unknown as { data: BenefitClaim[]; pagination: unknown }
      setClaims(raw.data ?? [])
    } catch {
      setError('복리후생 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[#00C853]" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-xs text-[#999] mb-1">나의 공간</nav>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">나의 복리후생</h1>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          복리후생 신청
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-[#FEE2E2] rounded-xl text-sm text-[#B91C1C]">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* 올해 사용 현황 */}
      {summary.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E8E8E8] p-5">
          <h2 className="text-base font-semibold text-[#1A1A1A] mb-4">
            📊 {year}년 사용 현황
          </h2>
          <div className="space-y-4">
            {summary.map((item) => {
              const total = item.maxAmount ?? 0
              const usedPct = total > 0 ? Math.min(100, Math.round((item.used / total) * 100)) : 0
              const pendingPct = total > 0 ? Math.min(100 - usedPct, Math.round((item.pending / total) * 100)) : 0
              return (
                <div key={item.planId}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-[#333]">{item.planName}</span>
                    <span className="text-xs text-[#666]">
                      {formatCurrency(item.used, item.currency)}
                      {item.maxAmount ? ` / ${formatCurrency(item.maxAmount, item.currency)}` : ''}
                    </span>
                  </div>
                  {total > 0 && (
                    <div className="w-full bg-[#F5F5F5] rounded-full h-2 overflow-hidden">
                      <div className="h-full flex">
                        <div
                          className="bg-[#00C853] transition-all"
                          style={{ width: `${usedPct}%` }}
                        />
                        <div
                          className="bg-[#FCD34D] transition-all"
                          style={{ width: `${pendingPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {item.pending > 0 && (
                    <p className="text-xs text-[#B45309] mt-1">
                      대기중: {formatCurrency(item.pending, item.currency)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 최근 신청 내역 */}
      <div className="bg-white rounded-xl border border-[#E8E8E8]">
        <div className="p-5 border-b border-[#E8E8E8]">
          <h2 className="text-base font-semibold text-[#1A1A1A]">신청 내역</h2>
        </div>
        {claims.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[#999]">
            <Gift className="w-10 h-10 mb-3" />
            <p className="text-sm">신청 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F5F5F5]">
            {claims.map((claim) => {
              const s = STATUS_LABELS[claim.status] ?? { label: claim.status, color: '', icon: null }
              return (
                <div key={claim.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[#FAFAFA]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1A1A]">{claim.benefitPlan.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-[#666]">
                        {format(new Date(claim.createdAt), 'MM/dd', { locale: ko })}
                      </p>
                      {claim.eventDetail && (
                        <span className="text-xs text-[#999]">· {claim.eventDetail}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#1A1A1A]">
                      {formatCurrency(claim.claimAmount, claim.benefitPlan.currency)}
                    </p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border mt-1 ${s.color}`}>
                      {s.icon}
                      {s.label}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#CCC]" />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 신청 모달 */}
      {showModal && (
        <ClaimModal
          plans={plans}
          onClose={() => setShowModal(false)}
          onSubmit={() => { load() }}
        />
      )}
    </div>
  )
}
```

---

## Task 8: HR 관리 UI — /benefits 교체

**Files:**
- Modify: `src/app/(dashboard)/benefits/page.tsx`
- Overwrite: `src/app/(dashboard)/benefits/BenefitsClient.tsx`
- Create: `src/app/(dashboard)/benefits/BenefitApprovalTab.tsx`
- Create: `src/app/(dashboard)/benefits/BenefitBudgetTab.tsx`

**Step 1: page.tsx 업데이트**

```typescript
// src/app/(dashboard)/benefits/page.tsx
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { BenefitsClient } from './BenefitsClient'

export default async function BenefitsPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')
  return <BenefitsClient user={session.user} />
}
```

**Step 2: BenefitsClient.tsx 전면 교체 (HR 관리 뷰)**

```typescript
'use client'

import { useState } from 'react'
import {
  Inbox, List, Settings, PieChart,
} from 'lucide-react'
import type { SessionUser } from '@/types'
import { BenefitApprovalTab } from './BenefitApprovalTab'
import { BenefitBudgetTab } from './BenefitBudgetTab'

type Tab = 'pending' | 'all' | 'budget'

export function BenefitsClient({ user }: { user: SessionUser }) {
  const [activeTab, setActiveTab] = useState<Tab>('pending')

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'pending', label: '승인 대기', icon: <Inbox className="w-4 h-4" /> },
    { key: 'all', label: '전체 내역', icon: <List className="w-4 h-4" /> },
    { key: 'budget', label: '예산 관리', icon: <PieChart className="w-4 h-4" /> },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <nav className="text-xs text-[#999] mb-1">인재 관리</nav>
        <h1 className="text-2xl font-bold text-[#1A1A1A]">복리후생 관리</h1>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-[#E8E8E8]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[#00C853] text-[#00C853]'
                : 'border-transparent text-[#666] hover:text-[#333]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'pending' && <BenefitApprovalTab user={user} view="pending" />}
      {activeTab === 'all' && <BenefitApprovalTab user={user} view="all" />}
      {activeTab === 'budget' && <BenefitBudgetTab user={user} />}
    </div>
  )
}
```

**Step 3: BenefitApprovalTab.tsx 구현**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api'
import {
  CheckCircle2, XCircle, Loader2, AlertTriangle, Clock,
  FileText, ChevronRight, Search,
} from 'lucide-react'
import type { SessionUser } from '@/types'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface BenefitClaim {
  id: string
  claimAmount: number
  approvedAmount: number | null
  eventDate: string | null
  eventDetail: string | null
  proofPaths: string[]
  status: string
  createdAt: string
  rejectedReason: string | null
  benefitPlan: { id: string; name: string; category: string; benefitType: string; currency: string }
  employee: { id: string; name: string; employeeNo: string | null }
  approver: { id: string; name: string } | null
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '승인대기', color: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]' },
  approved: { label: '승인', color: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]' },
  rejected: { label: '반려', color: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]' },
  paid: { label: '지급완료', color: 'bg-[#E8F5E9] text-[#00A844] border-[#E8F5E9]' },
  cancelled: { label: '취소', color: 'bg-[#FAFAFA] text-[#555] border-[#E8E8E8]' },
}

const CATEGORY_LABELS: Record<string, string> = {
  family: '경조금', health: '건강', education: '교육', lifestyle: '생활', financial: '금융',
}

const formatCurrency = (amount: number, currency: string) =>
  currency === 'KRW' ? `₩${amount.toLocaleString()}` : `$${amount.toLocaleString()}`

export function BenefitApprovalTab({ user, view }: { user: SessionUser; view: 'pending' | 'all' }) {
  const [claims, setClaims] = useState<BenefitClaim[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<BenefitClaim | null>(null)
  const [processing, setProcessing] = useState(false)
  const [rejectedReason, setRejectedReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<unknown>('/api/v1/benefit-claims', {
        view,
        limit: '50',
      })
      const raw = res as unknown as { data: BenefitClaim[]; pagination: { total: number } }
      setClaims(raw.data ?? [])
      setTotal(raw.pagination?.total ?? 0)
    } catch {
      setError('목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [view])

  useEffect(() => { load() }, [load])

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!selected) return
    if (action === 'reject' && !rejectedReason.trim()) {
      setShowRejectForm(true)
      return
    }
    setProcessing(true)
    try {
      await apiClient.patch(`/api/v1/benefit-claims/${selected.id}`, {
        action,
        rejectedReason: action === 'reject' ? rejectedReason : undefined,
      })
      setSelected(null)
      setRejectedReason('')
      setShowRejectForm(false)
      await load()
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? '처리 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-280px)]">
      {/* 좌측 목록 */}
      <div className="w-80 shrink-0 bg-white rounded-xl border border-[#E8E8E8] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-[#E8E8E8] flex items-center justify-between">
          <span className="text-sm font-medium text-[#333]">
            {view === 'pending' ? '승인 대기' : '전체 내역'} ({total})
          </span>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-[#00C853]" />}
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-[#F5F5F5]">
          {error && (
            <div className="p-4 text-sm text-[#B91C1C] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}
          {!loading && claims.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-[#999] text-sm">
              <CheckCircle2 className="w-8 h-8 mb-2" />
              {view === 'pending' ? '대기중인 신청이 없습니다.' : '내역이 없습니다.'}
            </div>
          )}
          {claims.map((claim) => {
            const s = STATUS_LABELS[claim.status] ?? { label: claim.status, color: '' }
            const isSelected = selected?.id === claim.id
            return (
              <button
                key={claim.id}
                onClick={() => { setSelected(claim); setShowRejectForm(false); setRejectedReason('') }}
                className={`w-full text-left px-4 py-3 hover:bg-[#FAFAFA] transition-colors ${isSelected ? 'bg-[#E8F5E9]' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-[#1A1A1A] truncate">
                    {claim.employee.name}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${s.color}`}>
                    {s.label}
                  </span>
                </div>
                <p className="text-xs text-[#666] truncate">{claim.benefitPlan.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-[#999]">
                    {format(new Date(claim.createdAt), 'MM/dd', { locale: ko })}
                  </span>
                  <span className="text-xs font-semibold text-[#1A1A1A]">
                    {formatCurrency(claim.claimAmount, claim.benefitPlan.currency)}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 우측 상세 */}
      <div className="flex-1 bg-white rounded-xl border border-[#E8E8E8] overflow-hidden flex flex-col">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[#999]">
            <ChevronRight className="w-10 h-10 mb-3" />
            <p className="text-sm">신청 항목을 선택하세요</p>
          </div>
        ) : (
          <>
            {/* 상세 헤더 */}
            <div className="p-5 border-b border-[#E8E8E8]">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[#1A1A1A]">
                    {selected.employee.name} · {selected.benefitPlan.name}
                  </h3>
                  <p className="text-xs text-[#999] mt-0.5">
                    신청일: {format(new Date(selected.createdAt), 'yyyy.MM.dd', { locale: ko })}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_LABELS[selected.status]?.color ?? ''}`}>
                  {STATUS_LABELS[selected.status]?.label ?? selected.status}
                </span>
              </div>
            </div>

            {/* 상세 내용 */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[#999] mb-1">카테고리</p>
                  <p className="text-sm font-medium">{CATEGORY_LABELS[selected.benefitPlan.category] ?? selected.benefitPlan.category}</p>
                </div>
                <div>
                  <p className="text-xs text-[#999] mb-1">신청 금액</p>
                  <p className="text-sm font-medium">{formatCurrency(selected.claimAmount, selected.benefitPlan.currency)}</p>
                </div>
                {selected.eventDate && (
                  <div>
                    <p className="text-xs text-[#999] mb-1">이벤트 날짜</p>
                    <p className="text-sm">{format(new Date(selected.eventDate), 'yyyy.MM.dd', { locale: ko })}</p>
                  </div>
                )}
                {selected.eventDetail && (
                  <div>
                    <p className="text-xs text-[#999] mb-1">상세</p>
                    <p className="text-sm">{selected.eventDetail}</p>
                  </div>
                )}
              </div>

              {selected.proofPaths.length > 0 && (
                <div>
                  <p className="text-xs text-[#999] mb-2">증빙 서류</p>
                  <div className="space-y-1">
                    {selected.proofPaths.map((path, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-[#555]">
                        <FileText className="w-4 h-4 text-[#00C853]" />
                        {path.split('/').pop()}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.rejectedReason && (
                <div className="p-3 bg-[#FEE2E2] rounded-lg">
                  <p className="text-xs text-[#999] mb-1">반려 사유</p>
                  <p className="text-sm text-[#B91C1C]">{selected.rejectedReason}</p>
                </div>
              )}
            </div>

            {/* 승인/반려 액션 (pending 상태만) */}
            {selected.status === 'pending' && (
              <div className="p-5 border-t border-[#E8E8E8] space-y-3">
                {showRejectForm && (
                  <div>
                    <label className="text-xs text-[#333] font-medium mb-1 block">반려 사유 *</label>
                    <textarea
                      value={rejectedReason}
                      onChange={(e) => setRejectedReason(e.target.value)}
                      placeholder="반려 사유를 입력해 주세요."
                      rows={2}
                      className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 resize-none"
                    />
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      if (!showRejectForm) { setShowRejectForm(true); return }
                      handleAction('reject')
                    }}
                    disabled={processing}
                    className="flex-1 py-2 border border-[#FCA5A5] text-[#DC2626] hover:bg-[#FEE2E2] rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {showRejectForm ? '반려 확인' : '반려'}
                  </button>
                  <button
                    onClick={() => handleAction('approve')}
                    disabled={processing}
                    className="flex-1 py-2 bg-[#059669] hover:bg-[#047857] text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {processing && <Loader2 className="w-4 h-4 animate-spin" />}
                    승인
                  </button>
                </div>
                {showRejectForm && (
                  <button
                    onClick={() => { setShowRejectForm(false); setRejectedReason('') }}
                    className="w-full text-xs text-[#999] hover:text-[#555]"
                  >
                    취소
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

**Step 4: BenefitBudgetTab.tsx 구현**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api'
import { Loader2, AlertTriangle, PieChart, Pencil, Check } from 'lucide-react'
import type { SessionUser } from '@/types'

interface BenefitBudget {
  id: string
  companyId: string
  year: number
  category: string
  totalBudget: number
  usedAmount: number
}

const CATEGORY_LABELS: Record<string, string> = {
  family: '경조금', health: '건강', education: '교육', lifestyle: '생활', financial: '금융',
}

const CATEGORY_COLORS: Record<string, string> = {
  family: '#00C853',
  health: '#059669',
  education: '#4338CA',
  lifestyle: '#F59E0B',
  financial: '#EC4899',
}

export function BenefitBudgetTab({ user }: { user: SessionUser }) {
  const [budgets, setBudgets] = useState<BenefitBudget[]>([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<BenefitBudget[]>('/api/v1/benefit-budgets', { year: String(year) })
      setBudgets(res.data ?? [])
    } catch {
      setError('예산 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { load() }, [load])

  const handleSave = async (budget: BenefitBudget) => {
    if (!editValue || isNaN(Number(editValue))) return
    setSaving(true)
    try {
      await apiClient.put('/api/v1/benefit-budgets', {
        year: budget.year,
        category: budget.category,
        totalBudget: Number(editValue),
      })
      setEditingId(null)
      await load()
    } catch {
      setError('예산 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const formatKRW = (amount: number) => `₩${(amount / 10000).toFixed(0)}만`

  return (
    <div className="space-y-6">
      {/* 연도 선택 */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-[#333]">기준 연도</label>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-1.5 border border-[#D4D4D4] rounded-lg text-sm"
        >
          {[2024, 2025, 2026].map((y) => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-[#FEE2E2] rounded-lg text-sm text-[#B91C1C]">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-[#00C853]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {budgets.length === 0 && (
            <div className="bg-white rounded-xl border border-[#E8E8E8] p-8 text-center text-[#999] text-sm">
              예산 데이터가 없습니다.
            </div>
          )}
          {budgets.map((budget) => {
            const pct = budget.totalBudget > 0
              ? Math.min(100, Math.round((budget.usedAmount / budget.totalBudget) * 100))
              : 0
            const isWarning = pct >= 80
            const color = CATEGORY_COLORS[budget.category] ?? '#00C853'

            return (
              <div key={budget.id} className="bg-white rounded-xl border border-[#E8E8E8] p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <h3 className="text-base font-semibold text-[#1A1A1A]">
                      {CATEGORY_LABELS[budget.category] ?? budget.category}
                    </h3>
                    {isWarning && (
                      <span className="text-xs px-2 py-0.5 bg-[#FEF3C7] text-[#B45309] border border-[#FCD34D] rounded-full">
                        80% 초과 ⚠️
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {editingId === budget.id ? (
                      <>
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-32 px-2 py-1 border border-[#D4D4D4] rounded text-sm"
                        />
                        <button
                          onClick={() => handleSave(budget)}
                          disabled={saving}
                          className="p-1.5 bg-[#00C853] text-white rounded hover:bg-[#00A844]"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => { setEditingId(budget.id); setEditValue(String(budget.totalBudget)) }}
                        className="p-1.5 hover:bg-[#F5F5F5] rounded text-[#999]"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 프로그레스 바 */}
                <div className="w-full bg-[#F5F5F5] rounded-full h-3 mb-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: isWarning ? '#F59E0B' : color,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-[#666]">
                  <span>사용: {formatKRW(budget.usedAmount)}</span>
                  <span className="font-medium">{pct}%</span>
                  <span>총: {formatKRW(budget.totalBudget)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

---

## Task 9: 네비게이션 업데이트

**Files:**
- Modify: `src/config/navigation.ts`

**Step 1: "나의 공간 > 복리후생" href 변경**

`navigation.ts`에서 `key: 'my-benefits'` 항목의 `href: '/benefits'`를 `href: '/my/benefits'`로 변경.

변경 전:
```typescript
{
  key: 'my-benefits',
  labelKey: 'nav.mySpace.benefits',
  label: '복리후생',
  href: '/benefits',
  icon: Gift,
  module: MODULE.BENEFITS,
},
```

변경 후:
```typescript
{
  key: 'my-benefits',
  labelKey: 'nav.mySpace.benefits',
  label: '복리후생',
  href: '/my/benefits',
  icon: Gift,
  module: MODULE.BENEFITS,
},
```

---

## Task 10: TypeScript 검증 + 빌드

**Step 1: TypeScript 검증**

```bash
cd /Users/sangwoo/Documents/VibeCoding/GHR/ctr-hr-hub
npx tsc --noEmit
```

예상: 0 errors. 오류가 있으면 수정.

**Step 2: Next.js 빌드**

```bash
npm run build
```

예상: 성공 (`✓ Compiled successfully`)

**Step 3: context/TRACK_A.md 업데이트**

`context/TRACK_A.md` 끝에 아래 내용 추가:

```markdown
---

# Track A — B9-2: 복리후생 신청·승인 완료 보고

> 완료일: 2026-03-03
> 검증: `tsc --noEmit` ✅ 0 errors | `npm run build` ✅ 성공

## B9-2 구현 완료 항목

### Task 1: DB Migration
- `BenefitPlan` (benefit_plans) — 법인별 복리후생 항목
- `BenefitClaim` (benefit_claims) — 직원 신청 + 승인 워크플로
- `BenefitBudget` (benefit_budgets) — 법인/카테고리별 연간 예산
- 마이그레이션: `a_benefit_claims`

### Task 2: 시드 데이터
- CTR-KR: 10개 (family 5, education 2, health 2, lifestyle 1)
- CTR-US: 5개 (financial 2, health 2, lifestyle 1)
- 나머지 법인(CN/RU/VN/MX): 기본 2개씩 (health + family)
- 예산 2025: KR 4카테고리(₩50M), US 3카테고리($90K)

### 직원용 UI
- `/my/benefits` — 사용현황 프로그레스 + 신청 모달 + 이력 리스트

### HR 관리 UI
- `/benefits` (기존 교체) — 승인대기/전체내역/예산관리 3탭 HR 뷰

### API Routes (신규)
- `GET /api/v1/benefit-plans` — 법인별 활성 플랜 목록
- `GET/POST /api/v1/benefit-claims` — 직원 신청 + HR 목록
- `GET/PATCH /api/v1/benefit-claims/[id]` — 상세 + 승인/반려/취소
- `GET /api/v1/benefit-claims/summary` — 직원 연간 사용 현황 집계
- `GET/PUT /api/v1/benefit-budgets` — 예산 조회/수정

### 핵심 비즈니스 로직
- 승인 시 `BenefitBudget.usedAmount` 자동 증가 (트랜잭션)
- 연간 한도 초과 신청 차단 (annual frequency 항목)
- 증빙 필수 항목 검증 (서버사이드)
- 예산 80% 초과 시 경고 배지 표시

## 다음 세션 연동 포인트
- B10-1 애널리틱스: 복리후생 활용률(`BenefitClaim` 집계) 데이터 참조
- B10-2 HR KPI: 복리후생 활용률 위젯
- B11 알림: 승인/반려 알림, 예산 80% 소진 알림, 연간 미사용 안내
- B7-1b 연말정산: 과세 대상 복리후생(학자금 등) 참고 데이터 — 직접 포함 X

## 주요 설계 결정
- 복리후생 지급은 급여와 완전 분리 (별도 지급)
- 파일 업로드: 경로 메타데이터만 저장 (S3 실제 업로드는 추후 연동)
- 승인 플로우: 단순 1-step HR 직접 승인 (AttendanceApprovalRequest 패턴 미사용)
- BudgetBudget.usedAmount: 승인 트랜잭션에서 자동 증가
```

---

## 완료 체크리스트

- [ ] DB: `BenefitPlan`, `BenefitClaim`, `BenefitBudget` 3개 모델 (no `@db.Uuid`)
- [ ] 마이그레이션명 `a_benefit_claims` 완료
- [ ] 시드: KR 10개 + US 5개 + CN/RU/VN/MX 각 2개
- [ ] 시드: 2025년 예산 KR 4카테고리 + US 3카테고리
- [ ] `/my/benefits` — 사용현황 + 신청 모달 + 이력
- [ ] `/benefits` — HR 승인/예산 3탭 뷰
- [ ] 승인 시 BenefitBudget.usedAmount 자동 증가
- [ ] 예산 80% 경고 배지
- [ ] 연간 한도 초과 차단
- [ ] 증빙 필수 검증
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run build` 성공
- [ ] `context/TRACK_A.md` 업데이트 완료

// ================================================================
// CTR HR Hub — Seed Data: Session A — Benefits
// prisma/seeds/12-benefits.ts
//
// Creates:
//   STEP A: 8 BenefitPlans (KR 5, CN 3)
//   STEP B: ~30 BenefitClaims across employees (mixed statuses)
//   STEP C: BenefitBudget per category per company (2026 fiscal year)
//
// NOTE: seed.ts already seeds BenefitPolicy (different model - legacy).
//       This file seeds BenefitPlan (new model used by /benefits page).
// ================================================================

import { PrismaClient } from '../../src/generated/prisma/client'

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

function sr(seed: number): number {
    const x = Math.sin(seed * 9301 + 49297) * 233280
    return x - Math.floor(x)
}

function daysAgo(n: number): Date {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return d
}

// ── BenefitPlan definitions ──────────────────────────────────
// TODO: Move to Settings (Benefits > Plan Catalog) — benefit plan configuration
interface PlanDef {
    code: string
    name: string
    nameEn: string
    category: string       // matches BenefitCategory enum values
    description: string
    benefitType: string    // 'reimbursement' | 'allowance' | 'insurance'
    amount: number | null  // fixed amount
    maxAmount: number      // max claimable
    currency: string
    frequency: string      // 'monthly' | 'quarterly' | 'annual' | 'once'
    requiresApproval: boolean
    requiresProof: boolean
    companyCode: string
    displayOrder: number
    eligibility: object
}

const BENEFIT_PLANS: PlanDef[] = [
    // KR Plans
    {
        code: 'KR-HEALTH-CHECK',
        name: '건강검진 지원',
        nameEn: 'Health Checkup Support',
        category: 'HEALTH',
        description: '전 직원 대상 연간 건강검진 비용을 지원합니다. 협약 병원 이용 시 추가 혜택 제공.',
        benefitType: 'reimbursement',
        amount: null,
        maxAmount: 300_000,
        currency: 'KRW',
        frequency: 'annual',
        requiresApproval: true,
        requiresProof: true,
        companyCode: 'CTR-KR',
        displayOrder: 1,
        // TODO: Move to Settings (Benefits > Eligibility Rules) — eligibility criteria per plan
        eligibility: { minTenureMonths: 0, employmentTypes: ['FULL_TIME', 'CONTRACT'] },
    },
    {
        code: 'KR-EDU-CHILD',
        name: '자녀 학자금 지원',
        nameEn: 'Child Education Support',
        category: 'EDUCATION',
        description: '자녀가 있는 직원을 대상으로 분기별 자녀 학자금을 지원합니다.',
        benefitType: 'reimbursement',
        amount: null,
        maxAmount: 2_000_000,
        currency: 'KRW',
        frequency: 'quarterly',
        requiresApproval: true,
        requiresProof: true,
        companyCode: 'CTR-KR',
        displayOrder: 2,
        eligibility: { minTenureMonths: 12, hasChildren: true, employmentTypes: ['FULL_TIME'] },
    },
    {
        code: 'KR-LIFE-EVENT',
        name: '경조사비 지원',
        nameEn: 'Life Event Support',
        category: 'OTHER',
        description: '결혼, 출산, 부모 회갑, 조사 등 경조사 발생 시 지원합니다.',
        benefitType: 'allowance',
        amount: null,
        maxAmount: 500_000,
        currency: 'KRW',
        frequency: 'once',
        requiresApproval: false,
        requiresProof: true,
        companyCode: 'CTR-KR',
        displayOrder: 3,
        eligibility: { employmentTypes: ['FULL_TIME', 'CONTRACT'] },
    },
    {
        code: 'KR-SELF-DEV',
        name: '자기계발비 지원',
        nameEn: 'Self-Development Support',
        category: 'EDUCATION',
        description: '직원 역량 개발을 위한 교육비, 도서구입비, 자격증 취득 비용을 지원합니다.',
        benefitType: 'reimbursement',
        amount: null,
        maxAmount: 1_000_000,
        currency: 'KRW',
        frequency: 'annual',
        requiresApproval: true,
        requiresProof: true,
        companyCode: 'CTR-KR',
        displayOrder: 4,
        eligibility: { minTenureMonths: 3, employmentTypes: ['FULL_TIME', 'CONTRACT'] },
    },
    {
        code: 'KR-COMMUTE',
        name: '통근비 지원',
        nameEn: 'Commute Support',
        category: 'TRANSPORT',
        description: '대중교통 이용 직원을 대상으로 월 10만원 통근비를 지원합니다.',
        benefitType: 'allowance',
        amount: 100_000,
        maxAmount: 100_000,
        currency: 'KRW',
        frequency: 'monthly',
        requiresApproval: false,
        requiresProof: false,
        companyCode: 'CTR-KR',
        displayOrder: 5,
        eligibility: { employmentTypes: ['FULL_TIME', 'CONTRACT', 'INTERN'] },
    },
    // CN Plans
    {
        code: 'CN-HEALTH-CHECK',
        name: '体检补贴',
        nameEn: 'Health Checkup Allowance',
        category: 'HEALTH',
        description: '为全体员工提供年度体检补贴，最高2000元。',
        benefitType: 'reimbursement',
        amount: null,
        maxAmount: 2_000,
        currency: 'CNY',
        frequency: 'annual',
        requiresApproval: true,
        requiresProof: true,
        companyCode: 'CTR-CN',
        displayOrder: 1,
        eligibility: { employmentTypes: ['FULL_TIME'] },
    },
    {
        code: 'CN-COMMUTE',
        name: '交通补贴',
        nameEn: 'Transport Allowance',
        category: 'TRANSPORT',
        description: '为全体员工提供每月500元交通补贴。',
        benefitType: 'allowance',
        amount: 500,
        maxAmount: 500,
        currency: 'CNY',
        frequency: 'monthly',
        requiresApproval: false,
        requiresProof: false,
        companyCode: 'CTR-CN',
        displayOrder: 2,
        eligibility: { employmentTypes: ['FULL_TIME', 'CONTRACT'] },
    },
    {
        code: 'CN-TRAINING',
        name: '培训补贴',
        nameEn: 'Training Allowance',
        category: 'EDUCATION',
        description: '为员工提供年度培训学习补贴，最高5000元。',
        benefitType: 'reimbursement',
        amount: null,
        maxAmount: 5_000,
        currency: 'CNY',
        frequency: 'annual',
        requiresApproval: true,
        requiresProof: true,
        companyCode: 'CTR-CN',
        displayOrder: 3,
        eligibility: { minTenureMonths: 6, employmentTypes: ['FULL_TIME'] },
    },
]

// ── BenefitBudget per category ───────────────────────────────
// TODO: Move to Settings (Benefits > Budget Management) — annual budget per category
const KR_BUDGETS = [
    { category: 'HEALTH', totalBudget: 50_000_000 },
    { category: 'EDUCATION', totalBudget: 80_000_000 },
    { category: 'OTHER', totalBudget: 30_000_000 },
    { category: 'TRANSPORT', totalBudget: 16_000_000 },
]
const CN_BUDGETS = [
    { category: 'HEALTH', totalBudget: 200_000 },
    { category: 'TRANSPORT', totalBudget: 108_000 },
    { category: 'EDUCATION', totalBudget: 90_000 },
]

// ── Claim status distribution ────────────────────────────────
const CLAIM_STATUSES = ['approved', 'approved', 'approved', 'pending', 'pending', 'rejected', 'cancelled']

// ── Claim event details ──────────────────────────────────────
const KR_CLAIM_DETAILS = [
    '서울아산병원 건강검진 비용 청구',
    '자녀 1학기 학원비 청구',
    '부모님 회갑연 경조사비 청구',
    '정보처리기사 응시료 및 교재 구매',
    'AWS 클라우드 자격증 온라인 강의 수강료',
    '전문서적 구매 비용 청구',
    'PMP 자격증 취득 비용 청구',
    '지하철 정기권 구매 비용',
]
const CN_CLAIM_DETAILS = [
    '年度体检费用报销',
    '交通费报销-本月',
    '专业培训课程报销',
]

// ────────────────────────────────────────────────────────────
export async function seedBenefits(prisma: PrismaClient): Promise<void> {
    console.log('\n🎁 Session A: Seeding benefits data...\n')

    const krCo = await prisma.company.findFirst({ where: { code: 'CTR-KR' } })
    const cnCo = await prisma.company.findFirst({ where: { code: 'CTR-CN' } })
    if (!krCo) { console.error('  ❌ CTR-KR not found'); return }
    const krId = krCo.id
    const cnId = cnCo?.id

    // HR approver
    const hrEmp = await prisma.employee.findFirst({ where: { employeeNo: 'CTR-KR-0001' } })
    const hrId = hrEmp?.id

    // ── STEP A: BenefitPlans ─────────────────────────────────
    console.log('📌 STEP A: Creating benefit plans...')
    let planCount = 0
    const planIdMap: Record<string, string> = {}

    for (const p of BENEFIT_PLANS) {
        const companyId = p.companyCode === 'CTR-CN' ? cnId : krId
        if (!companyId) continue

        const planId = deterministicUUID('benefitplan', `${p.companyCode}:${p.code}`)
        planIdMap[p.code] = planId

        const existing = await prisma.benefitPlan.findFirst({ where: { id: planId } })
        if (!existing) {
            await prisma.benefitPlan.create({
                data: {
                    id: planId,
                    companyId,
                    code: p.code,
                    name: p.name,
                    nameEn: p.nameEn,
                    category: p.category,
                    description: p.description,
                    benefitType: p.benefitType,
                    amount: p.amount,
                    maxAmount: p.maxAmount,
                    currency: p.currency,
                    frequency: p.frequency,
                    eligibility: p.eligibility,
                    requiresApproval: p.requiresApproval,
                    requiresProof: p.requiresProof,
                    isActive: true,
                    displayOrder: p.displayOrder,
                },
            })
            planCount++
        }
    }
    console.log(`  ✅ ${planCount} benefit plans created`)

    // ── STEP B: BenefitClaims ────────────────────────────────
    console.log('📌 STEP B: Creating benefit claims...')
    let claimCount = 0

    // Get KR active employees (first 20 for claims)
    const krEmps = await prisma.employeeAssignment.findMany({
        where: { companyId: krId, isPrimary: true, endDate: null, status: { not: 'TERMINATED' } },
        select: { employeeId: true },
        take: 20,
    })

    // KR plans to create claims for
    const krPlanCodes = ['KR-HEALTH-CHECK', 'KR-EDU-CHILD', 'KR-LIFE-EVENT', 'KR-SELF-DEV']

    for (let i = 0; i < krEmps.length; i++) {
        const empId = krEmps[i].employeeId

        // Each employee gets 1~2 claims
        const numClaims = 1 + Math.floor(sr(i * 7) * 2)
        for (let ci = 0; ci < numClaims; ci++) {
            const planCode = krPlanCodes[(i + ci) % krPlanCodes.length]
            const planId = planIdMap[planCode]
            if (!planId) continue

            const planDef = BENEFIT_PLANS.find(p => p.code === planCode)!
            const claimAmount = Math.round(
                (planDef.maxAmount * 0.4 + sr(i * 13 + ci) * planDef.maxAmount * 0.5) / 1000
            ) * 1000

            const statusStr = CLAIM_STATUSES[(i + ci * 3) % CLAIM_STATUSES.length]
            const eventDate = daysAgo(10 + i * 3 + ci * 7)
            const isApproved = statusStr === 'approved'
            const isPending = statusStr === 'pending'

            const claimId = deterministicUUID('benefitclaim', `KR:${empId}:${planCode}:${ci}`)
            const existing = await prisma.benefitClaim.findFirst({ where: { id: claimId } })
            if (!existing) {
                await prisma.benefitClaim.create({
                    data: {
                        id: claimId,
                        benefitPlanId: planId,
                        employeeId: empId,
                        claimAmount,
                        approvedAmount: isApproved ? claimAmount : null,
                        eventDate,
                        eventDetail: KR_CLAIM_DETAILS[(i + ci) % KR_CLAIM_DETAILS.length],
                        proofPaths: planDef.requiresProof
                            ? [`receipts/${planCode}/${claimId}.jpg`]
                            : [],
                        status: statusStr,
                        approvedBy: isApproved ? hrId : null,
                        approvedAt: isApproved ? daysAgo(2 + ci) : null,
                        rejectedReason: statusStr === 'rejected' ? '증빙서류 미비' : null,
                        paidAt: isApproved ? daysAgo(1) : null,
                    },
                })
                claimCount++
            }
        }
    }

    // CN claims
    if (cnId) {
        const cnEmps = await prisma.employeeAssignment.findMany({
            where: { companyId: cnId, isPrimary: true, endDate: null },
            select: { employeeId: true },
            take: 10,
        })
        const cnPlanCodes = ['CN-HEALTH-CHECK', 'CN-COMMUTE', 'CN-TRAINING']

        for (let i = 0; i < cnEmps.length; i++) {
            const empId = cnEmps[i].employeeId
            const planCode = cnPlanCodes[i % cnPlanCodes.length]
            const planId = planIdMap[planCode]
            if (!planId) continue

            const planDef = BENEFIT_PLANS.find(p => p.code === planCode)!
            const claimAmount = planDef.amount ?? Math.round(planDef.maxAmount * (0.5 + sr(i * 17) * 0.4))
            const statusStr = i % 3 === 0 ? 'pending' : 'approved'

            const claimId = deterministicUUID('benefitclaim', `CN:${empId}:${planCode}`)
            const existing = await prisma.benefitClaim.findFirst({ where: { id: claimId } })
            if (!existing) {
                await prisma.benefitClaim.create({
                    data: {
                        id: claimId,
                        benefitPlanId: planId,
                        employeeId: empId,
                        claimAmount,
                        approvedAmount: statusStr === 'approved' ? claimAmount : null,
                        eventDate: daysAgo(5 + i * 4),
                        eventDetail: CN_CLAIM_DETAILS[i % CN_CLAIM_DETAILS.length],
                        proofPaths: [],
                        status: statusStr,
                        approvedAt: statusStr === 'approved' ? daysAgo(2) : null,
                        paidAt: statusStr === 'approved' ? daysAgo(1) : null,
                    },
                })
                claimCount++
            }
        }
    }
    console.log(`  ✅ ${claimCount} benefit claims created`)

    // ── STEP C: BenefitBudgets ───────────────────────────────
    console.log('📌 STEP C: Benefit budgets (2026)...')
    let budgetCount = 0
    const FISCAL_YEAR = 2026

    for (const b of KR_BUDGETS) {
        const usedAmount = Math.round(b.totalBudget * (0.1 + sr(KR_BUDGETS.indexOf(b) * 7) * 0.3))
        try {
            await prisma.benefitBudget.upsert({
                where: { companyId_year_category: { companyId: krId, year: FISCAL_YEAR, category: b.category } },
                update: { totalBudget: b.totalBudget, usedAmount },
                create: {
                    id: deterministicUUID('benefitbudget', `CTR-KR:${FISCAL_YEAR}:${b.category}`),
                    companyId: krId,
                    year: FISCAL_YEAR,
                    category: b.category,
                    totalBudget: b.totalBudget,
                    usedAmount,
                },
            })
            budgetCount++
        } catch { /* already exists fallback */ }
    }

    if (cnId) {
        for (const b of CN_BUDGETS) {
            const usedAmount = Math.round(b.totalBudget * (0.1 + sr(CN_BUDGETS.indexOf(b) * 11) * 0.25))
            try {
                await prisma.benefitBudget.upsert({
                    where: { companyId_year_category: { companyId: cnId, year: FISCAL_YEAR, category: b.category } },
                    update: { totalBudget: b.totalBudget, usedAmount },
                    create: {
                        id: deterministicUUID('benefitbudget', `CTR-CN:${FISCAL_YEAR}:${b.category}`),
                        companyId: cnId,
                        year: FISCAL_YEAR,
                        category: b.category,
                        totalBudget: b.totalBudget,
                        usedAmount,
                    },
                })
                budgetCount++
            } catch { /* already exists fallback */ }
        }
    }
    console.log(`  ✅ ${budgetCount} benefit budgets created`)

    // ── Summary ──────────────────────────────────────────────
    const totalPlans = await prisma.benefitPlan.count()
    const totalClaims = await prisma.benefitClaim.count()
    const totalBudgets = await prisma.benefitBudget.count()

    console.log('\n======================================')
    console.log('🎁 Benefits Seed Complete!')
    console.log('======================================')
    console.log(`  Benefit Plans:   ${totalPlans}`)
    console.log(`  Benefit Claims:  ${totalClaims}`)
    console.log(`  Benefit Budgets: ${totalBudgets}`)
    console.log('======================================\n')
}

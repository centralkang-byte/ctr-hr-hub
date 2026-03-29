// ================================================================
// CTR HR Hub — Seed Data: Session A — Compensation
// prisma/seeds/11-compensation.ts
//
// Creates:
//   STEP A: SalaryBand per jobGrade × company (KR 6, CN 4 = 10 bands)
//           NOTE: seed.ts already seeds KR bands — we skip duplicates safely
//   STEP B: CompensationHistory for KR+CN active employees (1~3 records each)
//   STEP C: ExchangeRate (6 currency pairs, 2026-03)
//   STEP D: SalaryAdjustmentMatrix for 2025-H2 calibration cycle
// ================================================================

import { PrismaClient, CompensationChangeType } from '../../src/generated/prisma/client'

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

// ── KR SalaryBand data (annual KRW) ─────────────────────────
// Session 45 확정: E1/S1/L2/L1 4단계
// L2 밴드: 대리~부장 범위 통합 (40M~130M)
const KR_SALARY_BANDS = [
    { gradeCode: 'E1', min: 120_000_000, mid: 160_000_000, max: 200_000_000 },
    { gradeCode: 'S1', min: 80_000_000, mid: 120_000_000, max: 160_000_000 },
    { gradeCode: 'L2', min: 40_000_000, mid: 75_000_000, max: 130_000_000 },
    { gradeCode: 'L1', min: 32_000_000, mid: 38_500_000, max: 45_000_000 },
]

// ── CN Job Grade → SalaryBand (annual CNY) ──────────────────
// TODO: Move to Settings (Compensation) — CN salary band per grade level
const CN_SALARY_BANDS = [
    { gradeCode: 'S1', min: 800_000, mid: 1_100_000, max: 1_500_000 }, // 임원급
    { gradeCode: 'S2', min: 500_000, mid: 700_000, max: 900_000 }, // 부장급
    { gradeCode: 'S3', min: 320_000, mid: 440_000, max: 560_000 }, // 과차장급
    { gradeCode: 'S4', min: 180_000, mid: 250_000, max: 320_000 }, // 사원대리급
]

// ── KR grade monthly base (Session 45: E1/S1/L2/L1) ────────
// L2 범위가 넓으므로 실제 직원별 급여는 CompensationHistory에서 결정
const KR_GRADE_MONTHLY: Record<string, number> = {
    E1: 13_300_000, S1: 10_000_000, L2: 5_500_000, L1: 3_210_000,
}

// 옛 G1~G6 → 신 체계 매핑 (시드 데이터 전환용)
const OLD_TO_NEW_GRADE: Record<string, string> = {
    G1: 'E1', G2: 'L2', G3: 'L2', G4: 'L2', G5: 'L2', G6: 'L1',
}

// ── Exchange rates (2026-03-01, approximate market) ─────────
// TODO: Move to Settings (Payroll > FX Rates) — manual exchange rate management
const EXCHANGE_RATES = [
    { from: 'USD', to: 'KRW', rate: 1_380.50 },
    { from: 'CNY', to: 'KRW', rate: 190.20 },
    { from: 'KRW', to: 'USD', rate: 0.000724 },
    { from: 'RUB', to: 'KRW', rate: 15.30 },
    { from: 'VND', to: 'KRW', rate: 0.0544 },
    { from: 'MXN', to: 'KRW', rate: 71.80 },
]

// ── EMS Block → raise rate mapping ──────────────────────────
// TODO: Move to Settings (Performance > Compensation Matrix) — raise rate by EMS block
const EMS_RAISE_MATRIX = [
    { emsBlock: 'HH', rec: 8.0, min: 6.0, max: 12.0 },
    { emsBlock: 'HM', rec: 6.0, min: 4.0, max: 9.0 },
    { emsBlock: 'MH', rec: 5.0, min: 3.5, max: 8.0 },
    { emsBlock: 'MM', rec: 3.5, min: 2.0, max: 6.0 },
    { emsBlock: 'ML', rec: 2.0, min: 1.0, max: 4.0 },
    { emsBlock: 'LH', rec: 1.5, min: 0.0, max: 3.0 },
    { emsBlock: 'LM', rec: 0.5, min: 0.0, max: 2.0 },
    { emsBlock: 'LL', rec: 0.0, min: 0.0, max: 1.0 },
    { emsBlock: 'HL', rec: 4.0, min: 2.0, max: 7.0 },
]

// ────────────────────────────────────────────────────────────
export async function seedCompensation(prisma: PrismaClient): Promise<void> {
    console.log('\n💼 Session A: Seeding compensation data...\n')

    // ── Company IDs ──────────────────────────────────────────
    const krCo = await prisma.company.findFirst({ where: { code: 'CTR' } })
    const cnCo = await prisma.company.findFirst({ where: { code: 'CTR-CN' } })
    if (!krCo) { console.error('  ❌ CTR-KR not found'); return }
    const krId = krCo.id
    const cnId = cnCo?.id

    // HR approver
    const hrEmp = await prisma.employee.findFirst({ where: { employeeNo: 'CTR-KR-0001' } })
    const hrId = hrEmp?.id

    // ── STEP A: SalaryBands ──────────────────────────────────
    console.log('📌 STEP A: Salary bands...')
    let bandCount = 0
    const effectiveFrom = new Date('2026-01-01')

    // KR bands (seed.ts may have already created these — use skipDuplicates approach)
    const krGrades = await prisma.jobGrade.findMany({
        where: { companyId: krId },
        select: { id: true, code: true },
    })
    const krGradeMap: Record<string, string> = {}
    for (const g of krGrades) krGradeMap[g.code] = g.id

    const krOfficeCat = await prisma.jobCategory.findFirst({
        where: { companyId: krId, code: 'OFFICE' },
    })

    for (const band of KR_SALARY_BANDS) {
        const gradeId = krGradeMap[band.gradeCode]
        if (!gradeId) continue

        // Check if already exists (seed.ts may have created it)
        const existing = await prisma.salaryBand.findFirst({
            where: { companyId: krId, jobGradeId: gradeId, effectiveFrom },
        })
        if (!existing) {
            await prisma.salaryBand.create({
                data: {
                    id: deterministicUUID('salaryband', `CTR-KR:${band.gradeCode}:2026`),
                    companyId: krId,
                    jobGradeId: gradeId,
                    jobCategoryId: krOfficeCat?.id,
                    currency: 'KRW',
                    minSalary: band.min,
                    midSalary: band.mid,
                    maxSalary: band.max,
                    effectiveFrom,
                },
            })
            bandCount++
        }
    }

    // CN bands
    if (cnId) {
        const cnGrades = await prisma.jobGrade.findMany({
            where: { companyId: cnId },
            select: { id: true, code: true },
        })
        const cnGradeMap: Record<string, string> = {}
        for (const g of cnGrades) cnGradeMap[g.code] = g.id

        for (const band of CN_SALARY_BANDS) {
            const gradeId = cnGradeMap[band.gradeCode]
            if (!gradeId) continue

            const existing = await prisma.salaryBand.findFirst({
                where: { companyId: cnId, jobGradeId: gradeId, effectiveFrom },
            })
            if (!existing) {
                await prisma.salaryBand.create({
                    data: {
                        id: deterministicUUID('salaryband', `CTR-CN:${band.gradeCode}:2026`),
                        companyId: cnId,
                        jobGradeId: gradeId,
                        currency: 'CNY',
                        minSalary: band.min,
                        midSalary: band.mid,
                        maxSalary: band.max,
                        effectiveFrom,
                    },
                })
                bandCount++
            }
        }
    }
    console.log(`  ✅ ${bandCount} salary bands created`)

    // ── STEP B: CompensationHistory ──────────────────────────
    console.log('📌 STEP B: Compensation history...')
    let histCount = 0

    // Get KR active employees with grade info
    const krAssignments = await prisma.employeeAssignment.findMany({
        where: { companyId: krId, isPrimary: true, endDate: null, status: { not: 'TERMINATED' } },
        select: {
            employeeId: true,
            jobGrade: { select: { code: true } },
            employee: { select: { employeeNo: true, hireDate: true } },
        },
    })

    for (let i = 0; i < krAssignments.length; i++) {
        const asgn = krAssignments[i]
        const empId = asgn.employeeId
        const gradeCode = asgn.jobGrade?.code ?? 'G6'
        const hireDate = asgn.employee.hireDate
        const monthlyBase = KR_GRADE_MONTHLY[gradeCode] ?? 3_210_000
        const annualBase = monthlyBase * 12

        const hireSalary = Math.round(annualBase * (0.85 + sr(i * 11) * 0.15) / 1_000_000) * 1_000_000

        // Record 1: HIRE
        const hireHistId = deterministicUUID('comphist', `KR:${empId}:HIRE`)
        const existsHire = await prisma.compensationHistory.findFirst({ where: { id: hireHistId } })
        if (!existsHire) {
            await prisma.compensationHistory.create({
                data: {
                    id: hireHistId,
                    employeeId: empId,
                    companyId: krId,
                    changeType: 'HIRE',
                    previousBaseSalary: 0,
                    newBaseSalary: hireSalary,
                    currency: 'KRW',
                    changePct: 0,
                    effectiveDate: hireDate,
                    reason: '신규 입사',
                    approvedById: hrId,
                },
            })
            histCount++
        }

        // Record 2: ANNUAL_INCREASE (if tenure > 1 year)
        const tenureYears = (Date.now() - hireDate.getTime()) / (365.25 * 24 * 3600 * 1000)
        if (tenureYears >= 1) {
            const raiseDate = new Date(hireDate)
            raiseDate.setFullYear(raiseDate.getFullYear() + 1)
            raiseDate.setMonth(0) // January raise
            raiseDate.setDate(1)

            const raisePct = 3 + sr(i * 7 + 3) * 5  // 3~8%
            const raisedSalary = Math.round(hireSalary * (1 + raisePct / 100) / 1_000_000) * 1_000_000

            const annualHistId = deterministicUUID('comphist', `KR:${empId}:ANNUAL_2025`)
            const existsAnnual = await prisma.compensationHistory.findFirst({ where: { id: annualHistId } })
            if (!existsAnnual) {
                await prisma.compensationHistory.create({
                    data: {
                        id: annualHistId,
                        employeeId: empId,
                        companyId: krId,
                        changeType: 'ANNUAL_INCREASE',
                        previousBaseSalary: hireSalary,
                        newBaseSalary: raisedSalary,
                        currency: 'KRW',
                        changePct: Math.round(raisePct * 100) / 100,
                        effectiveDate: raiseDate.getFullYear() < 2025 ? new Date('2025-01-01') : raiseDate,
                        reason: '2025년 연봉 인상',
                        approvedById: hrId,
                    },
                })
                histCount++
            }
        }
    }

    // CN compensation history (simpler — just hire records)
    if (cnId) {
        const cnAssignments = await prisma.employeeAssignment.findMany({
            where: { companyId: cnId, isPrimary: true, endDate: null, status: { not: 'TERMINATED' } },
            select: {
                employeeId: true,
                employee: { select: { hireDate: true } },
            },
        })

        for (let i = 0; i < cnAssignments.length; i++) {
            const asgn = cnAssignments[i]
            const empId = asgn.employeeId
            const hireDate = asgn.employee.hireDate
            const cnBase = Math.round((150_000 + sr(i * 13) * 100_000) / 1000) * 1000 // CNY annual

            const hireHistId = deterministicUUID('comphist', `CN:${empId}:HIRE`)
            const exists = await prisma.compensationHistory.findFirst({ where: { id: hireHistId } })
            if (!exists) {
                await prisma.compensationHistory.create({
                    data: {
                        id: hireHistId,
                        employeeId: empId,
                        companyId: cnId,
                        changeType: 'HIRE',
                        previousBaseSalary: 0,
                        newBaseSalary: cnBase,
                        currency: 'CNY',
                        changePct: 0,
                        effectiveDate: hireDate,
                        reason: '入职',
                    },
                })
                histCount++
            }
        }
    }
    console.log(`  ✅ ${histCount} compensation history records created`)

    // ── STEP C: ExchangeRates ────────────────────────────────
    console.log('📌 STEP C: Exchange rates (2026-03)...')
    let fxCount = 0
    const fxYear = 2026
    const fxMonth = 3

    for (const fx of EXCHANGE_RATES) {
        try {
            await prisma.exchangeRate.upsert({
                where: { year_month_fromCurrency_toCurrency: { year: fxYear, month: fxMonth, fromCurrency: fx.from, toCurrency: fx.to } },
                update: { rate: fx.rate },
                create: {
                    id: deterministicUUID('fxrate', `${fxYear}:${fxMonth}:${fx.from}:${fx.to}`),
                    year: fxYear,
                    month: fxMonth,
                    fromCurrency: fx.from,
                    toCurrency: fx.to,
                    rate: fx.rate,
                    source: 'manual',
                },
            })
            fxCount++
        } catch { /* skip duplicate */ }
    }
    console.log(`  ✅ ${fxCount} exchange rates created`)

    // ── STEP D: SalaryAdjustmentMatrix ──────────────────────
    console.log('📌 STEP D: Salary adjustment matrix (2025-H2 cycle)...')
    let matrixCount = 0

    // Find 2025-H2 performance cycle
    const cycle = await prisma.performanceCycle.findFirst({
        where: { companyId: krId, year: 2025, half: 'H2' },
    })
    const cycleId = cycle?.id

    for (const m of EMS_RAISE_MATRIX) {
        const matrixId = deterministicUUID('salmatrix', `CTR-KR:2025H2:${m.emsBlock}`)
        const existing = await prisma.salaryAdjustmentMatrix.findFirst({ where: { id: matrixId } })
        if (!existing) {
            await prisma.salaryAdjustmentMatrix.create({
                data: {
                    id: matrixId,
                    companyId: krId,
                    cycleId,
                    emsBlock: m.emsBlock,
                    recommendedIncreasePct: m.rec,
                    minIncreasePct: m.min,
                    maxIncreasePct: m.max,
                },
            })
            matrixCount++
        }
    }
    console.log(`  ✅ ${matrixCount} salary adjustment matrix entries`)

    // ── Summary ──────────────────────────────────────────────
    const totalBands = await prisma.salaryBand.count()
    const totalHist = await prisma.compensationHistory.count()
    const totalFx = await prisma.exchangeRate.count()

    console.log('\n======================================')
    console.log('💼 Compensation Seed Complete!')
    console.log('======================================')
    console.log(`  Salary Bands:         ${totalBands}`)
    console.log(`  Compensation History: ${totalHist}`)
    console.log(`  Exchange Rates:       ${totalFx}`)
    console.log(`  Adjustment Matrix:    ${matrixCount}`)
    console.log('======================================\n')
}
